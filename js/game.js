// Slice of Life — one day in the shop. DOM-free and clockless: everything moves
// when update(dt) is called, so the tests and the balance bot run the real
// engine with no browser.
//
// The shape of a day
//   - A clock runs noon to nine. Customers join a single-file LINE; the one at
//     the front is at the counter. Tap them to take the order.
//   - Taking an order moves them out of the line into the kitchen: up to
//     MAX_OPEN pizzas in progress at once, each with its own pizza and its own
//     patience. The next in line steps up.
//   - A pizza goes build -> oven (a timed run) -> baked -> cut -> boxed ->
//     served. Sending it round the oven again is how "well done" is made.
//   - After closing nobody new arrives; the day ends when the last order does.
//
// Every action returns { ok:true, ... } or { ok:false, why:"code" }, so the UI
// can say WHY a tap did nothing — a tap that does nothing silently is the thing
// that makes a game feel broken.

const PAY_MULT = { 5: 1.0, 4: 0.95, 3: 0.85, 2: 0.65, 1: 0.5 };
const TIP_RATE = { 5: 0.28, 4: 0.16, 3: 0.06, 2: 0, 1: 0 };
const REP_FOR = { 5: 8, 4: 5, 3: 2, 2: 0, 1: -1 };
const REP_REFUND = -4, REP_LEFT = -5;
const MEMORY_BONUS = 0.06;              // extra tip for remembering the order unaided
const WHAT_COST = 0.10, HINT_COST = 0.15;

function clockText(t, dayLen) {
  const mins = 12 * 60 + Math.min(1, t / dayLen) * 9 * 60;
  const h = Math.floor(mins / 60), m = Math.floor(mins % 60);
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const Game = {
  on: {},
  running: false,

  start(cfg) {
    this.cfg = cfg;
    this.day = cfg.day;
    this.kit = cfg.kit;
    this.seed = cfg.seed || "family";
    this.notesOn = cfg.notes !== false;
    this.info = dayInfo(cfg.day);
    this.dayLen = this.kit.dayLen;
    this.t = 0;
    this.closing = false;
    this.running = true;
    this.finished = false;
    this.line = [];
    this.open = [];
    this.nextId = 1;
    this.dealt = 0;
    this.lastArrival = -99;
    this.criticDealt = false;
    this.recent = [];
    this.focus = null;
    this.stats = {
      served: 0, refunds: 0, left: 0, revenue: 0, tips: 0, supplies: 0,
      starsSum: 0, starsN: 0, perfect: 0, rep: 0, met: {}, critic: 0, bestTip: 0,
      pizzas: 0,
    };
    return this;
  },

  emit(name, data) { const f = this.on[name]; if (f) f(data); },

  get ovenBusy() { return this.open.filter((o) => o.phase === "oven").length; },
  get ovenFree() { return this.ovenBusy < this.kit.ovenSlots; },
  get timeLeft() { return Math.max(0, this.dayLen - this.t); },
  get clock() { return clockText(this.t, this.dayLen); },
  get atCounter() { return this.line[0] || null; },
  order(id) { return this.open.find((o) => o.id === id) || null; },

  /* ------------------------------- customers ------------------------------- */

  deal() {
    const i = this.dealt++;
    const day = this.day;
    const pickRng = RNG.sub(this.seed, "cust", day, i);
    let entry;
    const wantCritic = this.info.showdown && !this.criticDealt && this.t >= this.dayLen * 0.5;
    if (wantCritic) { entry = CUSTOMER.critic; this.criticDealt = true; }
    else if (day === 1 && i === 0) entry = CUSTOMER.marge;
    else {
      const pool = ROSTER.filter((c) => c.from <= day && c.weight > 0);
      entry = pickRng.weighted(pool, (c) => c.weight * (this.recent.includes(c.id) ? 0.12 : 1) * (c.kind === "cultist" && chapterOf(day).id === 2 ? 3 : 1));
    }
    this.recent.push(entry.id);
    if (this.recent.length > 4) this.recent.shift();

    const order = makeOrder(RNG.sub(this.seed, "order", day, i), {
      day, tops: this.kit.tops, sauces: this.kit.sauces, entry, boost: entry.kind === "critic" ? 3 : 0,
    });
    const speech = sayOrder(entry, order, RNG.sub(this.seed, "say", day, i));
    const work = workSeconds(order) + order.runs * this.kit.ovenTime;
    const patience = (work + 25) * this.info.patience * this.kit.patience;
    const cust = {
      id: this.nextId++, entry, order, speech,
      patience, happy: 1, arrivedAt: this.t, state: "line", index: i,
    };
    this.line.push(cust);
    this.lastArrival = this.t;
    this.emit("arrive", cust);
    return cust;
  },

  /* --------------------------------- the day --------------------------------- */

  update(dt) {
    if (!this.running || this.finished || !(dt > 0)) return;
    dt = Math.min(dt, 0.25);
    this.t += dt;

    if (!this.closing && this.t >= this.dayLen) { this.closing = true; this.emit("closing"); }

    // Arrivals: whenever the line has room and the gap has passed.
    if (!this.closing) {
      const want = this.t >= 1 && this.line.length < lineTarget(this.day) && this.t - this.lastArrival >= arrivalGap(this.day);
      const critic = this.info.showdown && !this.criticDealt && this.t >= this.dayLen * 0.5 && this.line.length < LINE_MAX;
      if (this.dealt === 0 ? this.t >= 1 : (want || critic)) this.deal();
    }

    // Patience: everybody waiting, in line or at the oven, runs down together.
    for (const c of [...this.line]) this.tickCustomer(c, dt);
    for (const o of [...this.open]) this.tickCustomer(o.cust, dt, o);

    for (const o of this.open) {
      if (o.phase !== "oven") continue;
      o.ovenT += dt;
      if (o.ovenT >= this.kit.ovenTime) {
        o.ovenT = 0; o.pizza.runs++; o.pizza.rev++; o.phase = "baked";
        this.emit("ding", o);
      }
    }

    if (this.closing && !this.line.length && !this.open.length) this.finish();
  },

  tickCustomer(c, dt, o) {
    c.happy -= dt / c.patience;
    if (c.happy <= 0) this.leave(c, o);
  },

  leave(c, o) {
    c.state = "gone";
    this.stats.left++;
    this.stats.rep += REP_LEFT;
    if (o) {
      const cost = pizzaCost(o.pizza);
      this.stats.supplies += cost;
      this.open.splice(this.open.indexOf(o), 1);
      if (this.focus === o.id) this.focus = this.open.length ? this.open[0].id : null;
    } else this.line.splice(this.line.indexOf(c), 1);
    this.emit("left", { cust: c, order: o || null });
  },

  /* ------------------------------ taking orders ------------------------------ */

  takeOrder() {
    const c = this.line[0];
    if (!c) return { ok: false, why: "nobody" };
    if (this.open.length >= MAX_OPEN) return { ok: false, why: "full" };
    this.line.shift();
    c.state = "open";
    const o = {
      id: c.id, cust: c, order: c.order, pizza: newPizza(c.id), phase: "build",
      ovenT: 0, whats: 0, hints: 0, startedAt: this.t,
    };
    this.open.push(o);
    this.focus = o.id;
    this.emit("order", o);
    return { ok: true, o, text: c.speech };
  },

  // "What?" — they say it again, and they are a little less pleased.
  what(id) {
    const o = this.order(id);
    if (!o) return { ok: false, why: "gone" };
    o.whats++;
    o.cust.happy = Math.max(0.02, o.cust.happy - WHAT_COST);
    this.emit("what", o);
    return { ok: true, text: o.cust.speech };
  },

  // "Hint" — a plain checklist. Costlier: you are admitting you weren't listening.
  hint(id) {
    const o = this.order(id);
    if (!o) return { ok: false, why: "gone" };
    o.hints++;
    o.cust.happy = Math.max(0.02, o.cust.happy - HINT_COST);
    return { ok: true, lines: checklist(o.order) };
  },

  setFocus(id) { if (this.order(id)) { this.focus = id; return true; } return false; },

  /* --------------------------------- building --------------------------------- */

  building(id) {
    const o = this.order(id);
    if (!o) return [null, { ok: false, why: "gone" }];
    if (o.phase !== "build") return [null, { ok: false, why: "cooked" }];
    return [o, null];
  },

  paintSauce(id, type, x, y) {
    const [o, err] = this.building(id); if (err) return err;
    if (!this.kit.sauces.has(type)) return { ok: false, why: "nosauce" };
    const r = paintSauce(o.pizza, type, x, y, this.kit.sauceR);
    return { ok: true, ...r };
  },

  sprinkle(id, x, y) {
    const [o, err] = this.building(id); if (err) return err;
    return { ok: true, n: sprinkle(o.pizza, x, y, this.kit.cheeseR) };
  },

  drop(id, t, x, y, rand) {
    const [o, err] = this.building(id); if (err) return err;
    if (!this.kit.tops.has(t)) return { ok: false, why: "notopping" };
    if (o.pizza.tops.length >= MAX_PIECES) return { ok: false, why: "toomany" };
    const piece = dropTopping(o.pizza, t, x, y, rand);
    return piece ? { ok: true, piece } : { ok: false, why: "edge" };
  },

  undoTopping(id) {
    const [o, err] = this.building(id); if (err) return err;
    return { ok: !!undoTopping(o.pizza) };
  },
  clearToppings(id) {
    const [o, err] = this.building(id); if (err) return err;
    clearToppings(o.pizza); return { ok: true };
  },
  scrape(id) {
    const [o, err] = this.building(id); if (err) return err;
    scrape(o.pizza); return { ok: true };
  },

  // Start over: bin the pizza, keep the order. The ingredients are gone.
  discard(id) {
    const o = this.order(id);
    if (!o) return { ok: false, why: "gone" };
    if (o.phase === "oven") return { ok: false, why: "inoven" };
    const cost = pizzaCost(o.pizza);
    this.stats.supplies += cost;
    o.pizza = newPizza(o.id); o.phase = "build"; o.ovenT = 0;
    this.emit("discard", { o, cost });
    return { ok: true, cost };
  },

  /* ----------------------------------- oven ----------------------------------- */

  toOven(id) {
    const o = this.order(id);
    if (!o) return { ok: false, why: "gone" };
    if (o.phase === "oven") return { ok: false, why: "alreadyoven" };
    if (o.phase === "ready") return { ok: false, why: "boxed" };
    if (o.phase === "cut" && o.pizza.cuts.length) return { ok: false, why: "cutalready" };
    if (o.pizza.runs >= 4) return { ok: false, why: "toomanyruns" };
    if (!this.ovenFree) return { ok: false, why: "ovenfull" };
    o.phase = "oven"; o.ovenT = 0;
    this.emit("oven", o);
    return { ok: true };
  },

  /* ---------------------------------- cutting ---------------------------------- */

  toCut(id) {
    const o = this.order(id);
    if (!o) return { ok: false, why: "gone" };
    if (o.phase !== "baked") return { ok: false, why: o.pizza.runs ? "notbaked" : "raw" };
    o.phase = "cut";
    return { ok: true };
  },

  cut(id, angle) {
    const o = this.order(id);
    if (!o) return { ok: false, why: "gone" };
    if (o.phase !== "cut") return { ok: false, why: "notcut" };
    const a = this.kit.snap ? snapCut(o.pizza, angle, o.order.slices) : angle;
    const r = addCut(o.pizza, a);
    if (!r.ok) return r;
    this.emit("cut", o);
    return { ok: true, angle: r.angle };
  },

  undoCut(id) {
    const o = this.order(id);
    if (!o || o.phase !== "cut") return { ok: false, why: "notcut" };
    return { ok: undoCut(o.pizza) !== undefined };
  },

  box(id) {
    const o = this.order(id);
    if (!o) return { ok: false, why: "gone" };
    if (o.phase !== "cut") return { ok: false, why: "notcut" };
    o.phase = "ready"; o.pizza.boxed = true; o.pizza.rev++;
    this.emit("box", o);
    return { ok: true };
  },

  /* ----------------------------------- serving ----------------------------------- */

  serve(id) {
    const o = this.order(id);
    if (!o) return { ok: false, why: "gone" };
    if (o.phase !== "ready") return { ok: false, why: "notready" };
    const g = gradePizza(o.order, o.pizza);
    const happy = o.cust.happy;
    const supplies = pizzaCost(o.pizza);
    const res = {
      id: o.id, entry: o.cust.entry, order: o.order, grade: g, happy,
      refund: !g.ok, stars: 0, pay: 0, tip: 0, supplies, profit: 0, rep: 0, remembered: false,
      notes: g.notes, pizza: o.pizza, cust: o.cust,
    };
    if (g.ok) {
      res.stars = starsFor(g.quality, happy);
      res.pay = Math.round(o.order.price * PAY_MULT[res.stars]);
      res.remembered = !this.notesOn && o.whats === 0 && o.hints === 0;
      const bonus = 1 + this.kit.tipBonus + (res.remembered ? MEMORY_BONUS : 0);
      res.tip = Math.round(o.order.price * TIP_RATE[res.stars] * (0.5 + 0.5 * happy) * bonus);
      res.rep = REP_FOR[res.stars];
    } else {
      res.rep = REP_REFUND;
      res.stars = 0;
    }
    res.profit = res.pay + res.tip - supplies;

    const s = this.stats;
    s.served++; s.pizzas++;
    s.revenue += res.pay; s.tips += res.tip; s.supplies += supplies; s.rep += res.rep;
    s.bestTip = Math.max(s.bestTip, res.tip);
    s.met[o.cust.entry.id] = (s.met[o.cust.entry.id] || 0) + 1;
    if (res.refund) s.refunds++;
    else { s.starsSum += res.stars; s.starsN++; if (res.stars === 5) s.perfect++; }
    if (o.cust.entry.kind === "critic") s.critic = res.stars;

    o.cust.state = "gone";
    this.open.splice(this.open.indexOf(o), 1);
    if (this.focus === o.id) this.focus = this.open.length ? this.open[0].id : null;
    this.emit("served", res);
    return { ok: true, res };
  },

  /* ----------------------------------- the end ----------------------------------- */

  finish() {
    if (this.finished) return;
    this.finished = true; this.running = false;
    const s = this.stats;
    const avg = s.starsN ? s.starsSum / s.starsN : 0;
    const revenue = s.revenue + s.tips;
    const profit = revenue - s.supplies;
    let stars = 0;
    if (s.served) {
      // One slip is allowed on a perfect day; three is still a decent one.
      if (avg >= 4 && s.left + s.refunds <= 1) stars = 3;
      else if (avg >= 3.2 && s.left + s.refunds <= 3) stars = 2;
      else stars = 1;
    }
    const showdown = this.info.showdown
      ? { beat: avg >= 3.5 && s.critic >= 4 && s.left <= 1, critic: s.critic }
      : null;
    this.result = {
      day: this.day, served: s.served, refunds: s.refunds, left: s.left,
      revenue, sales: s.revenue, tips: s.tips, supplies: s.supplies, profit,
      avgStars: avg, perfect: s.perfect, rep: s.rep, stars, met: s.met, showdown,
      bestTip: s.bestTip,
    };
    this.emit("end", this.result);
    return this.result;
  },
};

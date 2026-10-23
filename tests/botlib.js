// A player that plays the REAL engine through the same calls the UI makes, one
// pair of hands at human speed. The suite and tools/diag.js both use it, so
// they cannot measure two different players.
//
// What it is imperfect at is the thing the game tests: LISTENING. Every clause
// of an order (sauce, cheese, each topping, the bake, the slices) can be
// misheard, and a bot that mishears sometimes asks "What?" — which costs a
// little happiness, exactly as it does a person. Everything else (placing a
// piece, a cut angle, a sweep of sauce) has a small human wobble.

const { load } = require("./load.js");

// `slow` multiplies the time of every action. 1.0 is a flat-out tap-as-fast-as-
// you-can run; a person finding the next bin, reading the ticket and lifting a
// thumb is about 1.5x that, and a child thinking about it about 2.2x.
const SKILLS = {
  //          mishear  askWhat  wobble  slow  stray  hands-free orders
  pro:    { mis: 0.02, ask: 0.8, wob: 0.03, slow: 1.15, stray: 0.01, open: 2 },
  normal: { mis: 0.05, ask: 0.6, wob: 0.05, slow: 1.55, stray: 0.03, open: 2 },
  kid:    { mis: 0.12, ask: 0.5, wob: 0.09, slow: 2.2,  stray: 0.07, open: 2 },
  slow:   { mis: 0.05, ask: 0.6, wob: 0.05, slow: 2.8,  stray: 0.03, open: 1 },
};

function makeBot(S, skill, seed) {
  const rng = S.RNG.make(S.RNG.seedFrom("bot:" + seed));
  const G = S.Game;
  const K = SKILLS[skill];
  const log = { whats: 0, mishears: 0, binned: 0 };

  // Advance the clock by `sec` of this bot's own time.
  const spend = (sec) => {
    let left = sec * K.slow;
    while (left > 0 && !G.finished) {
      const dt = Math.min(0.1, left);
      G.update(dt); left -= dt;
    }
  };

  // What the bot THINKS it heard. Each clause can go wrong.
  const hear = (o) => {
    const mem = JSON.parse(JSON.stringify(o.order));
    let wrong = false;
    // With the written ticket up there is nothing to misremember — a person
    // glances at it, which is why the ticket is a kindness and not a cheat.
    const flip = () => rng() < (G.notesOn ? K.mis * 0.12 : K.mis);
    if (flip()) { mem.runs = Math.min(4, Math.max(1, mem.runs + (rng() < 0.5 ? -1 : 1))); wrong = true; }
    if (flip()) { mem.slices = rng.pick([2, 4, 6, 8].filter((s) => s !== mem.slices)); wrong = true; }
    if (flip()) { mem.cheese = rng.pick(["none", "normal", "extra"].filter((s) => s !== mem.cheese)); wrong = true; }
    for (const r of mem.reqs) {
      if (flip()) {
        if (rng() < 0.5 && r.region !== "whole") r.region = S.REGIONS[r.region].area === 0.5 ? ({ L: "R", R: "L", T: "B", B: "T" })[r.region] : r.region;
        else r.t = rng.pick([...G.kit.tops].filter((t) => t !== r.t));
        wrong = true;
      }
    }
    if (wrong) {
      log.mishears++;
      if (rng() < K.ask) {                 // realises, asks again
        log.whats++;
        G.what(o.id); spend(1.5);
        return JSON.parse(JSON.stringify(o.order));
      }
    }
    return mem;
  };

  const inRegionPoint = (region, margin) => {
    for (let k = 0; k < 400; k++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.8;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (!S.inRegion(region, x, y)) continue;
      // keep clear of the dividing lines, unless this piece strays
      if (region !== "whole" && rng() >= K.stray) {
        if (Math.abs(x) < margin && (region === "L" || region === "R" || region.length === 2)) continue;
        if (Math.abs(y) < margin && (region === "T" || region === "B" || region.length === 2)) continue;
      }
      return [x + (rng() - 0.5) * K.wob, y + (rng() - 0.5) * K.wob];
    }
    return [0, 0];
  };

  const build = (o) => {
    const mem = hear(o);
    const id = o.id;
    // sauce
    if (mem.sauce !== "none") {
      const r = G.kit.sauceR, step = r * 0.9;
      for (let y = -0.75; y <= 0.76; y += step * 1.4) {
        for (let x = -0.8; x <= 0.81; x += step) { G.paintSauce(id, mem.sauce, x + (rng() - 0.5) * K.wob, y); }
      }
      spend(3.2 * (0.26 / r) ** 0.5);
    }
    tend();
    // cheese
    if (mem.cheese !== "none") {
      const passes = mem.cheese === "extra" ? 2 : 1;
      const r = G.kit.cheeseR;
      for (let p = 0; p < passes; p++) {
        for (let y = -0.78 + p * 0.1; y <= 0.78; y += r * 1.5) {
          for (let x = -0.85; x <= 0.86; x += 0.05) G.sprinkle(id, x, y);
        }
        spend(3.0 * (0.22 / r) ** 0.5);
      }
    }
    // toppings
    const types = [...new Set(mem.reqs.map((q) => q.t))];
    tend();
    for (const t of types) {
      tend();
      spend(0.9);
      for (const q of mem.reqs.filter((x) => x.t === t)) {
        const n = Math.round(S.quotaFor(q.region) * (1.05 + rng() * 0.5));
        for (let i = 0; i < n; i++) {
          const [x, y] = inRegionPoint(q.region, 0.1);
          G.drop(id, t, x, y, rng);
          spend(0.42);
        }
      }
    }
    // free-choice veg
    for (const rule of mem.rules || []) {
      if (rule.type !== "veg") continue;
      const veg = rng.shuffle([...G.kit.tops].filter(S.isVeg)).slice(0, rule.n);
      for (const t of veg) {
        spend(0.9);
        for (let i = 0; i < 7; i++) { const [x, y] = inRegionPoint("whole", 0); G.drop(id, t, x, y, rng); spend(0.42); }
      }
    }
    o.bot = { mem, runsWanted: mem.runs, slicesWanted: mem.slices };
  };

  const doCuts = (o) => {
    const n = Math.max(0, o.bot.slicesWanted === 1 ? 0 : o.bot.slicesWanted / 2);
    if (!n) return;
    const base = rng() * Math.PI;
    for (let k = 0; k < n; k++) {
      G.cut(o.id, base + k * Math.PI / n + (rng() - 0.5) * K.wob * 2);
      spend(1.0);
    }
  };

  // Anything that has come out of the oven or been boxed gets attended to
  // first — and a person does it BETWEEN steps of the pizza on the board, not
  // after it, because the ding is the whole point of the oven.
  const tend = () => {
    const ready = G.open.find((o) => o.phase === "ready");
    if (ready) { spend(0.8); G.serve(ready.id); return true; }
    const baked = G.open.find((o) => o.phase === "baked" && o.bot);
    if (baked) {
      if (baked.pizza.runs < baked.bot.runsWanted) {
        if (G.ovenFree) { spend(0.6); G.toOven(baked.id); return true; }
      } else {
        spend(0.6); G.toCut(baked.id); doCuts(baked); spend(0.6); G.box(baked.id); return true;
      }
    }
    return false;
  };

  // One decision. Returns false if there was nothing to do.
  const step = () => {
    if (tend()) return true;
    // something waiting to be built
    const todo = G.open.find((o) => o.phase === "build");
    if (todo) {
      if (!todo.bot) build(todo);
      if (G.ovenFree) { spend(0.8); G.toOven(todo.id); return true; }
      // oven full — wait for it
      spend(0.4); return true;
    }
    // take another order, if the hands are free enough
    if (G.line.length && G.open.length < K.open) {
      spend(1.0);
      const r = G.takeOrder();
      if (r.ok) spend(1.2);   // listen
      return true;
    }
    return false;
  };

  return {
    log,
    // Play the whole day.
    run(limit = 2400) {
      let guard = 0;
      while (!G.finished && guard++ < 20000 && G.t < limit) {
        if (!step()) spend(0.3);
      }
    },
  };
}

// Play one day on a given kit and progress; returns the result.
function playDay(S, { day, kit, skill = "normal", seed = "t", notes = true }) {
  S.Game.on = {};
  S.Game.start({ day, kit, seed, notes });
  const bot = makeBot(S, skill, seed + ":" + day);
  bot.run();
  if (!S.Game.finished) S.Game.finish();
  return { ...S.Game.result, bot: bot.log, t: S.Game.t };
}

module.exports = { load, SKILLS, makeBot, playDay };

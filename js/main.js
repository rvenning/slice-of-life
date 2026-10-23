// Slice of Life — screens, input and the frame loop.
//
// game.js decides what is true and emits events; render.js draws it; this file
// turns taps and drags into engine calls, builds the dock and the shop screens,
// and makes a noise about everything that happens.

// Every refusal the engine can hand back, in words a child can act on. A tap
// that does nothing and says nothing is what makes a game feel broken.
const EXCUSES = {
  nobody: "Nobody's at the counter just now.",
  full: "Your kitchen's full — finish a pizza first!",
  cooked: "It's baked now — you can't change it.",
  ovenfull: "The oven's busy — wait for a ding!",
  alreadyoven: "That one's already in the oven.",
  toomanyruns: "Any more and it'll be charcoal!",
  cutalready: "It's already cut.",
  boxed: "It's already boxed.",
  notbaked: "It needs a trip through the oven first.",
  raw: "It needs a trip through the oven first.",
  notcut: "Not ready for that yet.",
  notready: "Box it up first.",
  inoven: "It's in the oven — wait for the ding.",
  samespot: "You've already cut there.",
  toomany: "That's plenty on there!",
  edge: "Keep it on the pizza!",
  nosauce: "You haven't got that sauce yet.",
  notopping: "You haven't got that topping yet.",
  gone: "They've gone.",
};

const TABS = [
  { id: "today",       icon: "🏠", label: "Shop",    go: "showToday" },
  { id: "kitchen",     icon: "🍳", label: "Kitchen", go: "showKitchen" },
  { id: "decor",       icon: "🪴", label: "Decor",   go: "showDecor" },
  { id: "book",        icon: "📖", label: "Book",    go: "showBook" },
  { id: "leaderboard", icon: "🏆", label: "Board",   go: "showLeaderboard" },
];

const $ = (id) => document.getElementById(id);
const esc = (s) => GK.util.esc(String(s));
const stars = (n, of = 5) => "★".repeat(n) + "☆".repeat(Math.max(0, of - n));
const fullLook = (p) => ({ skin: 1, hair: 1, hairCol: 1, hat: 0, glasses: 0, beard: 0, shirt: 0, nose: 1, age: 2, ...p });

const App = {
  profile: null, progress: null, kit: null,
  active: false, paused: false, lastTs: 0, token: 0, hudAcc: 0,
  pendingDay: 1, ui: { tab: "sauce", sauce: "tomato", top: null },
  notesOn: true, tipsOn: true, drag: null, dockSig: "", receiptTimer: 0, hintTimer: 0, lastSound: 0,

  init() {
    Render.boot();
    Render.onPointer = (k, x, y, e) => this.pointer(k, x, y, e);
    this.wireGame();

    GK.UI.onScreenChange = (name) => {
      this.active = name === "game";
      if (name === "game") Render.resize();
      if (name === "splash") this.refreshSplash();
    };

    GK.Profiles.init({
      storage: Storage,
      avatars: ["🍕", "🧑‍🍳", "🍄", "🧀", "🍅", "🫒", "🌶️", "🍍", "🔥", "🥖", "🐙", "🦊"],
      meta: (p, prog) => `Day ${prog.day || 1} · 💵 ${money(Storage.balance(prog))}`,
      onEnter: (p) => this.enter(p),
      addLabel: "New Cook",
    });

    GK.initPWA({ appName: "Slice of Life" });

    // Restore the mute BEFORE the speaker button paints itself from it.
    GK.Sfx.enabled = Storage.getSettings().sound !== false;
    GK.UI.bindSoundToggle(Storage);
    GK.UI.bindMenuClicks();

    Storage.initFirebase().then((live) => {
      const b = $("sync-badge");
      if (b) b.textContent = live ? "☁️ synced with the family" : "📴 this device only";
    });

    document.addEventListener("gesturestart", (e) => e.preventDefault());
    document.addEventListener("gesturechange", (e) => e.preventDefault());
    document.addEventListener("visibilitychange", () => { if (document.hidden && this.active && Game.running) this.pause(); });

    this.refreshSplash();
    this.paintSplashPie();

    GK.Debug.init({ storage: Storage, title: "SLICE OF LIFE" })
      .jump("day", 40, (n) => { this.pendingDay = n; this.confirmOpen(); })
      .action("+$100", () => { this.progress = this.debugMoney(10000); this.showKitchen(); })
      .action("close up", () => { Game.dayLen = Game.t; });

    requestAnimationFrame((ts) => this.frame(ts));
  },

  debugMoney(cents) {
    const prog = Storage.getProgress(this.profile.id);
    prog.earned = (prog.earned || 0) + cents;
    Storage.saveProgress(this.profile.id, prog);
    return prog;
  },

  settings() { return Storage.getSettings(); },
  saveSetting(k, v) { const s = Storage.getSettings(); s[k] = v; Storage.saveSettings(s); },

  /* ----------------------------- splash & profiles ----------------------------- */

  refreshSplash() {
    const last = GK.Profiles.lastProfile();
    const btn = $("btn-continue-as");
    if (!btn) return;
    if (last) {
      btn.style.display = "";
      btn.innerHTML = `${last.avatar} Back to the shop, ${esc(last.name)}`;
      btn.onclick = () => GK.Profiles.select(last);
    } else btn.style.display = "none";
  },

  // The splash pizza is a real pizza, built with the real model and drawn with
  // the real painter — so what the splash shows is what you will make.
  paintSplashPie() {
    const p = newPizza("splash");
    const r = RNG.make(7);
    for (let y = -0.8; y <= 0.8; y += 0.18) for (let x = -0.8; x <= 0.8; x += 0.18) paintSauce(p, "tomato", x, y, 0.2);
    for (let y = -0.85; y <= 0.85; y += 0.2) for (let x = -0.85; x <= 0.85; x += 0.05) sprinkle(p, x, y, 0.22);
    for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 0.2 + (i % 3) * 0.2; dropTopping(p, "pepperoni", Math.cos(a) * rr, Math.sin(a) * rr, r); }
    for (let i = 0; i < 6; i++) { const a = i * 1.3 + 0.5, rr = 0.25 + (i % 2) * 0.3; dropTopping(p, "mushroom", Math.cos(a) * rr, Math.sin(a) * rr, r); }
    for (let i = 0; i < 5; i++) { const a = i * 1.9 + 1, rr = 0.35 + (i % 2) * 0.25; dropTopping(p, "olive", Math.cos(a) * rr, Math.sin(a) * rr, r); }
    Render.paintPizzaOn($("splash-pie"), p, 1.1);
  },

  play() { GK.Profiles.renderList(); GK.UI.showScreen("profiles"); },

  enter(profile) {
    this.profile = profile;
    this.progress = Storage.getProgress(profile.id);
    GK.Sfx.init();
    this.showToday();
    if (!this.settings().seenHelp) { this.saveSetting("seenHelp", true); this.showHelp(); }
  },

  fresh() { this.progress = Storage.getProgress(this.profile.id); this.kit = kitFor(this.progress); return this.progress; },

  /* ---------------------------------- tab shell ---------------------------------- */

  paintTabs(active) {
    const html = TABS.map((t) => `<button class="tab${t.id === active ? " on" : ""}"
      ${t.id === active ? 'aria-current="page"' : ""} onclick="App.${t.go}()">
      <span class="t-ic">${t.icon}</span><span class="t-tx">${t.label}</span></button>`).join("");
    for (const bar of document.querySelectorAll(".tabbar")) bar.innerHTML = html;
  },

  paintIcons(root) {
    for (const c of root.querySelectorAll("canvas[data-top]")) {
      const k = this.dprFor(c);
      c.width = c.clientWidth * k || 120; c.height = c.clientHeight * k || 80;
      const x = c.getContext("2d"); x.setTransform(k, 0, 0, k, 0, 0);
      drawBin(x, c.dataset.top, c.width / k, c.height / k);
    }
    for (const c of root.querySelectorAll("canvas[data-sauce]")) {
      const k = this.dprFor(c);
      c.width = c.clientWidth * k || 120; c.height = c.clientHeight * k || 80;
      const x = c.getContext("2d"); x.setTransform(k, 0, 0, k, 0, 0);
      drawBowl(x, c.dataset.sauce, c.width / k, c.height / k);
    }
    for (const c of root.querySelectorAll("canvas[data-cheese]")) {
      const k = this.dprFor(c);
      c.width = c.clientWidth * k || 120; c.height = c.clientHeight * k || 80;
      const x = c.getContext("2d"); x.setTransform(k, 0, 0, k, 0, 0);
      drawCheeseBin(x, c.width / k, c.height / k);
    }
    for (const c of root.querySelectorAll("canvas[data-who]")) {
      const k = this.dprFor(c);
      const w = c.clientWidth || 52, h = c.clientHeight || 52;
      c.width = w * k; c.height = h * k;
      const x = c.getContext("2d"); x.setTransform(k, 0, 0, k, 0, 0);
      const entry = c.dataset.who === "rival" ? { id: "rival", kind: "", voice: "polite" } : CUSTOMER[c.dataset.who];
      const look = c.dataset.who === "rival" ? fullLook(JSON.parse(c.dataset.look)) : lookFor(entry);
      drawPerson(x, w / 2, h + 4, h / 66, look, entry.kind, 0.8, 0, 0);
    }
    for (const c of root.querySelectorAll("canvas[data-pie]")) this.paintMiniPie(c);
  },
  dprFor() { return Math.min(2.5, window.devicePixelRatio || 1); },

  paintMiniPie(c) {
    const p = c._pizza; if (!p) return;
    Render.paintPizzaOn(c, p, c._heat || 1);
  },

  header(el, html) { $(el).innerHTML = html; },

  /* ------------------------------------ today ------------------------------------ */

  showToday() {
    this.fresh();
    const prog = this.progress;
    const day = prog.day || 1;
    const chap = chapterOf(day);
    const rank = rankFor(Storage.rep(prog));

    $("today-player").innerHTML =
      `${this.profile.avatar} <b>${esc(this.profile.name)}</b>` +
      `<span class="map-stats">${esc(rank.name)} · 💵 ${money(Storage.balance(prog))}</span>`;

    const [head, body] = newsFor(day);
    const taunt = chap.taunts[(day - 1) % chap.taunts.length];
    const nth = dayInChapter(day);
    const toNext = rank.next ? `${rank.toNext} rep to ${rank.next.name}` : "Top of the street!";
    const pct = rank.next ? Math.round(((Storage.rep(prog) - rank.at) / (rank.next.at - rank.at)) * 100) : 100;
    $("hero").innerHTML = `<section class="hero" style="--hue:${chap.hue}">
      <div class="hero-head"><span class="hero-ic">${chap.icon}</span>
        <div class="hero-txt"><span class="hero-eyebrow">${day > CAMPAIGN_DAYS ? "The Neighbourhood" : "Chapter " + chap.id} · Day ${nth} of ${DAYS_PER_CHAPTER}${isShowdown(day) ? " · SHOWDOWN" : ""}</span>
        <b class="hero-name">${esc(chap.name)}</b></div></div>
      <div class="hero-rival"><canvas data-who="rival" data-look='${JSON.stringify(chap.rival.look)}' width="52" height="52"></canvas>
        <div><b>${esc(chap.rival.name)}</b><span>${esc(taunt)}</span></div></div>
      <div class="pnn"><span class="pnn-tag">PNN</span><div><b>${esc(head)}</b><span>${esc(body)}</span></div></div>
      <div class="rank"><div class="rank-bar"><i style="width:${pct}%"></i></div><span>${esc(toNext)}</span></div>
      <button class="btn green big wide hero-go" onclick="App.startDay(${day})">🍕 Open for Day ${day}</button>
    </section>`;

    $("day-list").innerHTML = this.dayRails(day);
    this.paintTabs("today");
    GK.UI.showScreen("today");
    this.paintIcons($("hero"));
    this.centreRails();
  },

  dayRails(next) {
    const chapters = next > CAMPAIGN_DAYS ? [...CHAPTERS, ENDLESS] : CHAPTERS;
    const days = this.progress.days || {};
    return chapters.map((chap, ci) => {
      const first = ci * DAYS_PER_CHAPTER + 1;
      const count = chap === ENDLESS ? Math.max(DAYS_PER_CHAPTER, Math.ceil((next - CAMPAIGN_DAYS) / DAYS_PER_CHAPTER) * DAYS_PER_CHAPTER) : DAYS_PER_CHAPTER;
      const nums = Array.from({ length: count }, (_, k) => first + k);
      const locked = nums[0] > next;
      const got = nums.reduce((n, d) => n + ((days[d] && days[d].stars) || 0), 0);
      const beat = (this.progress.chapters || {})[chap.id];
      return `<section class="rail${locked ? " locked" : ""}" style="--week:${chap.hue}">
        <div class="rail-head"><i class="rail-bead"></i><span class="rail-icon">${locked ? "🔒" : chap.icon}</span>
          <h3>${chap === ENDLESS ? "" : "Ch " + chap.id + " · "}${esc(chap.name)}</h3>
          <span class="rail-count">${locked ? "locked" : beat ? "🏅 rival beaten" : `${got} of ${nums.length * 3} ★`}</span></div>
        <div class="chips">${nums.map((d) => this.dayChip(d, next, days[d])).join("")}</div></section>`;
    }).join("");
  },

  dayChip(d, next, rec) {
    const locked = d > next;
    const pips = locked ? "🔒" : "★★★".slice(0, rec ? rec.stars : 0).padEnd(3, "☆");
    return `<button class="chip${locked ? " locked" : ""}${d === next ? " next" : ""}${isShowdown(d) ? " big" : ""}"
      ${locked ? "disabled" : ""} onclick="App.startDay(${d})" aria-label="Day ${d}${locked ? ", locked" : `, ${rec ? rec.stars : 0} stars`}">
      <span class="chip-num">${isShowdown(d) ? "⚔️" : d}</span><span class="chip-name">Day ${d}${isShowdown(d) ? "<br>Showdown" : ""}</span>
      <span class="chip-stars">${pips}</span></button>`;
  },

  centreRails() {
    for (const row of document.querySelectorAll(".chips")) {
      const mark = row.querySelector(".chip.next") || [...row.querySelectorAll(".chip:not(.locked)")].pop();
      if (!mark) continue;
      row.scrollLeft = Math.max(0, mark.offsetLeft - (row.clientWidth - mark.offsetWidth) / 2);
    }
  },

  /* --------------------------------- opening up --------------------------------- */

  startDay(day) {
    this.fresh();
    this.pendingDay = day;
    const chap = chapterOf(day);
    const nth = dayInChapter(day);
    const [head, body] = newsFor(day);
    const kit = this.kit;
    let story = "";
    if (nth === 1 && day <= CAMPAIGN_DAYS + 1) story = `<p class="story">${esc(chap.intro)}</p>`;
    else if (isShowdown(day)) story = `<p class="story"><b>Showdown with ${esc(chap.rival.name)}.</b> A critic is coming at midday. Keep your pizzas right and your customers happy — and look after her order.</p>`;
    const replay = day < (this.progress.day || 1);
    $("open-title").textContent = `${chap.icon} Day ${day}${replay ? " (again)" : ""}`;
    $("open-body").innerHTML = story +
      `<div class="pnn small"><span class="pnn-tag">PNN</span><div><b>${esc(head)}</b><span>${esc(body)}</span></div></div>` +
      `<div class="sl-group"><h4>On the menu</h4><div class="sl-items">` +
      [...kit.tops].map((t) => `<span class="sl-item">${esc(TOP[t].name)}</span>`).join("") +
      `</div></div><p class="sl-crowd">⏱ Open ${Math.round(kit.dayLen / 60 * 10) / 10} min · 🔥 ${kit.ovenSlots} oven${kit.ovenSlots > 1 ? "s" : ""} · ${kit.ovenTime}s a trip</p>`;
    this.setSwitch($("sw-notes-open"), this.notesFor(day));
    GK.UI.openModal("modal-open");
  },

  // The written ticket is on unless you turn it off. Turning it off is the real
  // game — listen once, remember it — and it pays a bonus tip for doing it.
  notesFor() { const s = this.settings().notes; return s === undefined ? true : !!s; },
  tipsFor(day) { const s = this.settings().tips; return s === undefined ? day <= 5 : !!s; },

  setSwitch(el, on) { if (!el) return; el.classList.toggle("on", !!on); el.setAttribute("aria-checked", on ? "true" : "false"); el.textContent = on ? "ON" : "OFF"; },

  toggleNotes(el) {
    const on = !el.classList.contains("on");
    this.saveSetting("notes", on); this.notesOn = on;
    this.setSwitch($("sw-notes"), on); this.setSwitch($("sw-notes-open"), on);
    if (Game.running) { Game.notesOn = on; Render.setNotes(on); this.dockSig = ""; this.syncDock(); }
  },
  toggleTips(el) {
    const on = !el.classList.contains("on");
    this.saveSetting("tips", on); this.tipsOn = on;
    this.setSwitch($("sw-tips"), on);
    this.dockSig = ""; this.syncDock();
  },

  confirmOpen() {
    GK.UI.closeModal("modal-open");
    this.beginRun(this.pendingDay);
  },

  beginRun(day) {
    this.fresh();
    GK.Sfx.init();
    this.token++; this.paused = false; this.drag = null; this.dockSig = "";
    this.notesOn = this.notesFor(day); this.tipsOn = this.tipsFor(day);
    Fx.reset();
    Render.sprites.clear(); Render.leavers = []; Render.bubble = null; Render.ghost = null; Render.brush = null; Render.cutPreview = null;
    Render.born = new WeakMap();
    Render.decor = decorLook(this.progress); Render.chapter = chapterOf(day); Render.bgKey = "";
    Render.tipFill = 0; Render.till = "$0.00"; Render.notesOn = this.notesOn;
    Game.start({ day, kit: this.kit, seed: this.profile.id, notes: this.notesOn });
    this.ui = { tab: "sauce", sauce: "tomato", top: null };
    $("receipt").classList.remove("on"); $("hintbox").classList.remove("on");
    GK.UI.showScreen("game");
    Render.resize(); Render.layout();
    this.syncDock(); this.updateHud(true);
    GK.Sfx.openUp();
  },

  /* ----------------------------------- the dock ----------------------------------- */

  onLayout(lay) {
    // pin the two talk buttons to the corners of the kitchen
    const top = (lay.ky0 + lay.ticketH) * Render.scale + 6;
    for (const id of ["btn-what", "btn-hint"]) $(id).style.top = top + "px";
    $("hintbox").style.top = top + 40 + "px";       // the checklist drops over the table, not over the customer
  },

  focusOrder() { return Game.order(Game.focus); },

  syncDock() {
    if (!Game.running) return;
    const o = this.focusOrder();
    const p = o && o.pizza;
    const sig = [Game.focus, o && o.phase, this.ui.tab, this.ui.sauce, this.ui.top, Game.ovenFree, !!Game.line[0], Game.open.length,
      p && p.runs, p && p.cuts.length, this.tipsOn, Game.kit.sauces.size, Game.kit.tops.size].join("|");
    if (sig === this.dockSig) { this.live(); return; }
    this.dockSig = sig;
    Render.setTicketRows(o && this.notesOn ? Render.ticketRowsFor(o.order) : 0);

    const tabs = $("dock-tabs"), strip = $("dock-strip"), row = $("dock-row");
    $("btn-what").style.display = o ? "" : "none";
    $("btn-hint").style.display = o ? "" : "none";
    tabs.innerHTML = ""; strip.innerHTML = "";
    tabs.style.display = "none"; strip.style.display = "none";

    if (!o) {
      const c = Game.line[0];
      if (!c) row.innerHTML = `<div class="dstatus">Waiting for the next customer…</div>`;
      else if (Game.open.length >= MAX_OPEN) row.innerHTML = `<div class="dstatus">Kitchen's full — finish a pizza first.</div>`;
      else row.innerHTML = `<button class="dbtn go" onclick="App.takeOrder()">🛎 Take ${esc(c.entry.name)}'s order</button>`;
    } else if (o.phase === "build") {
      tabs.style.display = ""; strip.style.display = "";
      const sauceOk = sauceCoverage(p) > 0.5 && p.sauce, cheeseOk = cheeseDensity(p) > 0.3;
      tabs.innerHTML = [
        ["sauce", "🥄", "Sauce", sauceOk ? "✓" : ""],
        ["cheese", "🧀", "Cheese", cheeseOk ? "✓" : ""],
        ["tops", "🍄", "Toppings", p.tops.length ? p.tops.length : ""],
      ].map(([id, ic, label, badge]) => `<button class="dtab${this.ui.tab === id ? " on" : ""}" onclick="App.setTab('${id}')">
        <span>${ic}</span>${label}${badge ? `<em>${badge}</em>` : ""}</button>`).join("");
      strip.innerHTML = this.stripBuild(o);
      this.paintIcons(strip);
      row.innerHTML = `<button class="dbtn small" onclick="App.undoTop()" aria-label="Undo the last topping">↶</button>
        <button class="dbtn small" onclick="App.bin()" aria-label="Bin this pizza and start again">🗑</button>
        <button class="dbtn go${Game.ovenFree ? "" : " wait"}" onclick="App.toOven()">${Game.ovenFree ? "🔥 To the oven" : "⏳ Oven busy"}</button>`;
    } else if (o.phase === "oven") {
      strip.style.display = "";
      strip.innerHTML = `<div class="dstatus" id="live-oven"></div>`;
      const front = Game.line[0] && Game.open.length < MAX_OPEN;
      row.innerHTML = front
        ? `<button class="dbtn go" onclick="App.takeOrder()">🛎 Take ${esc(Game.line[0].entry.name)}'s order</button>`
        : `<div class="dstatus">Tap another ticket to keep busy.</div>`;
    } else if (o.phase === "baked") {
      strip.style.display = "";
      strip.innerHTML = `<div class="dstatus">Out after ${p.runs} trip${p.runs > 1 ? "s" : ""} — <b>${BAKES[Math.min(3, p.runs - 1)].name.toLowerCase()}</b>.</div>`;
      row.innerHTML = `<button class="dbtn${Game.ovenFree && p.runs < 4 ? "" : " wait"}" onclick="App.toOven()">🔥 Another trip</button>
        <button class="dbtn go" onclick="App.toCut()">🔪 Cut it</button>`;
      row.querySelector(".dbtn").textContent = p.runs < 4 ? "🔥 Again" : "🔥 Max";
    } else if (o.phase === "cut") {
      strip.style.display = "";
      strip.innerHTML = `<div class="dstatus" id="live-cut"></div>`;
      row.innerHTML = `<button class="dbtn small" onclick="App.undoCut()" aria-label="Undo the last cut">↶ Undo cut</button>
        <button class="dbtn go" onclick="App.box()">📦 Box it</button>`;
    } else {
      strip.style.display = "";
      strip.innerHTML = `<div class="dstatus">Boxed and ready for <b>${esc(o.cust.entry.name)}</b>.</div>`;
      row.innerHTML = `<button class="dbtn go" onclick="App.serve()">🛎 Hand it over</button>`;
    }
    Render.hint = this.coach(o);
    this.live();
  },

  stripBuild(o) {
    const t = this.ui.tab;
    if (t === "sauce") {
      return `<div class="bins">${SAUCES.filter((s) => Game.kit.sauces.has(s.id)).map((s) => `
        <button class="bin${this.ui.sauce === s.id ? " on" : ""}" onclick="App.pickSauce('${s.id}')">
          <canvas data-sauce="${s.id}"></canvas><b>${esc(s.name)}</b><i>${s.cost}¢</i></button>`).join("")}</div>`;
    }
    if (t === "cheese") {
      return `<div class="cheese-row"><button class="bin on"><canvas data-cheese="1"></canvas><b>Cheese</b><i>drag it on</i></button>
        <div class="meter"><div class="meter-bar"><span class="z0"></span><span class="z1"></span><span class="z2"></span><i id="cheese-pin"></i></div>
        <div class="meter-lab"><span>light</span><span>normal</span><span>extra</span></div></div></div>`;
    }
    return `<div class="bins">${TOPPINGS.filter((x) => Game.kit.tops.has(x.id)).map((x) => `
      <button class="bin${this.ui.top === x.id ? " on" : ""}" onclick="App.pickTop('${x.id}')">
        <canvas data-top="${x.id}"></canvas><b>${esc(x.name)}</b><i>${x.cost}¢</i></button>`).join("")}</div>`;
  },

  // Everything in the dock that changes without the dock being rebuilt.
  live() {
    const o = this.focusOrder();
    if (!o) return;
    if (o.phase === "oven") {
      const el = $("live-oven");
      if (el) el.innerHTML = `🔥 Trip <b>${o.pizza.runs + 1}</b> — <b>${Math.max(0, Math.ceil(Game.kit.ovenTime - o.ovenT))}s</b> to go`;
    } else if (o.phase === "cut") {
      const el = $("live-cut");
      if (el) {
        const need = o.order.slices, have = slicesOf(o.pizza);
        el.innerHTML = o.pizza.cuts.length ? `${o.pizza.cuts.length} cut${o.pizza.cuts.length > 1 ? "s" : ""} → <b>${have} slices</b>` : `Not cut yet`;
      }
    } else if (o.phase === "build" && this.ui.tab === "cheese") {
      const pin = $("cheese-pin");
      if (pin) { const d = cheeseDensity(o.pizza); pin.style.left = Math.min(100, (d / 2.8) * 100) + "%"; }
    }
  },

  coach(o) {
    if (!this.tipsOn) return "";
    if (!o) return Game.line[0] ? "Tap the customer to take their order" : "Waiting for a customer…";
    switch (o.phase) {
      case "build": {
        if (this.ui.tab === "sauce") return o.pizza.sauce ? "Drag to spread — leave the crust bare" : "Drag the sauce over the dough";
        if (this.ui.tab === "cheese") return "Sprinkle cheese — go over twice for extra";
        return this.ui.top ? `Tap or drag to place ${TOP[this.ui.top].plural}` : "Pick a topping from the bins";
      }
      case "oven": return "Baking — tap another ticket to stay busy";
      case "baked": return "Out! Another trip for crispier, or cut it";
      case "cut": return "Swipe across the middle to cut";
      default: return "Boxed — hand it over!";
    }
  },

  setTab(id) { this.ui.tab = id; this.dockSig = ""; Render.ghost = null; Render.brush = null; GK.Sfx.pick(); this.syncDock(); },
  pickSauce(id) { this.ui.sauce = id; this.dockSig = ""; GK.Sfx.pick(); this.syncDock(); },
  pickTop(id) {
    this.ui.top = this.ui.top === id ? null : id;       // tap the bin again to put it away
    this.dockSig = ""; Render.ghost = null; GK.Sfx.pick(); this.syncDock();
  },

  /* ---------------------------------- actions ---------------------------------- */

  say(res) {
    if (res.ok) return true;
    GK.Sfx.nope();
    if (EXCUSES[res.why]) GK.UI.toast(EXCUSES[res.why]);
    return false;
  },

  takeOrder() {
    if (this.paused || !Game.running) return;
    if (!this.say(Game.takeOrder())) return;
    this.dockSig = ""; this.syncDock();
  },

  focus(id) {
    if (Game.setFocus(id)) { this.dockSig = ""; Render.ghost = null; Render.brush = null; GK.Sfx.pick(); this.syncDock(); this.hideHint(); }
  },

  what() {
    const o = this.focusOrder(); if (!o || this.paused) return;
    this.say(Game.what(o.id));
  },

  hint() {
    const o = this.focusOrder(); if (!o || this.paused) return;
    const r = Game.hint(o.id);
    if (!this.say(r)) return;
    GK.Sfx.what();
    const box = $("hintbox");
    box.innerHTML = `<b>Checklist</b>${r.lines.map((l) => `<span>• ${esc(l)}</span>`).join("")}`;
    box.classList.add("on");
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.hideHint(), 7000);
  },
  hideHint() { clearTimeout(this.hintTimer); $("hintbox").classList.remove("on"); },

  undoTop() { const o = this.focusOrder(); if (!o) return; if (this.say(Game.undoTopping(o.id))) { GK.Sfx.pick(); this.dockSig = ""; this.syncDock(); } },
  undoCut() { const o = this.focusOrder(); if (!o) return; if (this.say(Game.undoCut(o.id))) { GK.Sfx.pick(); this.dockSig = ""; this.syncDock(); } },

  bin() {
    const o = this.focusOrder(); if (!o) return;
    const r = Game.discard(o.id);
    if (!this.say(r)) return;
    GK.Sfx.nope();
    GK.UI.toast(r.cost > 60 ? `Binned it — ${money(r.cost)} of ingredients gone.` : "Fresh dough.");
    this.dockSig = ""; this.syncDock();
  },

  toOven() {
    const o = this.focusOrder(); if (!o) return;
    if (!this.say(Game.toOven(o.id))) return;
    GK.Sfx.oven(); this.dockSig = ""; this.syncDock();
  },

  toCut() { const o = this.focusOrder(); if (!o) return; if (this.say(Game.toCut(o.id))) { GK.Sfx.pick(); this.dockSig = ""; this.syncDock(); } },

  box() {
    const o = this.focusOrder(); if (!o) return;
    if (!this.say(Game.box(o.id))) return;
    GK.Sfx.box(); this.dockSig = ""; this.syncDock();
  },

  serve() {
    const o = this.focusOrder(); if (!o) return;
    const r = Game.serve(o.id);
    this.say(r);
    this.dockSig = ""; this.syncDock();
  },

  /* ----------------------------------- pointer ----------------------------------- */

  pointer(kind, lx, ly, e) {
    if (!Game.running || this.paused) return;
    const o = this.focusOrder();
    if (kind === "down") {
      this.drag = null;
      if (Render.inLobby(lx, ly)) { if (Game.line[0]) this.takeOrder(); return; }
      const rid = Render.railAt(lx, ly);
      if (rid) { this.focus(rid); return; }
      if (!o) { if (Game.line[0]) GK.UI.toast("Tap the customer to take their order."); return; }
      this.kitchenDown(o, lx, ly);
    } else if (kind === "move") {
      if (this.drag) this.dragTo(o, lx, ly);
      else if (e.pointerType === "mouse") this.hover(o, lx, ly);
    } else if (kind === "up") {
      if (this.drag) this.dragEnd(o, lx, ly);
      this.drag = null;
      if (e.pointerType !== "mouse") { Render.ghost = null; Render.brush = null; }
    } else if (kind === "hover-out") { Render.ghost = null; Render.brush = null; }
  },

  hover(o, lx, ly) {
    Render.ghost = null; Render.brush = null;
    if (!o || o.phase !== "build" || !Render.onPizza(lx, ly)) return;
    if (this.ui.tab === "tops" && this.ui.top) { const [px, py] = Render.toPizza(lx, ly); Render.ghost = { t: this.ui.top, x: px, y: py }; }
    else if (this.ui.tab === "sauce") Render.brush = { x: lx, y: ly, r: Game.kit.sauceR * Render.lay.pz.R, kind: "sauce", sauce: this.ui.sauce };
    else if (this.ui.tab === "cheese") Render.brush = { x: lx, y: ly, r: Game.kit.cheeseR * Render.lay.pz.R, kind: "cheese" };
  },

  kitchenDown(o, lx, ly) {
    if (o.phase === "oven") { GK.UI.toast(EXCUSES.inoven); return; }
    if (o.phase === "baked") { GK.UI.toast("Another trip, or cut it — buttons below."); return; }
    if (o.phase === "ready") { GK.UI.toast("Boxed! Hand it over."); return; }
    if (o.phase === "cut") {
      if (!Render.onPizza(lx, ly, 1.35)) return;
      this.drag = { mode: "cut", ax: lx, ay: ly };
      Render.cutPreview = { ax: lx, ay: ly, bx: lx, by: ly };
      return;
    }
    // build
    if (!Render.onPizza(lx, ly, 1.0)) return;
    const mode = this.ui.tab;
    if (mode === "tops" && !this.ui.top) { GK.UI.toast("Pick a topping from the bins first."); return; }
    this.drag = { mode, last: [lx, ly], placed: [lx, ly], t: 0 };
    this.stroke(o, lx, ly, true);
  },

  stroke(o, lx, ly, first) {
    const [px, py] = Render.toPizza(lx, ly);
    const d = this.drag, R = Render.lay.pz.R, now = performance.now();
    if (d.mode === "sauce") {
      Game.paintSauce(o.id, this.ui.sauce, px, py);
      Render.brush = { x: lx, y: ly, r: Game.kit.sauceR * R, kind: "sauce", sauce: this.ui.sauce };
      if (now - this.lastSound > 110) { GK.Sfx.slosh(); this.lastSound = now; }
    } else if (d.mode === "cheese") {
      Game.sprinkle(o.id, px, py);
      Render.brush = { x: lx, y: ly, r: Game.kit.cheeseR * R, kind: "cheese" };
      if (now - this.lastSound > 70) { GK.Sfx.shake(); this.lastSound = now; }
    } else if (d.mode === "tops") {
      const r = Game.drop(o.id, this.ui.top, px, py);
      if (r.ok) { GK.Sfx.flap(this.ui.top); d.placed = [lx, ly]; }
      else if (first || r.why === "toomany") this.say(r);
      Render.ghost = { t: this.ui.top, x: px, y: py };
    }
  },

  dragTo(o, lx, ly) {
    const d = this.drag; if (!d || !o) return;
    const R = Render.lay.pz.R;
    if (d.mode === "cut") { Render.cutPreview = { ax: d.ax, ay: d.ay, bx: lx, by: ly }; return; }
    if (o.phase !== "build") return;
    if (d.mode === "tops") {
      Render.ghost = { t: this.ui.top, x: Render.toPizza(lx, ly)[0], y: Render.toPizza(lx, ly)[1] };
      if (Math.hypot(lx - d.placed[0], ly - d.placed[1]) >= R * 0.23 && Render.onPizza(lx, ly, 0.96)) this.stroke(o, lx, ly, false);
      return;
    }
    const step = d.mode === "sauce" ? Game.kit.sauceR * R * 0.5 : R * 0.05;
    const dx = lx - d.last[0], dy = ly - d.last[1], dist = Math.hypot(dx, dy);
    const n = Math.min(40, Math.floor(dist / step));
    for (let i = 1; i <= n; i++) this.stroke(o, d.last[0] + dx * i / n, d.last[1] + dy * i / n, false);
    if (n) d.last = [lx, ly];
    Render.brush = { x: lx, y: ly, r: (d.mode === "sauce" ? Game.kit.sauceR : Game.kit.cheeseR) * R, kind: d.mode, sauce: this.ui.sauce };
  },

  dragEnd(o, lx, ly) {
    const d = this.drag;
    Render.cutPreview = null;
    if (d.mode === "build" || !o) return;
    if (d.mode === "cut" && o.phase === "cut") {
      const R = Render.lay.pz.R;
      const [ax, ay] = Render.toPizza(d.ax, d.ay), [bx, by] = Render.toPizza(lx, ly);
      const len = Math.hypot(lx - d.ax, ly - d.ay);
      if (len < R * 0.8 || lineDistToCentre(ax, ay, bx, by) > 0.4) { GK.Sfx.nope(); GK.UI.toast("Swipe straight across the middle."); return; }
      const r = Game.cut(o.id, Math.atan2(by - ay, bx - ax));
      if (this.say(r)) { GK.Sfx.slice(); this.dockSig = ""; this.syncDock(); }
    } else if (d.mode !== "cut") { this.dockSig = ""; this.syncDock(); }
    // after a painting stroke the tab ticks may have changed
    if (o.phase === "build") { this.dockSig = ""; this.syncDock(); }
  },

  /* ----------------------------------- events ----------------------------------- */

  wireGame() {
    Game.on = {
      arrive: () => { GK.Sfx.doorbell(); this.dockSig = ""; this.syncDock(); },
      order: (o) => {
        GK.Sfx.order();
        Render.say(o.cust.entry.name, o.cust.speech, { hold: Math.max(4, o.cust.speech.length * 0.035), orderId: o.id });
        if (o.order.recipe) Storage.seeRecipe(this.profile.id, o.order.recipe);
        if (o.order.recipes) for (const r of o.order.recipes) Storage.seeRecipe(this.profile.id, r);
        this.ui.tab = "sauce"; this.ui.top = null; this.hideHint();
      },
      what: (o) => { GK.Sfx.what(); Render.say(o.cust.entry.name, o.cust.speech, { hold: Math.max(4, o.cust.speech.length * 0.035), orderId: o.id }); },
      oven: () => {},
      ding: (o) => {
        GK.Sfx.ding();
        if (Game.focus !== o.id) GK.UI.toast(`🔔 ${o.cust.entry.name}'s pizza is out!`);
        this.dockSig = ""; this.syncDock();
      },
      served: (res) => this.onServed(res),
      left: (e) => {
        GK.Sfx.gaveUp();
        Render.leave(e.cust, "left", reaction(e.cust.entry, "left", RNG.make(e.cust.id * 7)), 0);
        GK.UI.toast(`${e.cust.entry.name} got tired of waiting and left.`);
        Fx.addShake(2);
        this.dockSig = ""; this.syncDock();
      },
      closing: () => { GK.Sfx.closeUp(); GK.UI.toast("🌙 Closing time! Finish the orders in hand."); },
      discard: () => {},
      cut: () => { this.dockSig = ""; },
      end: (res) => this.onEnd(res),
    };
  },

  onServed(res) {
    const kind = res.refund ? "refund" : res.stars >= 4 ? "happy" : res.stars >= 3 ? "okay" : "poor";
    const text = reaction(res.entry, kind === "okay" || kind === "poor" ? kind : kind, RNG.make(res.id * 13 + res.stars));
    Render.leave(res.cust, res.refund ? "refund" : "happy", text, res.stars);
    if (res.refund) { GK.Sfx.nope(); Fx.addShake(3); }
    else {
      GK.Sfx.cash(res.tip + res.pay);
      for (let i = 0; i < res.stars; i++) setTimeout(() => GK.Sfx.star(i), 120 + i * 90);
      Fx.text(Render.W * 0.6, Render.lay.LZ - 90, "+" + money(res.pay + res.tip), { color: "#f2c230", size: 17 });
      if (res.stars === 5) { Fx.confetti(Render.W, Render.H * 0.6, ["#e4572e", "#f2c230", "#5aa84e", "#f08fb0"], 40); }
    }
    this.showReceipt(res);
    this.dockSig = ""; this.syncDock(); this.updateHud(true);
  },

  showReceipt(res) {
    const box = $("receipt");
    const rows = res.notes.slice(0, 6).map((n) => `<li class="${n.ok ? "ok" : n.soft ? "meh" : "bad"}">${n.ok ? "✔" : n.soft ? "•" : "✘"} ${esc(n.text)}</li>`).join("");
    const memory = res.remembered && !res.refund ? `<li class="ok">🧠 Remembered it unaided — bonus tip!</li>` : "";
    box.innerHTML = `<div class="rc${res.refund ? " bad" : ""}">
      <canvas class="rc-pie" id="rc-pie"></canvas>
      <div class="rc-main"><div class="rc-top"><b>${esc(res.entry.name)}</b>
        <span class="rc-stars">${res.refund ? "Refund" : stars(res.stars)}</span></div>
      <ul>${rows}${memory}</ul>
      <div class="rc-nums">${res.refund ? "No sale" : `Sale ${money(res.pay)} + tip ${money(res.tip)}`} − supplies ${money(res.supplies)} = <b class="${res.profit < 0 ? "neg" : ""}">${money(res.profit)}</b></div></div></div>`;
    box.classList.add("on");
    const pie = $("rc-pie"); pie._pizza = res.pizza; pie._heat = Math.min(4, res.pizza.runs);
    this.paintMiniPie(pie);
    clearTimeout(this.receiptTimer);
    this.receiptTimer = setTimeout(() => box.classList.remove("on"), res.refund ? 6500 : 5200);
  },

  updateHud(force) {
    $("hud-day").textContent = `Day ${Game.day}`;
    $("hud-clock").textContent = Game.closing ? "Closing" : Game.clock;
    $("hud-clock-fill").style.width = Math.min(100, (Game.t / Game.dayLen) * 100) + "%";
    const take = Game.stats.revenue + Game.stats.tips;
    $("hud-money").textContent = money(take - Game.stats.supplies);
    Render.till = money(take);
    Render.tipFill = Math.min(1, Game.stats.tips / 1500);
  },

  /* --------------------------------- pause & quit --------------------------------- */

  pause() {
    if (!Game.running || this.paused) return;
    this.paused = true;
    this.setSwitch($("sw-notes"), this.notesOn); this.setSwitch($("sw-tips"), this.tipsOn);
    GK.UI.openModal("modal-pause");
  },
  resume() { GK.UI.closeModal("modal-pause"); this.paused = false; this.lastTs = 0; },
  quit() {
    GK.UI.closeModal("modal-pause");
    Game.running = false; this.paused = false; this.token++;
    this.showToday();
  },
  showHelp() { GK.UI.openModal("modal-help"); },
  closeHelp() { GK.UI.closeModal("modal-help"); },

  /* ----------------------------------- the end ----------------------------------- */

  onEnd(res) {
    const my = this.token;
    this.hideHint();
    this.progress = Storage.recordDay(this.profile.id, res);
    setTimeout(() => { if (my === this.token) this.showResults(res); }, 900);
  },

  showResults(res) {
    const prog = this.fresh();
    const chap = chapterOf(res.day);
    const rank = rankFor(Storage.rep(prog));
    $("res-day").textContent = `Day ${res.day} · ${chap.name}`;
    $("res-title").textContent = res.stars === 3 ? "A perfect day!" : res.stars === 2 ? "A good day" : res.stars === 1 ? "Day done" : "A quiet day";
    $("res-stars").innerHTML = [0, 1, 2].map((i) => `<span class="res-star" data-i="${i}">★</span>`).join("");
    const row = (k, v, cls = "") => `<div class="rr ${cls}"><span>${k}</span><b>${v}</b></div>`;
    $("res-card").innerHTML =
      row("Pizzas served", res.served - res.refunds) +
      (res.refunds ? row("Sent back", res.refunds, "bad") : "") +
      (res.left ? row("Gave up waiting", res.left, "bad") : "") +
      row("Average rating", res.avgStars ? stars(Math.round(res.avgStars)) : "—") +
      row("Sales", money(res.sales)) + row("Tips", money(res.tips)) + row("Supplies", "−" + money(res.supplies)) +
      row("Profit", money(res.profit), "total " + (res.profit < 0 ? "bad" : "")) +
      row("Shop rating", `${res.rep >= 0 ? "+" : ""}${res.rep} · ${esc(rank.name)}`);
    const [head, body] = newsFor(res.day);
    $("res-pnn").innerHTML = `<span class="pnn-tag">PNN</span><div><b>${esc(head)}</b><span>${esc(recapLine(res))}</span></div>`;
    let story = "";
    if (res.showdown) story = res.showdown.beat ? `🏅 <b>You beat ${esc(chap.rival.name)}!</b> ${esc(chap.win)}` : `${esc(chap.rival.name)} holds on — this time. ${esc(chap.lose)} Replay the day for the badge.`;
    $("res-story").innerHTML = story;
    const next = prog.day;
    $("res-next").textContent = `Day ${next} ▶`; $("res-next").onclick = () => this.startDay(next);
    const retry = $("res-retry"); retry.style.display = res.stars < 3 ? "" : "none";
    retry.textContent = "↻ Again"; retry.onclick = () => this.startDay(res.day);
    GK.UI.showScreen("results");
    const my = this.token;
    GK.Sfx.closeUp();
    for (let i = 0; i < res.stars; i++) setTimeout(() => {
      if (my !== this.token) return;
      const el = document.querySelector(`.res-star[data-i="${i}"]`);
      if (el) el.classList.add("on");
      GK.Sfx.star(i);
    }, 500 + i * 380);
    if (res.stars === 3) setTimeout(() => { if (my === this.token) GK.Fx.confetti && Fx.confetti(window.innerWidth, window.innerHeight * 0.6, ["#e4572e", "#f2c230", "#5aa84e", "#f08fb0"], 60); }, 800);
  },

  /* ----------------------------------- kitchen ----------------------------------- */

  showKitchen() {
    const prog = this.fresh();
    const bal = Storage.balance(prog);
    $("kitchen-money").textContent = money(bal);
    const card = (kind, def) => {
      const owned = def.unlock === 0 || (prog.menu || {})[kind + ":" + def.id];
      const can = bal >= def.unlock;
      const art = kind === "t" ? `<canvas data-top="${def.id}"></canvas>` : `<canvas data-sauce="${def.id}"></canvas>`;
      return `<div class="ing${owned ? " owned" : ""}">${art}<b>${esc(def.name)}</b>
        ${owned ? `<span class="have">✓ stocked</span>` : `<button class="btn small${can ? "" : " grey"}" ${can ? "" : "disabled"} onclick="App.buyIng('${kind}','${def.id}')">${money(def.unlock)}</button>`}</div>`;
    };
    $("ing-grid").innerHTML = TOPPINGS.map((t) => card("t", t)).join("") + SAUCES.map((s) => card("s", s)).join("");
    $("upgrade-list").innerHTML = UPGRADES.map((u) => {
      const lvl = upgradeLevel(prog, u.id), maxed = lvl >= u.costs.length;
      const cost = maxed ? 0 : u.costs[lvl], can = bal >= cost;
      return `<div class="shop-item"><span class="si-icon">${u.icon}</span>
        <div class="si-text"><b>${esc(u.name)}</b>
          <span class="si-pips">${"●".repeat(lvl)}${"○".repeat(u.costs.length - lvl)}</span>
          <span class="si-desc">${esc(u.desc)} <i>(${esc(u.effect(lvl))}${maxed ? "" : " → " + esc(u.effect(lvl + 1))})</i></span></div>
        ${maxed ? `<span class="have">MAX</span>` : `<button class="btn small${can ? "" : " grey"}" ${can ? "" : "disabled"} onclick="App.buyUp('${u.id}')">${money(cost)}</button>`}</div>`;
    }).join("");
    this.paintTabs("kitchen");
    GK.UI.showScreen("kitchen");
    this.paintIcons($("ing-grid"));
  },

  buyIng(kind, id) {
    const r = Storage.buyIngredient(this.profile.id, kind, id);
    if (!r.ok) { GK.Sfx.nope(); return; }
    GK.Sfx.purchase();
    const name = kind === "t" ? TOP[id].name : SAUCE[id].name;
    GK.UI.toast(`${name} is on the menu — customers will start asking for it.`);
    this.showKitchen();
  },
  buyUp(id) {
    const r = Storage.buyUpgrade(this.profile.id, id);
    if (!r.ok) { GK.Sfx.nope(); return; }
    GK.Sfx.purchase(); GK.UI.toast(`${UPGRADE[id].name} upgraded!`); this.showKitchen();
  },

  /* ------------------------------------ decor ------------------------------------ */

  showDecor() {
    const prog = this.fresh();
    const bal = Storage.balance(prog);
    $("decor-money").textContent = money(bal);
    const look = decorLook(prog);
    const groups = [["wall", "Walls"], ["floor", "Floors"], ["sign", "Window sign"], ["props", "Extras"]];
    $("decor-body").innerHTML = groups.map(([g, title]) => `
      <h3 class="sec-head">${title}</h3>
      <div class="decor-grid">${DECOR[g].map((d) => {
        const owned = ownsDecor(prog, g, d.id);
        const on = g === "props" ? owned : look[g].id === d.id;
        const sw = g === "wall" ? `background:linear-gradient(180deg,${d.top},${d.bot})`
          : g === "floor" ? `background:conic-gradient(${d.a} 25%,${d.b} 0 50%,${d.a} 0 75%,${d.b} 0) 0 0/16px 16px`
          : g === "sign" ? `background:#2a1c24;color:${d.color};text-shadow:0 0 8px ${d.color}` : "";
        const label = g === "props" ? `<span class="sw-ic">${d.icon}</span>` : g === "sign" ? `<span class="sw-neon">${d.text}</span>` : "";
        const action = !owned
          ? `<button class="btn small${bal >= d.cost ? "" : " grey"}" ${bal >= d.cost ? "" : "disabled"} onclick="App.buyDec('${g}','${d.id}')">${money(d.cost)}</button>`
          : g === "props" ? `<span class="have">✓ up</span>`
          : on ? `<span class="have">✓ in use</span>` : `<button class="btn small ghost" onclick="App.useDec('${g}','${d.id}')">Use</button>`;
        return `<div class="dec${on ? " on" : ""}"><div class="swatch" style="${sw}">${label}</div><b>${esc(d.name)}</b>${action}</div>`;
      }).join("")}</div>`).join("");
    this.paintTabs("decor");
    GK.UI.showScreen("decor");
  },
  buyDec(g, id) {
    const r = Storage.buyDecor(this.profile.id, g, id);
    if (!r.ok) { GK.Sfx.nope(); return; }
    GK.Sfx.purchase(); GK.UI.toast("It's up in the shop!"); this.showDecor();
  },
  useDec(g, id) { Storage.chooseDecor(this.profile.id, g, id); GK.Sfx.pick(); this.showDecor(); },

  /* ------------------------------------- book ------------------------------------- */

  showBook() {
    const prog = this.fresh();
    const seen = prog.recipesSeen || {}, met = prog.met || {};
    const nSeen = RECIPES.filter((r) => seen[r.id]).length;
    const nMet = ROSTER.filter((c) => met[c.id]).length;
    $("book-count").textContent = `${nSeen}/${RECIPES.length} · ${nMet}/${ROSTER.length - 1}`;
    $("recipe-list").innerHTML = RECIPES.map((r) => {
      const known = seen[r.id];
      return known
        ? `<div class="recipe"><b>${esc(r.name)}</b><div class="rc-ing">${r.sauce ? `<span class="sl-item">${esc(SAUCE[r.sauce].name)} sauce</span>` : ""}${r.tops.map((t) => `<span class="sl-item">${ICON[t]} ${esc(TOP[t].name)}</span>`).join("")}</div><span class="reg-blurb">${esc(r.blurb)}</span></div>`
        : `<div class="recipe locked"><b>? ? ?</b><span class="reg-blurb">Somebody will ask for this around chapter ${r.chapter}.</span></div>`;
    }).join("");
    $("album-list").innerHTML = ROSTER.filter((c) => c.id !== "critic" || met.critic).map((c) => {
      const n = met[c.id] || 0;
      return `<div class="regular${n ? " known" : ""}"><canvas class="reg-face" data-who="${c.id}" width="52" height="52"></canvas>
        <div class="reg-text"><b>${n ? esc(c.name) : "???"}</b>
        <span class="reg-blurb">${n >= 2 ? esc(c.blurb) : n ? "You're getting to know them…" : `Turns up from around day ${c.from}.`}</span>
        ${n ? `<span class="reg-breaks">served ${n}×</span>` : ""}</div></div>`;
    }).join("");
    this.paintTabs("book");
    GK.UI.showScreen("book");
    this.paintIcons($("album-list"));
  },

  /* ----------------------------------- leaderboard ----------------------------------- */

  showLeaderboard() {
    this.fresh();
    this.paintTabs("leaderboard");
    GK.UI.showScreen("leaderboard");
    GK.Profiles.renderLeaderboard("lb-rows", {
      cols: (r) => `<span class="lb-stat">Day ${r.progress.day || 1}</span><span class="lb-stat">⭐${Storage.totalStars(r.progress)}</span><span class="lb-stat">💵 ${money(r.progress.earned || 0)}</span>`,
      sort: (a, b) => ((b.progress.day || 1) - (a.progress.day || 1)) || ((b.progress.earned || 0) - (a.progress.earned || 0)),
      meId: this.profile && this.profile.id,
      empty: "No cooks yet — open the shop!",
    });
  },

  /* ----------------------------------- frame loop ----------------------------------- */

  frame(ts) {
    const dt = this.lastTs ? Math.max(0, Math.min(0.05, (ts - this.lastTs) / 1000)) : 0;
    this.lastTs = ts;
    if (this.active) {
      if (!this.paused && Game.running) {
        Game.update(dt);
        this.hudAcc += dt;
        if (this.hudAcc > 0.1) { this.hudAcc = 0; this.updateHud(); this.syncDock(); }
      }
      Render.frame(this.paused ? 0 : dt);
    }
    requestAnimationFrame((t) => this.frame(t));
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());

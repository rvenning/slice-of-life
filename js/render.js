// Slice of Life — the stage. One canvas, three bands:
//
//   LOBBY    the front of the shop: the line, the counter, the speech bubble
//   RAIL     a ticket for every pizza in the kitchen (tap one to work on it)
//   KITCHEN  the pizza on the board — or in the oven, or in its box
//
// The logical stage is always 360 wide; its height follows the device, and
// everything is placed from the three band heights, so a tall phone gets a
// bigger pizza rather than a letterbox. The renderer only READS the game; what
// a tap or a drag means lives in main.js.

const FONT = `"Baloo 2", system-ui, sans-serif`;
const LOGICAL_W = 360;
const RAIL_H = 52;

// Where the people stand in the lobby, front of the line first.
const SLOT_X = [0.60, 0.36, 0.15, 0.84];
const SLOT_S = [1, 0.86, 0.74, 0.7];
const SLOT_Y = [26, 36, 44, 42];                  // distance above the counter's top edge

const PHASE_STYLE = {
  build: { fill: "#fff7e8", tag: "Making", icon: "🍕" },
  oven:  { fill: "#ffd9a8", tag: "Baking", icon: "🔥" },
  baked: { fill: "#d9f2c9", tag: "Ding!",  icon: "♨️" },
  cut:   { fill: "#e6e0f7", tag: "Cut it", icon: "🔪" },
  ready: { fill: "#c9ecc6", tag: "Boxed",  icon: "📦" },
};

const Render = {
  cv: null, ctx: null, stage: null, dpr: 1, scale: 1, W: LOGICAL_W, H: 560, ok: false,
  lay: null, now: 0,
  sprites: new Map(), leavers: [], bubble: null, born: new WeakMap(),
  ghost: null, brush: null, cutPreview: null, hint: "", tipFill: 0, decor: null, chapter: null,
  railHits: [], bgKey: "", bg: null, kbg: null, onPointer: null, nameTags: true,

  boot() {
    this.cv = document.getElementById("cv");
    this.stage = document.getElementById("stage");
    this.ctx = this.cv.getContext("2d");
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const down = (e) => this.pointer("down", e);
    const move = (e) => this.pointer("move", e);
    const up = (e) => this.pointer("up", e);
    this.cv.addEventListener("pointerdown", down);
    this.cv.addEventListener("pointermove", move);
    this.cv.addEventListener("pointerup", up);
    this.cv.addEventListener("pointercancel", up);
    this.cv.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !e.buttons) this.pointer("hover-out", e); });
    // some iOS builds are stingy with pointermove during a fast swipe
    this.cv.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(this.stage);
    window.addEventListener("resize", () => this.resize());
    this.resize();
  },

  /* -------------------------------- layout -------------------------------- */

  resize() {
    const b = this.stage.getBoundingClientRect();
    if (b.width < 50 || b.height < 50) return;          // hidden: keep the last good layout
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.scale = b.width / LOGICAL_W;
    this.W = LOGICAL_W;
    this.H = b.height / this.scale;
    this.cv.width = Math.round(b.width * this.dpr);
    this.cv.height = Math.round(b.height * this.dpr);
    this.layout();
    this.ok = true;
  },

  // With order notes on, a ticket of chips sits across the top of the kitchen
  // and the pizza gets a little smaller; with them off, that space is the pizza's.
  setNotes(on) { this.notesOn = !!on; if (this.lay) this.layout(); },

  // How many rows of chips the focused order's ticket needs. The pizza makes room
  // for exactly that, so no clause of an order is ever clipped — which would be
  // the game hiding something it is about to grade.
  ticketRowsFor(order) {
    const ctx = this.ctx;
    ctx.font = `800 10.5px ${FONT}`;
    let rows = 1, x = 8;
    for (const ch of ticketChips(order)) {
      const w = ctx.measureText(ch).width + 14;
      if (x + w > this.W - 8 && x > 8) { rows++; x = 8; }
      x += w + 5;
    }
    return rows;
  },
  setTicketRows(n) { if (n !== this.ticketRows) { this.ticketRows = n; if (this.lay) this.layout(); } },

  layout() {
    const { W, H } = this;
    // The lobby gives way first on a short screen: the pizza is the game.
    const LZ = Math.round(Math.max(132, Math.min(205, H * 0.3)));
    const ky0 = LZ + RAIL_H, ky1 = H;
    const kh = ky1 - ky0;
    const ticketH = this.notesOn && this.ticketRows ? 6 + this.ticketRows * 21 : 0;
    const hintH = kh - ticketH >= 230 ? 34 : 0;      // no coach line when there is no room for it
    const room = kh - ticketH - hintH;
    const R = Math.max(74, Math.min(W * 0.41, room * 0.5));
    this.lay = { LZ, railY: LZ, ky0, ky1, kh, ticketH, hintH, pz: { cx: W / 2, cy: ky0 + ticketH + room / 2 + 2, R } };
    this.bgKey = "";                                    // re-bake the lobby
    this.kbg = null;
    if (typeof App !== "undefined" && App.onLayout) App.onLayout(this.lay);
  },

  /* A pointer position in logical px, and in the pizza's own coordinates. */
  logical(e) {
    const r = this.cv.getBoundingClientRect();
    return [(e.clientX - r.left) / this.scale, (e.clientY - r.top) / this.scale];
  },
  toPizza(lx, ly) { const { cx, cy, R } = this.lay.pz; return [(lx - cx) / R, (ly - cy) / R]; },
  fromPizza(px, py) { const { cx, cy, R } = this.lay.pz; return [cx + px * R, cy + py * R]; },

  pointer(kind, e) {
    if (!this.lay || !this.onPointer) return;
    if (kind === "down") { try { this.cv.setPointerCapture(e.pointerId); } catch {} }
    if (kind !== "hover-out" && (e.pointerType === "touch" || e.buttons || kind === "up" || e.pointerType === "mouse")) e.preventDefault();
    const [lx, ly] = kind === "hover-out" ? [-99, -99] : this.logical(e);
    this.onPointer(kind, lx, ly, e);
  },

  /* A rail ticket under a point, a lobby tap, a pizza tap. */
  railAt(lx, ly) { for (const h of this.railHits) if (lx >= h.x && lx <= h.x + h.w && ly >= h.y && ly <= h.y + h.h) return h.id; return null; },
  inLobby(lx, ly) { return ly < this.lay.LZ; },
  onPizza(lx, ly, slack = 1.04) { const [px, py] = this.toPizza(lx, ly); return px * px + py * py <= slack * slack; },

  /* -------------------------------- speech -------------------------------- */

  // Put words in a customer's mouth. `persistent` bubbles stay until replaced.
  say(name, text, opts = {}) {
    const ctx = this.ctx;
    ctx.font = `700 13px ${FONT}`;
    const maxW = this.W - 16 - 20;
    const lines = [];
    let cur = "";
    for (const word of text.split(" ")) {
      const test = cur ? cur + " " + word : word;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word; } else cur = test;
    }
    if (cur) lines.push(cur);
    this.bubble = {
      name, text, lines, t0: this.now, persistent: !!opts.persistent, instant: !!opts.instant, orderId: opts.orderId,
      hold: opts.hold ?? 4.5, tail: opts.tail ?? 0.6, chars: text.length,
    };
  },
  clearBubble() { this.bubble = null; },

  // A customer leaves the counter with a parting word.
  leave(cust, kind, text, stars) {
    this.leavers.push({ look: lookFor(cust.entry), entry: cust.entry, kind, text, stars: stars || 0, t: 0, x: this.W * SLOT_X[0] });
    this.sprites.delete(cust.id);
  },

  /* ---------------------------------- frame ---------------------------------- */

  frame(dt) {
    if (!this.ok) { this.resize(); if (!this.ok) return; }
    // A stage resizes with no resize event when the dock grows a row, the web
    // font lands or a banner rewraps — so notice drift here rather than hunt
    // every cause.
    const b = this.stage.getBoundingClientRect();
    if (b.width > 50 && b.height > 50 && (Math.abs(b.width * 1 - this.W * this.scale) > 1 || Math.abs(b.height - this.H * this.scale) > 1)) this.resize();
    this.now += dt;
    const ctx = this.ctx;
    const k = this.dpr * this.scale;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    this.drawLobby(dt);
    this.drawRail();
    this.drawKitchen();
    this.drawBubble();
    if (typeof Fx !== "undefined") { Fx.update(dt); const [sx, sy] = Fx.shakeOffset(); ctx.save(); ctx.translate(sx, sy); Fx.render(ctx); ctx.restore(); }
  },

  /* ---------------------------------- lobby ---------------------------------- */

  bakeLobby() {
    const { W } = this, { LZ } = this.lay;
    const d = this.decor || decorLook({});
    const ch = this.chapter || CHAPTERS[0];
    const key = [W, LZ, d.wall.id, d.floor.id, d.sign.id, d.props.join(","), ch.id, this.dpr, this.scale.toFixed(2)].join("|");
    if (key === this.bgKey && this.bg) return;
    const k = this.dpr * this.scale;
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(W * k); cv.height = Math.ceil(LZ * k);
    const c = cv.getContext("2d");
    c.setTransform(k, 0, 0, k, 0, 0);
    const counterH = 32, floorH = 58, wallH = LZ - counterH - floorH;

    // wall
    const wg = c.createLinearGradient(0, 0, 0, wallH);
    wg.addColorStop(0, d.wall.top); wg.addColorStop(1, d.wall.bot);
    c.fillStyle = wg; c.fillRect(0, 0, W, wallH + 2);
    c.strokeStyle = rgba(d.wall.line, 0.32); c.lineWidth = 1;
    for (let y = 10, r = 0; y < wallH; y += 12, r++) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      for (let x = (r % 2) * 14; x < W; x += 28) { c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x, y); c.stroke(); }
    }
    // a soft light from the window
    const lg = c.createRadialGradient(W * 0.62, wallH * 0.4, 6, W * 0.62, wallH * 0.4, W * 0.55);
    lg.addColorStop(0, "rgba(255,244,214,.35)"); lg.addColorStop(1, "rgba(255,244,214,0)");
    c.fillStyle = lg; c.fillRect(0, 0, W, wallH);

    // floor
    const fy = wallH;
    c.fillStyle = d.floor.a; c.fillRect(0, fy, W, floorH + counterH);
    for (let r = 0, y = fy; y < LZ; r++, y += 14) {
      for (let x = (r % 2) * 24 - 24; x < W; x += 48) { c.fillStyle = d.floor.b; c.fillRect(x, y, 24, 14); }
    }
    const fg = c.createLinearGradient(0, fy, 0, fy + floorH);
    fg.addColorStop(0, "rgba(60,30,30,.28)"); fg.addColorStop(1, "rgba(60,30,30,0)");
    c.fillStyle = fg; c.fillRect(0, fy, W, floorH);
    // skirting
    c.fillStyle = "rgba(255,248,236,.9)"; c.fillRect(0, fy - 3, W, 5);
    c.strokeStyle = OUT; c.lineWidth = 1; c.beginPath(); c.moveTo(0, fy + 2); c.lineTo(W, fy + 2); c.stroke();

    // the window, with the rival's shop on the far side of the street
    const wx = 150, wy = 10, ww = 150, wh = Math.max(40, wallH - 22);
    const sg = c.createLinearGradient(0, wy, 0, wy + wh);
    sg.addColorStop(0, "#cfe6f2"); sg.addColorStop(1, "#f3e6d8");
    roundRect(c, wx, wy, ww, wh, 5); fillOut(c, sg, 2);
    c.save(); roundRect(c, wx, wy, ww, wh, 5); c.clip();
    c.fillStyle = "#d8b8b0"; c.fillRect(wx + 8, wy + wh * 0.28, 40, wh);
    c.fillStyle = "#b9c4d0"; c.fillRect(wx + 100, wy + wh * 0.18, 44, wh);
    c.fillStyle = ch.hue; c.fillRect(wx + 52, wy + wh * 0.42, 44, wh);                 // the rival
    c.fillStyle = dark(ch.hue, 0.25); c.fillRect(wx + 52, wy + wh * 0.42, 44, 8);
    c.fillStyle = "#fff"; c.font = `800 5px ${FONT}`; c.textAlign = "center";
    c.fillText(ch.rival.shop.toUpperCase().slice(0, 14), wx + 74, wy + wh * 0.42 + 6);
    c.fillStyle = "rgba(255,255,255,.55)";
    for (let i = 0; i < 4; i++) c.fillRect(wx + 12 + (i % 2) * 14, wy + wh * 0.4 + Math.floor(i / 2) * 10, 8, 6);
    c.fillStyle = "#8a9aa8"; c.fillRect(wx, wy + wh - 10, ww, 10);                     // pavement
    c.restore();
    c.strokeStyle = "rgba(255,255,255,.8)"; c.lineWidth = 3; c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 1; c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.stroke();
    c.fillStyle = "#f4e4d0"; roundRect(c, wx - 3, wy + wh, ww + 6, 5, 2); fillOut(c, "#f4e4d0", 1.2);

    // the neon sign
    c.save();
    c.shadowColor = d.sign.color; c.shadowBlur = 12;
    roundRect(c, 50, 14, 82, 28, 14); c.fillStyle = "rgba(30,20,28,.8)"; c.fill();
    c.strokeStyle = d.sign.color; c.lineWidth = 3; c.stroke();
    c.fillStyle = d.sign.color; c.font = `800 17px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(d.sign.text, 91, 29);
    c.restore();
    c.textAlign = "left"; c.textBaseline = "alphabetic";

    // the door
    roundRect(c, 4, 8, 36, wallH + floorH - 12, 3); fillOut(c, "#7a4a32", 2);
    roundRect(c, 9, 14, 26, wallH + floorH - 34, 2); fillOut(c, "#bfe2ee", 1.2);
    c.fillStyle = "#f2d06b"; c.beginPath(); c.arc(32, wallH + 14, 2.6, 0, TAU); c.fill();

    this.drawProps(c, d.props, wallH, floorH, W);
    this.bg = cv; this.bgKey = key;
  },

  drawProps(c, props, wallH, floorH, W) {
    const has = (id) => props.includes(id);
    if (has("lights")) {
      c.strokeStyle = "rgba(60,40,30,.6)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 4);
      for (let x = 0; x <= W; x += 30) c.quadraticCurveTo(x + 15, 16, x + 30, 4);
      c.stroke();
      for (let x = 15, i = 0; x < W; x += 30, i++) { c.fillStyle = ["#ffd45e", "#ff8fb0", "#7fe0ff", "#a8f08a"][i % 4]; c.shadowColor = c.fillStyle; c.shadowBlur = 7; c.beginPath(); c.arc(x, 13, 3, 0, TAU); c.fill(); }
      c.shadowBlur = 0;
    }
    if (has("poster")) {
      roundRect(c, 312, 12, 36, 46, 2); fillOut(c, "#f6efe0", 1.6);
      c.fillStyle = "#e4806a"; c.beginPath(); c.arc(330, 33, 11, 0, TAU); c.fill();
      c.fillStyle = "#f4c75e"; c.beginPath(); c.arc(330, 33, 8, 0, TAU); c.fill();
      c.fillStyle = "#c8452f"; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(330 + Math.cos(i * 1.6) * 4, 33 + Math.sin(i * 1.6) * 4, 1.8, 0, TAU); c.fill(); }
    }
    const floorY = wallH + floorH * 0.9;
    if (has("plant")) {
      c.fillStyle = "#a35a3a"; c.beginPath(); c.moveTo(332, floorY); c.lineTo(350, floorY); c.lineTo(347, floorY - 16); c.lineTo(335, floorY - 16); c.closePath(); fillOut(c, "#b9673f", 1.3);
      for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.45; c.save(); c.translate(341, floorY - 16); c.rotate(a); c.beginPath(); c.ellipse(0, -16, 5, 17, 0, 0, TAU); fillOut(c, i % 2 ? "#4f9a46" : "#62ae52", 1.2); c.restore(); }
    }
    if (has("gumball")) {
      roundRect(c, 296, floorY - 8, 20, 8, 2); fillOut(c, "#d9463a", 1.3);
      roundRect(c, 299, floorY - 22, 14, 14, 2); fillOut(c, "#c8453a", 1.3);
      c.beginPath(); c.arc(306, floorY - 33, 11, 0, TAU); fillOut(c, "rgba(190,230,250,.6)", 1.4);
      const cols = ["#ff6b8a", "#ffd45e", "#7be0a0", "#6bb7ff"];
      for (let i = 0; i < 8; i++) { c.fillStyle = cols[i % 4]; c.beginPath(); c.arc(300 + (i % 4) * 4.4, floorY - 30 - Math.floor(i / 4) * 5, 2.4, 0, TAU); c.fill(); }
    }
    if (has("cat")) {
      c.fillStyle = "#fff"; blob(c, 276, floorY - 12, 10, 12); fillOut(c, "#fbf6ec", 1.4);
      blob(c, 276, floorY - 28, 9, 8); fillOut(c, "#fbf6ec", 1.4);
      c.beginPath(); c.moveTo(268, floorY - 33); c.lineTo(270, floorY - 41); c.lineTo(275, floorY - 35); c.fill(); outline(c, 1.2);
      c.beginPath(); c.moveTo(284, floorY - 33); c.lineTo(282, floorY - 41); c.lineTo(277, floorY - 35); c.fill(); outline(c, 1.2);
      c.fillStyle = INK; c.beginPath(); c.arc(273, floorY - 28, 1.2, 0, TAU); c.arc(279, floorY - 28, 1.2, 0, TAU); c.fill();
      c.fillStyle = "#e4806a"; c.beginPath(); c.arc(276, floorY - 20, 2.6, 0, TAU); c.fill();
      c.strokeStyle = "#fbf6ec"; c.lineWidth = 4; c.lineCap = "round"; c.beginPath(); c.moveTo(285, floorY - 14); c.lineTo(291, floorY - 26); c.stroke();
    }
    if (has("jukebox")) {
      c.beginPath(); c.moveTo(48, floorY); c.lineTo(48, floorY - 44); c.quadraticCurveTo(66, floorY - 62, 84, floorY - 44); c.lineTo(84, floorY); c.closePath(); fillOut(c, "#b8483c", 1.5);
      c.beginPath(); c.moveTo(54, floorY - 8); c.lineTo(54, floorY - 38); c.quadraticCurveTo(66, floorY - 52, 78, floorY - 38); c.lineTo(78, floorY - 8); c.closePath(); fillOut(c, "#ffd88a", 1.2);
      c.fillStyle = "#c8453a"; c.fillRect(57, floorY - 22, 18, 4); c.fillStyle = "#3b8a8a"; c.fillRect(57, floorY - 15, 18, 4);
    }
    if (has("arcade")) {
      c.beginPath(); c.moveTo(100, floorY); c.lineTo(100, floorY - 42); c.lineTo(108, floorY - 58); c.lineTo(132, floorY - 58); c.lineTo(138, floorY - 42); c.lineTo(138, floorY); c.closePath(); fillOut(c, "#5a56a8", 1.5);
      roundRect(c, 106, floorY - 50, 26, 18, 2); fillOut(c, "#1f2438", 1.2);
      c.fillStyle = "#ff6b8a"; c.fillRect(110, floorY - 45, 6, 6); c.fillStyle = "#6ff0c8"; c.fillRect(120, floorY - 41, 8, 5);
      c.fillStyle = "#ffd45e"; c.beginPath(); c.arc(112, floorY - 24, 3, 0, TAU); c.fill(); c.fillStyle = "#ff6b8a"; c.beginPath(); c.arc(124, floorY - 24, 2.6, 0, TAU); c.fill();
    }
  },

  drawLobby(dt) {
    const ctx = this.ctx, { W } = this, { LZ } = this.lay;
    this.bakeLobby();
    ctx.drawImage(this.bg, 0, 0, W, LZ);

    // the line, back to front
    const line = Game.line;
    const counterTop = LZ - 32;
    for (let i = Math.min(line.length, SLOT_X.length) - 1; i >= 0; i--) {
      const cust = line[i];
      let sp = this.sprites.get(cust.id);
      if (!sp) { sp = { x: -30, bob: Math.random() * 6, blink: Math.random() * 3 }; this.sprites.set(cust.id, sp); }
      const tx = W * SLOT_X[i];
      sp.x += (tx - sp.x) * Math.min(1, dt * 4.5);
      const walking = Math.abs(tx - sp.x) > 3;
      const bob = walking ? Math.abs(Math.sin(this.now * 9 + sp.bob)) * 3 : Math.sin(this.now * 2 + sp.bob) * 0.8;
      drawPerson(ctx, sp.x, counterTop + 2 - SLOT_Y[i] + 26 - bob, SLOT_S[i], lookFor(cust.entry), cust.entry.kind, moodFor(cust.happy), this.now, sp.blink);
      // patience meter over the shoulders
      this.heartBar(sp.x, counterTop - SLOT_Y[i] + 30, 30 * SLOT_S[i], cust.happy);
      if (i === 0 && !walking && !this.bubble) this.bang(sp.x + 22, counterTop - 74);
    }
    // anyone who has just been served, on their way out
    for (const l of this.leavers) {
      l.t += dt;
      const out = Math.max(0, l.t - 1.0);
      const x = l.x + out * out * 90 + out * 20;
      const mood = l.kind === "refund" || l.kind === "left" ? 0.1 : l.stars >= 3 ? 0.9 : 0.5;
      drawPerson(ctx, x, counterTop + 28 - Math.abs(Math.sin(l.t * 8)) * (out > 0 ? 3 : 0), 1, l.look, l.entry.kind, mood, this.now, 0);
      if (l.t < 2.6) this.reaction(x, counterTop - 70, l);
    }
    this.leavers = this.leavers.filter((l) => l.t < 3.6);

    this.drawCounter();
  },

  heartBar(cx, y, w, happy) {
    const ctx = this.ctx;
    const h = Math.max(0, Math.min(1, happy));
    ctx.fillStyle = "rgba(40,24,20,.45)"; roundRect(ctx, cx - w / 2, y, w, 5, 2.5); ctx.fill();
    ctx.fillStyle = h > 0.55 ? "#6fcf7f" : h > 0.25 ? "#f2c14e" : "#e4574a";
    if (h > 0.01) { roundRect(ctx, cx - w / 2, y, Math.max(4, w * h), 5, 2.5); ctx.fill(); }
  },

  bang(x, y) {
    const ctx = this.ctx, p = 1 + Math.sin(this.now * 6) * 0.08;
    ctx.save(); ctx.translate(x, y); ctx.scale(p, p);
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); fillOut(ctx, "#fff7e8", 1.6);
    ctx.fillStyle = "#e4574a"; ctx.font = `800 15px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("!", 0, 1);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.restore();
  },

  reaction(x, y, l) {
    const ctx = this.ctx;
    ctx.font = `700 11px ${FONT}`;
    const w = Math.min(190, ctx.measureText(l.text).width + 16);
    const bx = Math.max(6, Math.min(this.W - w - 6, x - w / 2));
    const a = Math.min(1, (2.6 - l.t) * 3, l.t * 6);
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    roundRect(ctx, bx, y - 30, w, 22, 9); fillOut(ctx, "#fffdf6", 1.4);
    ctx.beginPath(); ctx.moveTo(x - 5, y - 9); ctx.lineTo(x, y - 2); ctx.lineTo(x + 5, y - 9); ctx.fillStyle = "#fffdf6"; ctx.fill();
    ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(l.text, bx + w / 2, y - 19);
    if (l.stars) { ctx.font = `800 12px ${FONT}`; ctx.fillStyle = "#e8a200"; ctx.fillText("★".repeat(l.stars), bx + w / 2, y - 39); }
    ctx.restore(); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  },

  drawCounter() {
    const ctx = this.ctx, { W } = this, { LZ } = this.lay;
    const top = LZ - 32;
    // front panel
    const g = ctx.createLinearGradient(0, top, 0, LZ);
    g.addColorStop(0, "#d8a76d"); g.addColorStop(1, "#b9834a");
    ctx.fillStyle = g; ctx.fillRect(0, top + 7, W, 25);
    ctx.fillStyle = "#e9c28c"; ctx.fillRect(0, top, W, 8);
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, top + 0.5); ctx.lineTo(W, top + 0.5); ctx.moveTo(0, top + 7.5); ctx.lineTo(W, top + 7.5); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.28)";
    for (let x = 6; x < W; x += 44) { roundRect(ctx, x, top + 12, 34, 15, 3); ctx.fill(); }

    // the till
    roundRect(ctx, 18, top - 16, 52, 18, 3); fillOut(ctx, "#cfd5da", 1.4);
    roundRect(ctx, 22, top - 28, 28, 14, 3); fillOut(ctx, "#2c3a40", 1.2);
    ctx.fillStyle = "#6ff0c8"; ctx.font = `800 8px ${FONT}`; ctx.fillText(this.till || "$0.00", 25, top - 18);
    ctx.fillStyle = "#e4574a"; ctx.fillRect(56, top - 11, 8, 4);

    // the tip jar fills through the day
    const jx = W - 40, jw = 26, jh = 32;
    roundRect(ctx, jx, top - jh + 4, jw, jh, 5); ctx.fillStyle = "rgba(210,235,245,.55)"; ctx.fill();
    const fill = Math.max(0, Math.min(1, this.tipFill));
    if (fill > 0) {
      const ch = (jh - 6) * fill;
      ctx.save(); roundRect(ctx, jx, top - jh + 4, jw, jh, 5); ctx.clip();
      for (let i = 0; i < Math.ceil(fill * 14); i++) {
        ctx.fillStyle = i % 3 ? "#f0c14e" : "#d9a82e"; ctx.beginPath();
        ctx.ellipse(jx + 5 + hash(i * 1.9) * (jw - 10), top + 2 - hash(i * 3.3) * ch, 4.2, 2.4, 0, 0, TAU); ctx.fill();
        outline(ctx, 0.8);
      }
      ctx.restore();
    }
    roundRect(ctx, jx, top - jh + 4, jw, jh, 5); outline(ctx, 1.6);
    roundRect(ctx, jx + 2, top - jh, jw - 4, 6, 3); fillOut(ctx, "#e4806a", 1.3);
    ctx.fillStyle = "#fff"; ctx.font = `800 6px ${FONT}`; ctx.textAlign = "center"; ctx.fillText("TIPS", jx + jw / 2, top - jh + 22); ctx.textAlign = "left";
  },

  drawBubble() {
    const b = this.bubble; if (!b) return;
    const ctx = this.ctx, { W } = this;
    const age = this.now - b.t0;
    const typeDur = b.instant ? 0 : b.chars / 55;
    const end = typeDur + b.hold;
    let alpha = 1;
    if (!b.persistent) {
      if (age > end + 0.6) { this.bubble = null; return; }
      if (age > end) alpha = 1 - (age - end) / 0.6;
    }
    const shown = b.instant ? b.chars : Math.min(b.chars, Math.floor(age * 55));
    const lh = 16, padX = 11, padY = 9, tagH = 15;
    const h = b.lines.length * lh + padY * 2 + 2;
    const x = 8, y = 8, w = W - 16;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(60,30,20,.25)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    roundRect(ctx, x, y, w, h, 12); ctx.fillStyle = "#fffdf6"; ctx.fill();
    ctx.shadowColor = "transparent";
    roundRect(ctx, x, y, w, h, 12); outline(ctx, 1.8);
    // tail toward whoever is speaking: their ticket on the rail, or the counter
    const hit = b.orderId ? this.railHits.find((r) => r.id === b.orderId) : null;
    const tx = hit ? hit.x + hit.w / 2 : W * SLOT_X[0] - 8;
    ctx.beginPath(); ctx.moveTo(tx - 7, y + h - 1); ctx.lineTo(tx, y + h + 9); ctx.lineTo(tx + 8, y + h - 1); ctx.fillStyle = "#fffdf6"; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(tx - 7, y + h); ctx.lineTo(tx, y + h + 9); ctx.lineTo(tx + 8, y + h); ctx.stroke();
    ctx.fillStyle = "#fffdf6"; ctx.fillRect(tx - 6, y + h - 2, 13, 3);
    // name tag
    ctx.font = `800 10px ${FONT}`;
    const nw = ctx.measureText(b.name).width + 14;
    roundRect(ctx, x + 10, y - 7, nw, tagH, 7); fillOut(ctx, "#e4572e", 1.2);
    ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(b.name, x + 17, y + 0.5);
    // text, typed out
    ctx.font = `700 13px ${FONT}`; ctx.fillStyle = INK; ctx.textBaseline = "alphabetic";
    let left = shown;
    b.lines.forEach((ln, i) => {
      if (left <= 0) return;
      const part = ln.slice(0, left);
      ctx.fillText(part, x + padX, y + padY + 7 + i * lh + 6);
      left -= ln.length + 1;
    });
    ctx.restore();
  },

  /* ----------------------------------- rail ----------------------------------- */

  drawRail() {
    const ctx = this.ctx, { W } = this, { railY } = this.lay;
    const g = ctx.createLinearGradient(0, railY, 0, railY + RAIL_H);
    g.addColorStop(0, "#6b4a36"); g.addColorStop(1, "#4a3224");
    ctx.fillStyle = g; ctx.fillRect(0, railY, W, RAIL_H);
    ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(0, railY, W, 2);
    const slots = MAX_OPEN, pad = 6, gap = 5;
    const w = (W - pad * 2 - gap * (slots - 1)) / slots, h = RAIL_H - 10, y = railY + 6;
    this.railHits = [];
    for (let i = 0; i < slots; i++) {
      const x = pad + i * (w + gap);
      const o = Game.open[i];
      if (!o) {
        ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(255,240,220,.35)"; ctx.lineWidth = 1.5;
        roundRect(ctx, x, y, w, h, 9); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,240,220,.4)"; ctx.font = `700 10px ${FONT}`; ctx.textAlign = "center";
        ctx.fillText(i === 0 && !Game.open.length ? "No orders yet" : "Free", x + w / 2, y + h / 2 + 3); ctx.textAlign = "left";
        continue;
      }
      const st = PHASE_STYLE[o.phase];
      const focus = Game.focus === o.id;
      const pulse = o.phase === "baked" ? 0.5 + 0.5 * Math.sin(this.now * 8) : 0;
      ctx.save();
      if (focus) { ctx.shadowColor = "rgba(255,210,120,.9)"; ctx.shadowBlur = 10; }
      roundRect(ctx, x, y, w, h, 9); ctx.fillStyle = pulse ? mix(st.fill, "#ffffff", pulse * 0.6) : st.fill; ctx.fill();
      ctx.restore();
      roundRect(ctx, x, y, w, h, 9); ctx.strokeStyle = focus ? "#e4572e" : OUT; ctx.lineWidth = focus ? 3 : 1.4; ctx.stroke();
      // face
      ctx.save(); roundRect(ctx, x + 3, y + 3, 30, h - 6, 7); ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(x + 3, y + 3, 30, h - 6);
      drawPerson(ctx, x + 18, y + h + 2, 0.5, lookFor(o.cust.entry), o.cust.entry.kind, moodFor(o.cust.happy), this.now, 0);
      ctx.restore();
      // words
      ctx.fillStyle = INK; ctx.font = `800 10px ${FONT}`;
      ctx.fillText(o.cust.entry.name.slice(0, 11), x + 38, y + 13);
      let tag = st.tag;
      if (o.phase === "oven") tag = `Baking ${Math.max(0, Math.ceil(Game.kit.ovenTime - o.ovenT))}s`;
      ctx.font = `700 10px ${FONT}`; ctx.fillStyle = "#6d5a45";
      ctx.fillText(st.icon + " " + tag, x + 38, y + 26);
      this.heartBar(x + 38 + (w - 44) / 2, y + h - 10, w - 44, o.cust.happy);
      if (o.phase === "oven") {                                       // a ring of progress round the flame
        ctx.strokeStyle = "#e4572e"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(x + w - 11, y + 11, 6, -Math.PI / 2, -Math.PI / 2 + TAU * (o.ovenT / Game.kit.ovenTime)); ctx.stroke();
      }
      this.railHits.push({ x, y, w, h, id: o.id });
    }
  },

  /* --------------------------------- kitchen --------------------------------- */

  bakeKitchen() {
    const { W } = this, { ky0, kh } = this.lay;
    const k = this.dpr * this.scale;
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(W * k); cv.height = Math.ceil(kh * k);
    const c = cv.getContext("2d");
    c.setTransform(k, 0, 0, k, 0, 0);
    c.fillStyle = "#f4e2d4"; c.fillRect(0, 0, W, kh);
    const s = 24;
    for (let r = 0; r * s < kh + s; r++) for (let q = 0; q * s < W + s; q++) {
      if ((r + q) % 2 === 0) { c.fillStyle = "rgba(214,120,116,.34)"; c.fillRect(q * s, r * s, s, s); }
    }
    const vg = c.createRadialGradient(W / 2, kh / 2, kh * 0.2, W / 2, kh / 2, Math.max(W, kh) * 0.75);
    vg.addColorStop(0, "rgba(255,255,255,0)"); vg.addColorStop(1, "rgba(90,40,30,.3)");
    c.fillStyle = vg; c.fillRect(0, 0, W, kh);
    this.kbg = cv;
  },

  heatOf(o) { return o.pizza.runs + (o.phase === "oven" ? o.ovenT / Game.kit.ovenTime : 0); },

  drawKitchen() {
    const ctx = this.ctx, { W } = this, { ky0, kh, pz } = this.lay;
    if (!this.kbg) this.bakeKitchen();
    ctx.drawImage(this.kbg, 0, ky0, W, kh);
    const o = Game.order(Game.focus);

    if (o && this.notesOn) this.drawTicket(o);
    if (!o) { this.drawEmptyBoard(); }
    else if (o.phase === "oven") this.drawOven(o);
    else if (o.phase === "ready") this.drawBox(o);
    else {
      this.drawPeel();
      const heat = this.heatOf(o);
      const guides = o.phase === "cut" && (Game.kit.snap || o.pizza.cuts.length) ? guideAngles(o.pizza, o.order.slices) : [];
      drawPizza(ctx, o.pizza, pz.cx, pz.cy, pz.R, { heat, dpr: this.dpr * this.scale, born: this.born, now: this.now, guides: Game.kit.snap || o.pizza.cuts.length ? guides : [] });
      if (o.phase === "build") this.drawSplitGuides(o.order);
      if (o.phase === "baked") this.sparkle(pz.cx, pz.cy, pz.R);
      // tools
      if (this.brush) this.drawBrush();
      if (this.ghost) { const [gx, gy] = this.fromPizza(this.ghost.x, this.ghost.y); ctx.globalAlpha = 0.75; drawTopping(ctx, this.ghost.t, gx, gy, pz.R * 0.135, 0.3, 0, 0); ctx.globalAlpha = 1; }
      if (this.cutPreview) this.drawCutPreview();
    }
    if (this.hint) this.drawHint();
  },

  // Half-and-half and quarter orders get a faint dashed line to build against.
  // "The left half" is the player's left, and a line removes every argument.
  drawSplitGuides(order) {
    const regions = order.reqs.map((r) => r.region);
    const vert = regions.some((r) => r === "L" || r === "R" || r.length === 2);
    const horiz = regions.some((r) => r === "T" || r === "B" || r.length === 2);
    if (!vert && !horiz) return;
    const ctx = this.ctx, { cx, cy, R } = this.lay.pz;
    ctx.save();
    ctx.setLineDash([7, 6]); ctx.lineCap = "round";
    for (const [on, x1, y1, x2, y2] of [[vert, cx, cy - R * 0.97, cx, cy + R * 0.97], [horiz, cx - R * 0.97, cy, cx + R * 0.97, cy]]) {
      if (!on) continue;
      ctx.strokeStyle = "rgba(60,30,20,.45)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.restore();
  },

  drawPeel() {
    const ctx = this.ctx, { cx, cy, R } = this.lay.pz;
    // the handle, short, so it never reaches the hint line below
    roundRect(ctx, cx - R * 0.14, cy + R * 0.95, R * 0.28, R * 0.25, 7); fillOut(ctx, "#c89258", 1.6);
    ctx.fillStyle = "#6e4528"; ctx.beginPath(); ctx.arc(cx, cy + R * 1.1, R * 0.04, 0, TAU); ctx.fill();
    // the board
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R * 1.12);
    g.addColorStop(0, "#d9a768"); g.addColorStop(1, "#b9814a");
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.1, 0, TAU); fillOut(ctx, g, 1.8);
    ctx.strokeStyle = "rgba(110,70,38,.22)"; ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(cx, cy, R * (0.6 + i * 0.07 + 0.3), 0.3, 1.1); ctx.stroke(); }
  },

  drawEmptyBoard() {
    const ctx = this.ctx, { cx, cy, R } = this.lay.pz;
    // a tray of dough balls waiting
    roundRect(ctx, cx - R * 0.95, cy - R * 0.55, R * 1.9, R * 1.1, 14); fillOut(ctx, "#aab4bd", 2);
    roundRect(ctx, cx - R * 0.88, cy - R * 0.48, R * 1.76, R * 0.96, 10); ctx.fillStyle = "#6b757d"; ctx.fill();
    for (let i = 0; i < 6; i++) {
      const x = cx - R * 0.6 + (i % 3) * R * 0.6, y = cy - R * 0.2 + Math.floor(i / 3) * R * 0.45;
      blob(ctx, x, y, R * 0.24, R * 0.17); fillOut(ctx, "#f4e2b4", 1.4);
      ctx.fillStyle = "rgba(255,255,255,.45)"; blob(ctx, x - R * 0.06, y - R * 0.06, R * 0.08, R * 0.05); ctx.fill();
    }
  },

  drawBrush() {
    const ctx = this.ctx, b = this.brush;
    ctx.save();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = b.kind === "sauce" ? rgba(SAUCE[b.sauce || "tomato"].dark, 0.9) : "rgba(220,160,40,.95)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `700 20px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(b.kind === "sauce" ? "🥄" : "🧀", b.x, b.y - 2);
    ctx.restore();
  },

  drawCutPreview() {
    const ctx = this.ctx, c = this.cutPreview;
    ctx.save();
    ctx.strokeStyle = "rgba(60,30,20,.55)"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(c.ax, c.ay); ctx.lineTo(c.bx, c.by); ctx.stroke();
    ctx.strokeStyle = "#fffdf6"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(c.ax, c.ay); ctx.lineTo(c.bx, c.by); ctx.stroke();
    ctx.font = `700 22px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🔪", c.bx, c.by);
    ctx.restore();
  },

  sparkle(cx, cy, R) {
    const ctx = this.ctx;
    ctx.save(); ctx.fillStyle = "rgba(255,248,200,.9)";
    for (let i = 0; i < 6; i++) {
      const a = this.now * 0.8 + i * 1.05, r = R * (0.45 + 0.4 * hash(i)), ph = (this.now * 1.6 + i * 0.37) % 1;
      const s = Math.sin(ph * Math.PI) * 5;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.3, y - s * 0.3); ctx.lineTo(x + s, y); ctx.lineTo(x + s * 0.3, y + s * 0.3); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.3, y + s * 0.3); ctx.lineTo(x - s, y); ctx.lineTo(x - s * 0.3, y - s * 0.3); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  },

  // The written ticket: the order boiled down to chips. Only with notes on.
  drawTicket(o) {
    const ctx = this.ctx, { W } = this, { ky0, ticketH } = this.lay;
    const chips = ticketChips(o.order);
    ctx.font = `800 10.5px ${FONT}`;
    let x = 8, y = ky0 + 5;
    for (const ch of chips) {
      const w = ctx.measureText(ch).width + 14;
      if (x + w > W - 8 && x > 8) { x = 8; y += 21; }
      roundRect(ctx, x, y, w, 18, 9); fillOut(ctx, "#fffaf0", 1.2);
      ctx.fillStyle = INK; ctx.textBaseline = "middle"; ctx.fillText(ch, x + 7, y + 9.5); ctx.textBaseline = "alphabetic";
      x += w + 5;
    }
  },

  drawHint() {
    const ctx = this.ctx, { W } = this, { ky1, hintH } = this.lay;
    if (!hintH) return;
    ctx.font = `800 12px ${FONT}`;
    const w = Math.min(W - 20, ctx.measureText(this.hint).width + 26);
    const x = (W - w) / 2, y = ky1 - hintH + 4;
    roundRect(ctx, x, y, w, 24, 12); ctx.fillStyle = "rgba(50,28,22,.78)"; ctx.fill();
    ctx.fillStyle = "#fff4dc"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(this.hint, W / 2, y + 12.5);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  },

  /* ----------------------------------- oven ----------------------------------- */

  drawOven(o) {
    const ctx = this.ctx, { cx, cy, R } = this.lay.pz;
    const prog = o.ovenT / Game.kit.ovenTime;
    // Sized to the board, never taller: the ticket above and the hint below stay clear.
    const x = cx - R * 1.12, y = cy - R * 1.02, w = R * 2.24, h = R * 2.04;
    // steel body
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, "#9aa7b2"); g.addColorStop(0.5, "#c6d0d8"); g.addColorStop(1, "#8d9aa5");
    roundRect(ctx, x, y, w, h, 20); fillOut(ctx, g, 2.4);
    ctx.fillStyle = "#6d7a85"; for (const rx of [x + 12, x + w - 12]) for (const ry of [y + 12, y + h - 12]) { ctx.beginPath(); ctx.arc(rx, ry, 2.6, 0, TAU); ctx.fill(); }
    // the mouth
    const mx = x + R * 0.12, my = y + R * 0.2, mw = w - R * 0.24, mh = h - R * 0.44;
    roundRect(ctx, mx, my, mw, mh, 16);
    const fg = ctx.createRadialGradient(cx, my + mh * 0.85, R * 0.1, cx, my + mh * 0.6, mh * 0.8);
    fg.addColorStop(0, "#ffd36e"); fg.addColorStop(0.45, "#f0802a"); fg.addColorStop(1, "#5a1c0e");
    ctx.fillStyle = fg; ctx.fill(); outline(ctx, 2);
    // flames
    ctx.save(); roundRect(ctx, mx, my, mw, mh, 16); ctx.clip();
    for (let i = 0; i < 9; i++) {
      const fx = mx + (i + 0.5) * mw / 9, fl = 14 + 10 * Math.sin(this.now * 7 + i * 1.7) + hash(i) * 8;
      ctx.beginPath(); ctx.moveTo(fx - 9, my + mh); ctx.quadraticCurveTo(fx - 3, my + mh - fl, fx, my + mh - fl - 6); ctx.quadraticCurveTo(fx + 4, my + mh - fl, fx + 9, my + mh);
      ctx.fillStyle = i % 2 ? "rgba(255,200,80,.85)" : "rgba(255,120,40,.85)"; ctx.fill();
    }
    ctx.restore();
    // the rack and the pizza on it
    ctx.strokeStyle = "rgba(30,20,20,.75)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(mx + 6, cy + R * 0.86); ctx.lineTo(mx + mw - 6, cy + R * 0.86); ctx.stroke();
    drawPizza(ctx, o.pizza, cx, cy + R * 0.02, R * 0.74, { heat: this.heatOf(o), dpr: this.dpr * this.scale, cuts: false });
    // heat shimmer
    ctx.strokeStyle = "rgba(255,230,160,.28)"; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const sx = mx + 20 + i * (mw - 40) / 3; ctx.beginPath(); for (let t = 0; t < 30; t++) { const yy = my + mh - t * 4; const xx = sx + Math.sin(this.now * 4 + t * 0.4 + i) * 4; t ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
    // the clock round the front
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy + R * 0.02, R * 0.82, 0, TAU); ctx.stroke();
    ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy + R * 0.02, R * 0.82, -Math.PI / 2, -Math.PI / 2 + TAU * prog); ctx.stroke();
    // label, on the steel above the mouth
    ctx.fillStyle = "#2b3640"; ctx.font = `800 12px ${FONT}`; ctx.textAlign = "center";
    ctx.fillText(`Trip ${o.pizza.runs + 1} through the oven`, cx, y + R * 0.15 + 3);
    ctx.fillStyle = "#fff7e8"; ctx.font = `800 17px ${FONT}`; ctx.fillText(Math.max(0, Math.ceil(Game.kit.ovenTime - o.ovenT)) + "s", cx, y + h - R * 0.04);
    ctx.textAlign = "left";
  },

  /* ------------------------------------ box ------------------------------------ */

  drawBox(o) {
    const ctx = this.ctx, { cx, cy, R } = this.lay.pz;
    const bob = Math.sin(this.now * 3) * 2;
    const s = R * 1.7, x = cx - s / 2, y = cy - s / 2 + bob;
    ctx.fillStyle = "rgba(60,30,20,.2)"; blob(ctx, cx + 3, cy + s / 2 + 6, s * 0.52, s * 0.07); ctx.fill();
    roundRect(ctx, x, y, s, s, 10); fillOut(ctx, "#d8b27a", 2);
    ctx.fillStyle = "#c79c60"; ctx.fillRect(x + 6, y + s * 0.5 - 2, s - 12, 4);
    // the lid's logo
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.04 + bob, s * 0.27, 0, TAU); fillOut(ctx, "#fff7e8", 1.6);
    ctx.fillStyle = "#e4572e"; ctx.font = `800 ${Math.round(s * 0.085)}px ${FONT}`; ctx.textAlign = "center";
    ctx.fillText("SLICE", cx, cy - s * 0.06 + bob); ctx.fillText("OF LIFE", cx, cy + s * 0.05 + bob);
    ctx.font = `700 ${Math.round(s * 0.07)}px ${FONT}`; ctx.fillStyle = "#6d4a2a";
    ctx.fillText(`for ${o.cust.entry.name}`, cx, y + s - s * 0.06);
    ctx.textAlign = "left";
    // a ribbon
    ctx.fillStyle = "#e4574a"; ctx.fillRect(x + s * 0.44, y, s * 0.12, s * 0.2); ctx.fillRect(x + s * 0.44, y + s * 0.8, s * 0.12, s * 0.2);
  },

  /* -------------------------------- paint a pizza -------------------------------- */

  // Draw a pizza onto any canvas (the receipt, the album). Heat from its runs.
  paintPizzaOn(canvas, pizza, heat) {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const css = canvas.clientWidth || canvas.width;
    canvas.width = Math.round(css * dpr); canvas.height = Math.round(css * dpr);
    const c = canvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, css, css);
    drawPizza(c, pizza, css / 2, css / 2, css * 0.46, { heat, dpr });
  },
};

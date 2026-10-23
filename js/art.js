// Slice of Life — the pen. Every picture in the game is drawn here, in canvas
// paths, with ONE edge treatment (a soft warm outline) and ONE palette (dusty
// pinks, brick, cream, slate), so a customer, a pepperoni and a tip jar all look
// like they were drawn by the same hand. No image files anywhere.
//
// Nothing in here knows about the game state. The functions take what to draw
// and where, which is also what lets the Kitchen's little bin pictures, the
// Regulars album and the live board all share the same code.

const TAU = Math.PI * 2;
const OUT = "rgba(86, 48, 40, .62)";        // the one outline colour
const INK = "#3b2a26";

/* ------------------------------ small helpers ------------------------------ */

function hexRgb(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  t = Math.max(0, Math.min(1, t));
  const f = (i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, "0");
  return "#" + f(0) + f(1) + f(2);
}
const dark = (c, t) => mix(c, "#2a1810", t);
const light = (c, t) => mix(c, "#ffffff", t);
function rgba(c, a) { const [r, g, b] = hexRgb(c); return `rgba(${r},${g},${b},${a})`; }
// A stable pseudo-random 0..1 from a number — decoration that must not shimmer.
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

function blob(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}
function outline(ctx, w = 1.4) { ctx.strokeStyle = OUT; ctx.lineWidth = w; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); }
function fillOut(ctx, fill, w = 1.4) { ctx.fillStyle = fill; ctx.fill(); outline(ctx, w); }

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ------------------------------ the heat of a bake ------------------------------ */

// heat = runs through the oven (+ the fraction of the current run). 0 raw,
// 1 golden, 2 deep gold, 3 dark, 4 burnt.
const CRUST_STOPS = ["#f3dba4", "#e2a850", "#c47c34", "#8c5026", "#33211a"];
const CHEESE_STOPS = ["#f9e08a", "#f4c75e", "#dca03e", "#a9642a", "#40281c"];
function stopAt(stops, heat) {
  const h = Math.max(0, Math.min(stops.length - 1, heat));
  const i = Math.min(stops.length - 2, Math.floor(h));
  return mix(stops[i], stops[i + 1], h - i);
}
const crustColor = (h) => stopAt(CRUST_STOPS, h);
const cheeseColor = (h) => stopAt(CHEESE_STOPS, h);

/* ------------------------------------ toppings ------------------------------------ */

// Draw one piece centred on 0,0 at radius s. `v` is a 0..2 variant so no two
// pieces are identical; `heat` darkens it as it bakes.
const TOPPING_ART = {
  pepperoni(c, s, v, h) {
    blob(c, 0, 0, s, s * 0.97); fillOut(c, dark("#c8452f", h * 0.1));
    c.fillStyle = dark("#a7301f", h * 0.1);
    for (let i = 0; i < 5; i++) { const a = hash(v * 9 + i) * TAU, r = s * (0.25 + hash(v * 5 + i) * 0.45); blob(c, Math.cos(a) * r, Math.sin(a) * r, s * 0.12, s * 0.1); c.fill(); }
    c.strokeStyle = "rgba(255,200,170,.5)"; c.lineWidth = 1.4; c.beginPath(); c.arc(0, 0, s * 0.72, 3.6, 4.6); c.stroke();
  },
  mushroom(c, s, v, h) {
    // a top-down slice: round cap, a short stem notch below
    c.beginPath(); c.ellipse(0, -s * 0.12, s * 0.95, s * 0.78, 0, Math.PI * 0.08, Math.PI * 0.92, true);
    c.bezierCurveTo(s * 0.35, s * 0.78, s * 0.3, s * 1.0, s * 0.18, s * 1.0);
    c.lineTo(-s * 0.18, s * 1.0); c.bezierCurveTo(-s * 0.3, s * 1.0, -s * 0.35, s * 0.78, -s * 0.8, s * 0.55);
    c.closePath(); fillOut(c, dark("#eadcc0", h * 0.1));
    c.fillStyle = dark("#c9ad7e", h * 0.1); c.beginPath(); c.ellipse(0, -s * 0.3, s * 0.78, s * 0.42, 0, Math.PI, TAU); c.fill();
    c.strokeStyle = "rgba(150,110,60,.45)"; c.lineWidth = 1.1; c.beginPath(); c.moveTo(0, -s * 0.2); c.lineTo(0, s * 0.8); c.stroke();
  },
  onion(c, s, v, h) {
    c.lineCap = "round";
    c.strokeStyle = OUT; c.lineWidth = s * 0.42; c.beginPath(); c.arc(0, 0, s * 0.7, 0.5 + v, TAU * 0.86 + v); c.stroke();
    c.strokeStyle = dark("#e6c3dc", h * 0.1); c.lineWidth = s * 0.3; c.beginPath(); c.arc(0, 0, s * 0.7, 0.5 + v, TAU * 0.86 + v); c.stroke();
    c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = s * 0.08; c.beginPath(); c.arc(0, 0, s * 0.7, 0.9 + v, 2 + v); c.stroke();
  },
  olive(c, s, v, h) {
    blob(c, 0, 0, s * 0.85, s * 0.8); fillOut(c, "#34303a");
    c.fillStyle = "#e8cf86"; blob(c, 0, 0, s * 0.3, s * 0.28); c.fill();
    c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
    c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1.3; c.beginPath(); c.arc(0, 0, s * 0.62, 3.7, 4.5); c.stroke();
  },
  sausage(c, s, v, h) {
    c.beginPath();
    for (let i = 0; i <= 10; i++) { const a = i / 10 * TAU, r = s * (0.78 + hash(v * 7 + i) * 0.22); const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.92; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.closePath(); fillOut(c, dark("#a1563a", h * 0.1));
    c.fillStyle = dark("#6e3622", h * 0.1);
    for (let i = 0; i < 4; i++) { blob(c, (hash(v + i) - 0.5) * s, (hash(v * 3 + i) - 0.5) * s, s * 0.11, s * 0.09); c.fill(); }
  },
  pepper(c, s, v, h) {
    c.strokeStyle = OUT; c.lineWidth = s * 0.4; c.lineCap = "round"; c.beginPath(); c.arc(0, 0, s * 0.68, 0.3 + v, 3.4 + v); c.stroke();
    c.strokeStyle = dark("#58a63f", h * 0.12); c.lineWidth = s * 0.27; c.beginPath(); c.arc(0, 0, s * 0.68, 0.3 + v, 3.4 + v); c.stroke();
    c.strokeStyle = "rgba(255,255,255,.4)"; c.lineWidth = s * 0.07; c.beginPath(); c.arc(0, 0, s * 0.74, 0.7 + v, 1.7 + v); c.stroke();
  },
  basil(c, s, v, h) {
    c.beginPath(); c.moveTo(0, s * 0.9); c.bezierCurveTo(-s * 1.1, s * 0.3, -s * 0.7, -s * 0.9, 0, -s * 0.95);
    c.bezierCurveTo(s * 0.7, -s * 0.9, s * 1.1, s * 0.3, 0, s * 0.9); c.closePath(); fillOut(c, dark("#4f9a46", h * 0.18));
    c.strokeStyle = "rgba(20,70,20,.5)"; c.lineWidth = 1.1; c.beginPath(); c.moveTo(0, s * 0.8); c.lineTo(0, -s * 0.7); c.stroke();
  },
  ham(c, s, v, h) {
    roundRect(c, -s * 0.85, -s * 0.8, s * 1.7, s * 1.6, s * 0.4); fillOut(c, dark("#ee9ea0", h * 0.12));
    c.strokeStyle = "rgba(255,230,230,.6)"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-s * 0.4, -s * 0.3); c.quadraticCurveTo(0, -s * 0.5, s * 0.45, -s * 0.25); c.stroke();
  },
  tomato(c, s, v, h) {
    blob(c, 0, 0, s * 0.92, s * 0.92); fillOut(c, dark("#dd4d3a", h * 0.1));
    c.fillStyle = dark("#f27a62", h * 0.1); blob(c, 0, 0, s * 0.62, s * 0.62); c.fill();
    c.fillStyle = "#f3d27a";
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + v; blob(c, Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4, s * 0.09, s * 0.14, a); c.fill(); }
  },
  pineapple(c, s, v, h) {
    c.save(); c.rotate(v * 0.8);
    roundRect(c, -s * 0.75, -s * 0.75, s * 1.5, s * 1.5, s * 0.28); fillOut(c, dark("#f7d95f", h * 0.14));
    c.strokeStyle = "rgba(200,150,20,.45)"; c.lineWidth = 1;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-s * 0.6, i * s * 0.4); c.lineTo(s * 0.6, i * s * 0.4); c.stroke(); }
    c.restore();
  },
  spinach(c, s, v, h) {
    for (let i = 0; i < 2; i++) {
      c.save(); c.rotate(i * 1.7 + v);
      c.beginPath(); c.ellipse(0, -s * 0.3, s * 0.5, s * 0.82, 0, 0, TAU); fillOut(c, dark(i ? "#3d8a3a" : "#4d9a46", h * 0.2));
      c.strokeStyle = "rgba(15,60,15,.5)"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, s * 0.4); c.lineTo(0, -s * 0.9); c.stroke();
      c.restore();
    }
  },
  anchovy(c, s, v, h) {
    c.save(); c.rotate(v * 0.5);
    c.beginPath(); c.ellipse(-s * 0.1, 0, s * 0.85, s * 0.34, 0, 0, TAU); fillOut(c, dark("#92acba", h * 0.1));
    c.beginPath(); c.moveTo(s * 0.7, 0); c.lineTo(s * 1.15, -s * 0.4); c.lineTo(s * 1.15, s * 0.4); c.closePath(); fillOut(c, dark("#7b97a6", h * 0.1));
    c.fillStyle = INK; blob(c, -s * 0.55, -s * 0.06, s * 0.07, s * 0.07); c.fill();
    c.restore();
  },
  jalapeno(c, s, v, h) {
    blob(c, 0, 0, s * 0.85, s * 0.85); fillOut(c, dark("#4f9a37", h * 0.14));
    c.fillStyle = dark("#c6dd7a", h * 0.14); blob(c, 0, 0, s * 0.5, s * 0.5); c.fill();
    c.fillStyle = "#f4efb0";
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + v; blob(c, Math.cos(a) * s * 0.26, Math.sin(a) * s * 0.26, s * 0.08, s * 0.1, a); c.fill(); }
  },
  bacon(c, s, v, h) {
    c.save(); c.rotate(v * 0.9);
    c.beginPath(); c.moveTo(-s * 1.05, -s * 0.3);
    c.bezierCurveTo(-s * 0.5, -s * 0.7, -s * 0.2, 0.1, s * 0.3, -s * 0.3); c.bezierCurveTo(s * 0.7, -s * 0.55, s * 0.9, -s * 0.2, s * 1.05, -s * 0.3);
    c.lineTo(s * 1.05, s * 0.3); c.bezierCurveTo(s * 0.9, s * 0.2, s * 0.7, s * 0.55, s * 0.3, s * 0.3);
    c.bezierCurveTo(-s * 0.2, 0.7 * s, -s * 0.5, s * 0.1, -s * 1.05, s * 0.3); c.closePath(); fillOut(c, dark("#c8453a", h * 0.16));
    c.strokeStyle = dark("#f0b49a", h * 0.16); c.lineWidth = s * 0.16; c.beginPath(); c.moveTo(-s * 0.9, 0); c.bezierCurveTo(-s * 0.3, -s * 0.3, s * 0.1, s * 0.2, s * 0.9, -s * 0.05); c.stroke();
    c.restore();
  },
  chicken(c, s, v, h) {
    c.beginPath();
    for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU, r = s * (0.78 + hash(v * 4 + i) * 0.25); const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.85; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.closePath(); fillOut(c, dark("#ecd0a6", h * 0.14));
    c.fillStyle = dark("#c99a62", h * 0.14); blob(c, s * 0.2, -s * 0.15, s * 0.3, s * 0.2); c.fill();
  },
};

// Draw one topping piece. x,y is its centre; s its radius; rot in radians.
function drawTopping(ctx, id, x, y, s, rot = 0, v = 0, heat = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  (TOPPING_ART[id] || TOPPING_ART.pepperoni)(ctx, s, v, heat);
  ctx.restore();
}

/* ---------------------------------- the pizza ---------------------------------- */

// The sauce and cheese are baked into an offscreen layer and only re-baked when
// the pizza changes (rev), so painting a stroke costs one rebuild, not one per
// frame. Everything else — toppings, heat, cuts — is drawn live over it.
const LAYERS = new Map();

function bakeLayer(p, R, dpr) {
  const key = `${p.rev}|${Math.round(R)}|${dpr}`;
  let L = LAYERS.get(p.uid);
  if (L && L.key === key) return L.cv;
  // Each layer is a megabyte or more, so keep only the few pizzas still in play.
  if (!L && LAYERS.size >= 6) LAYERS.delete(LAYERS.keys().next().value);
  const size = Math.ceil(R * 2 * dpr);
  if (!L) L = { cv: (typeof document !== "undefined" ? document.createElement("canvas") : null) };
  if (!L.cv) return null;
  L.cv.width = size; L.cv.height = size;
  const c = L.cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.translate(R, R);
  const cell = CELL * R;
  // sauce
  if (p.sauce) {
    const col = SAUCE[p.sauce].color, dk = SAUCE[p.sauce].dark;
    c.fillStyle = col;
    for (const q of CELLS) {
      if (p.sg[q.k] < 1) continue;
      const jx = (hash(q.k * 1.3) - 0.5) * cell * 0.5, jy = (hash(q.k * 2.9) - 0.5) * cell * 0.5;
      c.beginPath(); c.arc(q.x * R + jx, q.y * R + jy, cell * 0.82, 0, TAU); c.fill();
    }
    c.strokeStyle = dk; c.lineWidth = 1.2; c.globalAlpha = 0.45;
    for (const q of CELLS) {
      if (p.sg[q.k] < 1 || hash(q.k * 4.1) < 0.55) continue;
      const a = hash(q.k * 6.7) * TAU;
      c.beginPath(); c.arc(q.x * R, q.y * R, cell * 0.5, a, a + 1.8); c.stroke();
    }
    c.globalAlpha = 1;
  }
  // cheese
  for (const q of CELLS) {
    const d = p.cg[q.k];
    if (d <= 0.04) continue;
    c.fillStyle = `rgba(250,226,140,${Math.min(0.8, d * 0.5)})`;
    c.beginPath(); c.arc(q.x * R, q.y * R, cell * 0.85, 0, TAU); c.fill();
    const n = Math.min(7, Math.ceil(d * 2.4));
    for (let i = 0; i < n; i++) {
      const a = hash(q.k * 3 + i * 17) * TAU, r = hash(q.k * 5 + i * 11) * cell * 0.7;
      const x = q.x * R + Math.cos(a) * r, y = q.y * R + Math.sin(a) * r;
      const len = cell * (0.5 + hash(q.k + i * 3) * 0.55), b = a + (hash(q.k * 7 + i) - 0.5) * 1.4;
      c.strokeStyle = i % 2 ? "#f6d878" : "#fbe9a0"; c.lineWidth = 2.1; c.lineCap = "round";
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(b + 1) * len * 0.5, y + Math.sin(b + 1) * len * 0.5, x + Math.cos(b) * len, y + Math.sin(b) * len); c.stroke();
    }
  }
  L.key = key; LAYERS.set(p.uid, L);
  return L.cv;
}

// opts: { heat, dpr, born (WeakMap piece -> time), now, cuts, guides, ghost }
function drawPizza(ctx, p, cx, cy, R, opts = {}) {
  const heat = opts.heat || 0, dpr = opts.dpr || 1, now = opts.now || 0;
  ctx.save(); ctx.translate(cx, cy);

  // contact shadow
  ctx.fillStyle = "rgba(60,30,20,.22)"; blob(ctx, 3, R * 0.06, R * 1.02, R * 0.98); ctx.fill();

  // crust
  const crust = crustColor(heat);
  const g = ctx.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.2, 0, 0, R);
  g.addColorStop(0, light(crust, 0.12)); g.addColorStop(1, dark(crust, 0.12));
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); fillOut(ctx, g, 1.8);
  // crust puffs round the edge
  ctx.fillStyle = rgba(light(crust, 0.25), 0.55);
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU + hash(i) * 0.3;
    ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.94, Math.sin(a) * R * 0.94, R * 0.045, 0, TAU); ctx.fill();
  }
  // bare dough inside the crust
  const dough = mix("#f6e3b4", crust, Math.min(0.85, heat * 0.22));
  ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, TAU); ctx.fillStyle = dough; ctx.fill();
  ctx.strokeStyle = rgba(dark(crust, 0.3), 0.25); ctx.lineWidth = 1.2; ctx.stroke();

  // sauce + cheese layer
  const layer = bakeLayer(p, R, dpr);
  if (layer) ctx.drawImage(layer, -R, -R, R * 2, R * 2);

  // bake blisters on the cheese
  if (heat > 0.3) {
    const n = Math.round(Math.min(26, heat * 9));
    for (let i = 0; i < n; i++) {
      const a = hash(i * 3.1) * TAU, r = Math.sqrt(hash(i * 5.7)) * R * 0.84;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      const covered = p.cg[Math.min(GRID - 1, Math.floor((x / R + 1) / CELL)) + GRID * Math.min(GRID - 1, Math.floor((y / R + 1) / CELL))] > 0.1;
      if (!covered && heat < 2.5) continue;
      ctx.fillStyle = rgba(heat > 2.4 ? "#2a1810" : "#b9732f", Math.min(0.5, 0.1 + heat * 0.08));
      blob(ctx, x, y, R * (0.04 + hash(i * 9) * 0.04), R * (0.03 + hash(i * 7) * 0.03)); ctx.fill();
    }
  }

  // toppings, in the order they were laid
  const s = R * 0.135;
  for (const q of p.tops) {
    let scale = 1, lift = 0;
    if (opts.born) {
      const t0 = opts.born.get(q);
      if (t0 === undefined) opts.born.set(q, now);
      else { const k = Math.min(1, (now - t0) / 0.16); scale = 1 + (1 - k) * 0.55; lift = (1 - k) * -R * 0.05; }
    }
    ctx.save(); ctx.translate(q.x * R, q.y * R + lift); ctx.scale(scale, scale);
    drawTopping(ctx, q.t, 0, 0, s, q.rot, q.v, heat);
    ctx.restore();
  }
  // a little toasting over the toppings once it is really dark
  if (heat > 2) { ctx.fillStyle = `rgba(30,12,6,${Math.min(0.5, (heat - 2) * 0.25)})`; ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, TAU); ctx.fill(); }

  // cuts
  if (opts.cuts !== false && p.cuts.length) {
    for (const a of p.cuts) {
      const dx = Math.cos(a) * R, dy = Math.sin(a) * R;
      ctx.strokeStyle = "rgba(50,24,14,.7)"; ctx.lineWidth = 2.6; ctx.lineCap = "butt";
      ctx.beginPath(); ctx.moveTo(-dx, -dy); ctx.lineTo(dx, dy); ctx.stroke();
      ctx.strokeStyle = "rgba(255,240,205,.5)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-dx, -dy + 1.4); ctx.lineTo(dx, dy + 1.4); ctx.stroke();
    }
  }
  // guide lines (dashed): where the next cuts should fall
  if (opts.guides && opts.guides.length) {
    ctx.setLineDash([6, 6]); ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2;
    for (const a of opts.guides) {
      ctx.beginPath(); ctx.moveTo(-Math.cos(a) * R, -Math.sin(a) * R); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/* ------------------------------ steel bins and bowls ------------------------------ */

// A steel tray seen from above, heaped with its contents. Used for the dock.
function drawBin(ctx, id, w, h) {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#c9d0d6"); g.addColorStop(1, "#8f9aa3");
  roundRect(ctx, 1, 1, w - 2, h - 2, 6); fillOut(ctx, g, 1.6);
  roundRect(ctx, 5, 5, w - 10, h - 10, 4); ctx.fillStyle = "#59636b"; ctx.fill();
  ctx.clip();
  // heap
  const n = 11, s = Math.min(w, h) * 0.2;
  for (let i = 0; i < n; i++) {
    const a = hash(i * 2.3 + id.length) * TAU, r = Math.sqrt(hash(i * 5.1)) * Math.min(w, h) * 0.34;
    drawTopping(ctx, id, w / 2 + Math.cos(a) * r * 1.4, h / 2 + Math.sin(a) * r * 0.9, s, hash(i * 7) * TAU, i % 3, 0);
  }
  ctx.restore();
}

function drawBowl(ctx, sauceId, w, h) {
  const col = SAUCE[sauceId].color, dk = SAUCE[sauceId].dark;
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#d4dae0"); g.addColorStop(1, "#98a3ab");
  roundRect(ctx, 1, 1, w - 2, h - 2, 6); fillOut(ctx, g, 1.6);
  roundRect(ctx, 5, 5, w - 10, h - 10, 4); ctx.fillStyle = "#59636b"; ctx.fill();
  ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.36, h * 0.3, 0, 0, TAU); fillOut(ctx, col, 1.2);
  ctx.strokeStyle = dk; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.2, h * 0.14, 0, 0.3, 3.2); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.3, h * 0.24, 0, 3.6, 4.5); ctx.stroke();
  ctx.restore();
}

function drawCheeseBin(ctx, w, h) {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#c9d0d6"); g.addColorStop(1, "#8f9aa3");
  roundRect(ctx, 1, 1, w - 2, h - 2, 6); fillOut(ctx, g, 1.6);
  roundRect(ctx, 5, 5, w - 10, h - 10, 4); ctx.fillStyle = "#f0d070"; ctx.fill();
  ctx.clip();
  for (let i = 0; i < 70; i++) {
    const x = 6 + hash(i * 1.7) * (w - 12), y = 6 + hash(i * 3.3) * (h - 12), a = hash(i * 9) * TAU;
    ctx.strokeStyle = i % 2 ? "#f9e39a" : "#e6bd4c"; ctx.lineWidth = 1.8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------- people ------------------------------------- */

// A bust: head, shoulders, hair, a face that shows how they feel. y is the
// bottom of the shoulders; s = 1 is about 70px tall. `mood` is 0 (furious) to
// 1 (delighted).
function drawPerson(ctx, x, y, s, look, kind, mood = 0.7, t = 0, blinkAt = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const kid = look.age === 0;
  const skin = SKINS[look.skin], skinD = dark(skin, 0.14), skinL = light(skin, 0.12);
  const hairC = HAIRS[look.hairCol];
  const shirt = SHIRTS[look.shirt];
  const hy = kid ? -41 : -46;           // head centre
  const hrx = kid ? 17 : 15.5, hry = kid ? 17.5 : 17.5;
  const invisible = kind === "invisible";
  const robot = kind === "robot";

  /* back hair */
  const hair = look.hair;
  if (!robot && !invisible && look.hat !== 7) {
    ctx.fillStyle = hairC;
    if (hair === 2) { roundRect(ctx, -hrx - 4, hy - 8, hrx * 2 + 8, 46, 12); fillOut(ctx, hairC); }
    if (hair === 7) { blob(ctx, 0, hy - 3, hrx + 10, hry + 9); fillOut(ctx, hairC); }
    if (hair === 4) { blob(ctx, 0, hy - hry - 6, 8, 7); fillOut(ctx, hairC); }
    if (hair === 6) { blob(ctx, hrx + 5, hy + 8, 5, 12, -0.3); fillOut(ctx, hairC); }
  }

  /* body */
  if (robot) {
    roundRect(ctx, -24, -30, 48, 30, 8); fillOut(ctx, "#a9b6c2");
    ctx.fillStyle = "#6fb6d9"; roundRect(ctx, -9, -22, 18, 9, 3); ctx.fill();
    ctx.fillStyle = "#e6f2fa"; ctx.fillRect(-7, -20, 6, 2); ctx.fillRect(1, -20, 6, 2);
  } else if (kind === "cultist") {
    ctx.beginPath(); ctx.moveTo(-31, 0); ctx.quadraticCurveTo(-30, -30, -10, -34); ctx.lineTo(10, -34); ctx.quadraticCurveTo(30, -30, 31, 0); ctx.closePath(); fillOut(ctx, "#6c4a8a");
    ctx.fillStyle = "#f0c850"; ctx.beginPath(); ctx.arc(0, -15, 5, 0, TAU); fillOut(ctx, "#f0c850", 1.2);
    ctx.strokeStyle = "#f0c850"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-9, -31); ctx.quadraticCurveTo(0, -16, 9, -31); ctx.stroke();
  } else if (invisible) {
    ctx.beginPath(); ctx.moveTo(-28, 0); ctx.quadraticCurveTo(-27, -28, -10, -32); ctx.lineTo(10, -32); ctx.quadraticCurveTo(27, -28, 28, 0); ctx.closePath();
    ctx.fillStyle = "rgba(140,150,170,.18)"; ctx.fill(); ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(90,70,60,.4)"; ctx.lineWidth = 1.3; ctx.stroke(); ctx.setLineDash([]);
  } else {
    const w = kid ? 22 : 27;
    ctx.beginPath(); ctx.moveTo(-w - 2, 0); ctx.quadraticCurveTo(-w - 1, -26, -9, -31); ctx.lineTo(9, -31); ctx.quadraticCurveTo(w + 1, -26, w + 2, 0); ctx.closePath();
    const cloth = kind === "mime" ? "#f4f1ea" : kind === "fire" ? "#d9463a" : kind === "vampire" ? "#2b1a22" : shirt;
    fillOut(ctx, cloth);
    if (kind === "mime") { ctx.save(); ctx.clip(); ctx.fillStyle = "#2a2a30"; for (let i = -4; i < 4; i++) ctx.fillRect(-40, -34 + i * 8 + 4, 80, 3.5); ctx.restore(); ctx.beginPath(); ctx.moveTo(-w - 2, 0); ctx.quadraticCurveTo(-w - 1, -26, -9, -31); ctx.lineTo(9, -31); ctx.quadraticCurveTo(w + 1, -26, w + 2, 0); ctx.closePath(); outline(ctx); }
    if (kind === "fire") { ctx.fillStyle = "#f2d04a"; ctx.fillRect(-w, -9, w * 2, 3.4); }
    if (kind === "vampire") { ctx.fillStyle = "#a3243a"; ctx.beginPath(); ctx.moveTo(-9, -31); ctx.lineTo(-24, -26); ctx.lineTo(-16, -9); ctx.lineTo(-4, -22); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(9, -31); ctx.lineTo(24, -26); ctx.lineTo(16, -9); ctx.lineTo(4, -22); ctx.closePath(); ctx.fill(); }
    // collar
    if (!kind || kind === "tourist" || kind === "critic" || kind === "prof") { ctx.fillStyle = light(cloth, 0.35); ctx.beginPath(); ctx.moveTo(-8, -31); ctx.lineTo(0, -22); ctx.lineTo(8, -31); ctx.lineTo(4, -31); ctx.lineTo(0, -26); ctx.lineTo(-4, -31); ctx.closePath(); ctx.fill(); }
    if (kind === "tourist") { ctx.strokeStyle = "#4a3a30"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-14, -30); ctx.lineTo(10, -4); ctx.stroke(); ctx.fillStyle = "#3b3b44"; roundRect(ctx, 5, -9, 14, 10, 2); fillOut(ctx, "#3b3b44", 1.1); ctx.fillStyle = "#cfd8de"; ctx.beginPath(); ctx.arc(12, -4, 3.2, 0, TAU); ctx.fill(); }
    if (kind === "critic") { ctx.fillStyle = "#f6f1e0"; roundRect(ctx, 6, -16, 15, 17, 2); fillOut(ctx, "#f6f1e0", 1.1); ctx.strokeStyle = "#9a8e78"; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(9, -12 + i * 4); ctx.lineTo(18, -12 + i * 4); ctx.stroke(); } }
  }

  /* neck */
  if (!robot && !invisible) { ctx.fillStyle = skinD; roundRect(ctx, -5.5, hy + hry - 6, 11, 14, 3); ctx.fill(); }

  /* head */
  if (robot) {
    roundRect(ctx, -17, hy - 17, 34, 31, 8); fillOut(ctx, "#c4cfd9");
    ctx.strokeStyle = "#7c8a96"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, hy - 17); ctx.lineTo(0, hy - 26); ctx.stroke();
    ctx.fillStyle = "#e4574a"; ctx.beginPath(); ctx.arc(0, hy - 27, 3.4, 0, TAU); fillOut(ctx, "#e4574a", 1);
    ctx.fillStyle = "#16303d"; roundRect(ctx, -12, hy - 9, 24, 12, 4); ctx.fill();
    const blink = (t + blinkAt) % 3.2 < 0.12;
    ctx.fillStyle = "#6ff0c8"; ctx.fillRect(-8, hy - 6 + (blink ? 3 : 0), 5, blink ? 1.4 : 6); ctx.fillRect(3, hy - 6 + (blink ? 3 : 0), 5, blink ? 1.4 : 6);
    ctx.strokeStyle = "#16303d"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, hy + 8); ctx.quadraticCurveTo(0, hy + 8 + (mood > 0.5 ? 3 : -2), 6, hy + 8); ctx.stroke();
    ctx.restore(); return;
  }
  if (!invisible) {
    // ears
    ctx.fillStyle = skinD; blob(ctx, -hrx + 0.5, hy + 2, 3.6, 5); fillOut(ctx, skinD, 1.1); blob(ctx, hrx - 0.5, hy + 2, 3.6, 5); fillOut(ctx, skinD, 1.1);
    blob(ctx, 0, hy, hrx, hry); fillOut(ctx, kind === "mime" ? "#f7f3ec" : skin, 1.6);
    // cheek light
    ctx.fillStyle = rgba(skinL, 0.4); blob(ctx, -hrx * 0.4, hy - 4, 5, 6); ctx.fill();
  }

  /* face */
  const ey = hy + 1.5;
  const blink = (t + blinkAt) % 3.6 < 0.11;
  if (!invisible) {
    ctx.fillStyle = INK;
    for (const sx of [-1, 1]) {
      if (blink) { ctx.fillRect(sx * 6 - 2.2, ey, 4.4, 1.3); }
      else { blob(ctx, sx * 6, ey, 1.9, kid ? 2.5 : 2.1); ctx.fill(); }
    }
    // brows
    ctx.strokeStyle = dark(hairC, 0.2); ctx.lineWidth = 1.6; ctx.lineCap = "round";
    // Cross brows slope down toward the nose; happy ones lift in the middle.
    const tilt = (0.6 - mood) * 4.5;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 9.5, ey - 6.5 - tilt * 0.45); ctx.lineTo(sx * 3, ey - 6.5 + tilt * 0.45); ctx.stroke(); }
    // nose
    const nr = [2.4, 3.2, 4.2][look.nose || 0];
    ctx.fillStyle = skinD; blob(ctx, 0, ey + 5, nr * 0.9, nr * 0.75); fillOut(ctx, skinD, 1);
    // mouth
    ctx.strokeStyle = "#7a3a36"; ctx.lineWidth = 1.7;
    const my = ey + 11;
    ctx.beginPath();
    if (mood > 0.62) { ctx.moveTo(-5.5, my - 1); ctx.quadraticCurveTo(0, my + 5.5, 5.5, my - 1); }
    else if (mood > 0.34) { ctx.moveTo(-4, my + 1); ctx.lineTo(4, my + 1); }
    else { ctx.moveTo(-5, my + 3); ctx.quadraticCurveTo(0, my - 2.5, 5, my + 3); }
    ctx.stroke();
    if (mood > 0.85) { ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.moveTo(-4.5, my - 0.5); ctx.quadraticCurveTo(0, my + 4.5, 4.5, my - 0.5); ctx.closePath(); ctx.fill(); }
    if (mood < 0.3) { ctx.fillStyle = "rgba(120,180,230,.85)"; blob(ctx, hrx - 1, hy - 9, 2.2, 3.2); ctx.fill(); }   // a sweat drop
    ctx.fillStyle = "rgba(235,120,120,.28)"; blob(ctx, -9.5, ey + 7, 3.4, 2.4); ctx.fill(); blob(ctx, 9.5, ey + 7, 3.4, 2.4); ctx.fill();
    if (kind === "vampire") { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-3, my + 0.5); ctx.lineTo(-2, my + 4); ctx.lineTo(-1, my + 0.5); ctx.fill(); ctx.beginPath(); ctx.moveTo(3, my + 0.5); ctx.lineTo(2, my + 4); ctx.lineTo(1, my + 0.5); ctx.fill(); }
    // age
    if (look.age === 3) { ctx.strokeStyle = rgba(skinD, 0.7); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-12, ey + 1); ctx.lineTo(-9, ey + 2.5); ctx.moveTo(12, ey + 1); ctx.lineTo(9, ey + 2.5); ctx.stroke(); }
    // beard / moustache
    ctx.fillStyle = dark(hairC, 0.05);
    if (look.beard === 1 || look.beard === 2) { blob(ctx, 0, ey + 8.6, 8.5, 3); fillOut(ctx, ctx.fillStyle, 1); }
    if (look.beard === 2) { ctx.beginPath(); ctx.moveTo(-hrx + 1, ey + 4); ctx.quadraticCurveTo(0, hy + hry + 11, hrx - 1, ey + 4); ctx.quadraticCurveTo(0, ey + 11, -hrx + 1, ey + 4); fillOut(ctx, dark(hairC, 0.05), 1.2); }
    if (look.beard === 3) { blob(ctx, 0, ey + 15.5, 4, 4.4); fillOut(ctx, dark(hairC, 0.05), 1); }
  }

  /* front hair */
  if (!invisible && look.hat !== 7 && look.hat !== 9 && look.hat !== 6) {
    const top = hy - hry;
    ctx.fillStyle = hairC;
    if (hair === 1 || hair === 4 || hair === 6) {
      ctx.beginPath(); ctx.moveTo(-hrx - 1, hy - 4); ctx.quadraticCurveTo(-hrx, top - 5, 0, top - 3); ctx.quadraticCurveTo(hrx, top - 5, hrx + 1, hy - 4); ctx.quadraticCurveTo(hrx - 4, hy - 11, 0, hy - 9); ctx.quadraticCurveTo(-hrx + 4, hy - 11, -hrx - 1, hy - 4); ctx.closePath(); fillOut(ctx, hairC, 1.3);
    } else if (hair === 2) {
      ctx.beginPath(); ctx.moveTo(-hrx - 2, hy + 10); ctx.quadraticCurveTo(-hrx - 3, top - 5, 0, top - 4); ctx.quadraticCurveTo(hrx + 3, top - 5, hrx + 2, hy + 10); ctx.lineTo(hrx - 2, hy + 4); ctx.quadraticCurveTo(hrx - 4, hy - 10, 2, hy - 10); ctx.quadraticCurveTo(-hrx + 3, hy - 9, -hrx + 2, hy + 4); ctx.closePath(); fillOut(ctx, hairC, 1.3);
    } else if (hair === 3 || hair === 7) {
      for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; blob(ctx, Math.cos(a) * (hrx - 1), hy - 2 + Math.sin(a) * (hry - 1), 5.4, 5.4); fillOut(ctx, hairC, 1.1); }
    } else if (hair === 5) {
      ctx.beginPath(); ctx.moveTo(-hrx, hy - 7);
      for (let i = 0; i < 6; i++) { const x = -hrx + (i + 0.5) * (hrx * 2 / 6); ctx.lineTo(x - 3, top - 1); ctx.lineTo(x, top - 11 - (i % 2) * 4); ctx.lineTo(x + 3, top - 1); }
      ctx.lineTo(hrx, hy - 7); ctx.quadraticCurveTo(0, hy - 12, -hrx, hy - 7); ctx.closePath(); fillOut(ctx, hairC, 1.3);
    }
  }

  /* glasses */
  if (look.glasses && !robot) {
    ctx.strokeStyle = "#3b2f2a"; ctx.lineWidth = 1.6;
    for (const sx of [-1, 1]) {
      if (look.glasses === 1) { ctx.beginPath(); ctx.arc(sx * 6.2, ey, 5.2, 0, TAU); ctx.stroke(); }
      else { roundRect(ctx, sx * 6.2 - 5, ey - 4, 10, 8, 2); ctx.stroke(); }
    }
    ctx.beginPath(); ctx.moveTo(-1.2, ey - 0.5); ctx.lineTo(1.2, ey - 0.5); ctx.stroke();
    ctx.fillStyle = "rgba(220,240,255,.28)"; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 6.2, ey, 4.4, 0, TAU); ctx.fill(); }
  }

  /* hats */
  const top = hy - hry;
  switch (look.hat) {
    case 1: ctx.beginPath(); ctx.moveTo(-hrx - 1, hy - 8); ctx.quadraticCurveTo(-hrx, top - 14, 0, top - 14); ctx.quadraticCurveTo(hrx, top - 14, hrx + 1, hy - 8); ctx.closePath(); fillOut(ctx, "#d9534a", 1.4); ctx.fillStyle = "#b73e36"; ctx.fillRect(-hrx - 1, hy - 12, hrx * 2 + 2, 5); ctx.beginPath(); ctx.arc(0, top - 15, 4.2, 0, TAU); fillOut(ctx, "#f2efe6", 1.2); break;
    case 2: ctx.beginPath(); ctx.moveTo(-hrx - 1, hy - 8); ctx.quadraticCurveTo(-hrx, top - 10, 0, top - 10); ctx.quadraticCurveTo(hrx, top - 10, hrx + 1, hy - 8); ctx.closePath(); fillOut(ctx, "#4a7fb8", 1.4); ctx.beginPath(); ctx.ellipse(hrx - 1, hy - 7, 12, 3.6, 0, 0, TAU); fillOut(ctx, "#3a6a9c", 1.2); break;
    case 3: ctx.beginPath(); ctx.ellipse(0, hy - 10, hrx + 15, 6.5, 0, 0, TAU); fillOut(ctx, "#f2dba0", 1.4); ctx.beginPath(); ctx.moveTo(-hrx + 1, hy - 11); ctx.quadraticCurveTo(0, top - 15, hrx - 1, hy - 11); ctx.closePath(); fillOut(ctx, "#f6e4b0", 1.4); ctx.fillStyle = "#e4806a"; ctx.fillRect(-hrx + 2, hy - 15, hrx * 2 - 4, 3.4); break;
    case 4: for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; blob(ctx, hrx - 3 + Math.cos(a) * 3.4, top + 3 + Math.sin(a) * 3.4, 2.7, 2.7); fillOut(ctx, "#f6a4c2", 1); } ctx.beginPath(); ctx.arc(hrx - 3, top + 3, 2, 0, TAU); fillOut(ctx, "#f4d35e", 1); break;
    case 5: roundRect(ctx, -hrx + 1, top - 17, hrx * 2 - 2, 16, 7); fillOut(ctx, "#fbfaf5", 1.4); ctx.beginPath(); ctx.arc(-6, top - 17, 7, 0, TAU); fillOut(ctx, "#fbfaf5", 1.3); ctx.beginPath(); ctx.arc(6, top - 17, 7, 0, TAU); fillOut(ctx, "#fbfaf5", 1.3); ctx.fillRect(-hrx, hy - 11, hrx * 2, 4); outline(ctx, 1); break;
    case 6: ctx.beginPath(); ctx.moveTo(-hrx - 2, hy - 6); ctx.quadraticCurveTo(-hrx, top - 13, 0, top - 14); ctx.quadraticCurveTo(hrx, top - 13, hrx + 2, hy - 6); ctx.closePath(); fillOut(ctx, "#f2c230", 1.4); ctx.beginPath(); ctx.ellipse(0, hy - 6, hrx + 7, 3.4, 0, 0, TAU); fillOut(ctx, "#dca820", 1.2); ctx.fillStyle = "#d9463a"; ctx.beginPath(); ctx.moveTo(-4, top - 8); ctx.lineTo(4, top - 8); ctx.lineTo(3, hy - 9); ctx.lineTo(-3, hy - 9); ctx.fill(); break;
    case 7: ctx.beginPath(); ctx.moveTo(-hrx - 6, hy + 14); ctx.quadraticCurveTo(-hrx - 8, top - 14, 0, top - 15); ctx.quadraticCurveTo(hrx + 8, top - 14, hrx + 6, hy + 14); ctx.quadraticCurveTo(hrx - 1, hy - 14, 0, hy - 13); ctx.quadraticCurveTo(-hrx + 1, hy - 14, -hrx - 6, hy + 14); ctx.closePath(); fillOut(ctx, "#6c4a8a", 1.4); break;
    case 8: ctx.beginPath(); ctx.ellipse(0, hy - 4, 17, 4, 0, 0, TAU); fillOut(ctx, "#6a5a48", 1.3); roundRect(ctx, -10, hy - 22, 20, 18, 6); fillOut(ctx, "#7b6a56", 1.3); ctx.fillStyle = "#c9b898"; ctx.fillRect(-10, hy - 10, 20, 3.4); ctx.strokeStyle = "#b98a9a"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-10, hy + 18); ctx.quadraticCurveTo(0, hy + 24, 10, hy + 18); ctx.stroke(); break;
    case 9: ctx.beginPath(); ctx.ellipse(-3, top - 3, 18, 7, -0.15, 0, TAU); fillOut(ctx, "#2f2f38", 1.3); ctx.beginPath(); ctx.arc(-3, top - 10, 2.3, 0, TAU); fillOut(ctx, "#2f2f38", 1); break;
  }
  if (kind === "prof") { ctx.fillStyle = HAIRS[6]; for (const sx of [-1, 1]) { blob(ctx, sx * (hrx + 2), hy - 6, 6, 8, sx * 0.4); fillOut(ctx, HAIRS[6], 1.1); } }
  ctx.restore();
}

// What the mood number means: 1 delighted .. 0 furious, from a happiness meter.
const moodFor = (happy) => (happy > 0.55 ? 0.8 : happy > 0.25 ? 0.5 : 0.18);

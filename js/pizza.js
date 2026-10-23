// Slice of Life — one pizza, and how it is judged.
//
// A pizza is plain data: two coverage grids (sauce, cheese), a list of topping
// pieces, how many trips it has made through the oven, and the cuts. Nothing
// here draws or reads a clock, so the grader runs identically in the game, the
// tests and the balance bot.
//
// Coordinates are NORMALISED: the pizza has radius 1, centred on 0,0, +x to the
// player's right and -y up the screen. The renderer maps those to pixels; the
// engine never sees a pixel.

const GRID = 20;                 // sauce / cheese grid cells across the diameter
const CELL = 2 / GRID;
const SAUCE_EDGE = 0.88;         // beyond this is bare crust, as on a real pizza
const PIECE_MAX = 0.86;          // a topping's centre must land inside this
const MAX_PIECES = 64;
const BOUNDARY = 0.07;           // forgiveness either side of a dividing line
const MAX_CUTS = 8;

// Grid cells whose centre is on the sauce, computed once.
const CELLS = (() => {
  const out = [];
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
    const x = -1 + (i + 0.5) * CELL, y = -1 + (j + 0.5) * CELL;
    if (x * x + y * y <= SAUCE_EDGE * SAUCE_EDGE) out.push({ i, j, k: j * GRID + i, x, y });
  }
  return out;
})();

// A coarse 6x6 lattice for "is it spread out?" — 1/3 of a pizza radius a side.
const SPREAD_N = 6;
const spreadCell = (x, y) => {
  const i = Math.min(SPREAD_N - 1, Math.max(0, Math.floor((x + 1) * SPREAD_N / 2)));
  const j = Math.min(SPREAD_N - 1, Math.max(0, Math.floor((y + 1) * SPREAD_N / 2)));
  return j * SPREAD_N + i;
};
const SPREAD_CENTRES = (() => {
  const out = [];
  for (let j = 0; j < SPREAD_N; j++) for (let i = 0; i < SPREAD_N; i++) {
    const x = -1 + (i + 0.5) * 2 / SPREAD_N, y = -1 + (j + 0.5) * 2 / SPREAD_N;
    if (x * x + y * y <= 0.9 * 0.9) out.push({ k: j * SPREAD_N + i, x, y });
  }
  return out;
})();

// Every pizza ever made gets its own serial. The customer id restarts at 1 each
// day, so the renderer cannot key its cached sauce layer on that — a new day's
// first pizza would find the last day's picture waiting for it.
let PIZZA_UID = 0;

function newPizza(id) {
  return {
    id,
    uid: ++PIZZA_UID,
    sauce: null,                       // the sauce type spread, if any
    sg: new Float32Array(GRID * GRID), // 0..1 per cell
    cg: new Float32Array(GRID * GRID), // 0..3 per cell
    tops: [],                          // { t, x, y, rot, v }
    runs: 0,                           // completed trips through the oven
    cuts: [],                          // angles in [0, PI)
    boxed: false,
    rev: 0,                            // bumped on every change, for the renderer's cache
  };
}

const inRegion = (region, x, y) => REGIONS[region].test(x, y);
// In the region, or close enough to its edge that nobody could say otherwise.
const inRegionSoft = (region, x, y) => {
  if (region === "whole") return true;
  const r = REGIONS[region];
  return r.test(x, y) || r.test(x + BOUNDARY, y) || r.test(x - BOUNDARY, y)
    || r.test(x, y + BOUNDARY) || r.test(x, y - BOUNDARY);
};

/* ------------------------------ building ------------------------------ */

// Returns the number of cells newly covered. Switching sauces scrapes the old
// one off first — you cannot half-and-half a bowl.
function paintSauce(p, type, x, y, r) {
  let scraped = false;
  if (p.sauce && p.sauce !== type && sauceCoverage(p) > 0.02) { p.sg.fill(0); scraped = true; }
  p.sauce = type;
  let n = 0;
  for (const c of CELLS) {
    const dx = c.x - x, dy = c.y - y;
    if (dx * dx + dy * dy <= r * r && p.sg[c.k] < 1) { p.sg[c.k] = 1; n++; }
  }
  if (n || scraped) p.rev++;
  return { n, scraped };
}

// One shake of the cheese. A full pass across a cell is worth about 1.0, so two
// passes make it "extra".
function sprinkle(p, x, y, r, amount = 0.1) {
  let n = 0;
  for (const c of CELLS) {
    const dx = c.x - x, dy = c.y - y;
    if (dx * dx + dy * dy <= r * r) { p.cg[c.k] = Math.min(3, p.cg[c.k] + amount); n++; }
  }
  if (n) p.rev++;
  return n;
}

function scrape(p) {
  p.sg.fill(0); p.cg.fill(0); p.sauce = null; p.rev++;
}

function dropTopping(p, t, x, y, rand = Math.random) {
  if (p.tops.length >= MAX_PIECES) return null;
  if (x * x + y * y > PIECE_MAX * PIECE_MAX) return null;
  const piece = { t, x, y, rot: rand() * Math.PI * 2, v: Math.floor(rand() * 3) };
  p.tops.push(piece);
  p.rev++;
  return piece;
}

function undoTopping(p) {
  const last = p.tops.pop();
  if (last) p.rev++;
  return last || null;
}

function clearToppings(p) { if (p.tops.length) { p.tops.length = 0; p.rev++; } }

/* -------------------------------- cutting ------------------------------- */

const normAngle = (a) => ((a % Math.PI) + Math.PI) % Math.PI;
const angleGap = (a, b) => { const d = Math.abs(normAngle(a) - normAngle(b)); return Math.min(d, Math.PI - d); };

// Distance from the pizza's centre to the (infinite) line through two points.
function lineDistToCentre(ax, ay, bx, by) {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 1e-6) return Infinity;
  return Math.abs(ax * by - ay * bx) / len;
}

function addCut(p, angle) {
  if (p.cuts.length >= MAX_CUTS) return { ok: false, why: "toomany" };
  const a = normAngle(angle);
  if (p.cuts.some((c) => angleGap(c, a) < 0.1)) return { ok: false, why: "samespot" };
  p.cuts.push(a); p.rev++;
  return { ok: true, angle: a };
}

function undoCut(p) { const c = p.cuts.pop(); if (c !== undefined) p.rev++; return c; }

// The cut line a guide would suggest next, for a pizza that wants `slices`.
// The first cut is wherever the player likes; every other one falls on the
// even spacing from it.
function guideAngles(p, slices) {
  if (slices < 2 || !p.cuts.length) return [];
  const n = slices / 2, step = Math.PI / n, base = p.cuts[0];
  const out = [];
  for (let k = 1; k < n; k++) {
    const a = normAngle(base + k * step);
    if (!p.cuts.some((c) => angleGap(c, a) < step * 0.35)) out.push(a);
  }
  return out;
}

// A soft snap: if the player's swipe is near a guide line, use it exactly.
function snapCut(p, raw, slices) {
  const guides = guideAngles(p, slices);
  let best = null, bd = 0.2;           // ~11 degrees of pull
  for (const g of guides) { const d = angleGap(raw, g); if (d < bd) { bd = d; best = g; } }
  return best === null ? raw : best;
}

const slicesOf = (p) => (p.cuts.length ? p.cuts.length * 2 : 1);

/* ------------------------------- measuring ------------------------------ */

function sauceCoverage(p) {
  let n = 0;
  for (const c of CELLS) if (p.sg[c.k] >= 1) n++;
  return n / CELLS.length;
}
function cheeseDensity(p) {
  let s = 0;
  for (const c of CELLS) s += p.cg[c.k];
  return s / CELLS.length;
}
function cheeseCoverage(p) {
  let n = 0;
  for (const c of CELLS) if (p.cg[c.k] >= 0.4) n++;
  return n / CELLS.length;
}

const countOf = (p, t) => p.tops.reduce((n, q) => n + (q.t === t ? 1 : 0), 0);

// Where on the lattice a topping type sits, restricted to a region.
function spreadIn(p, t, region) {
  const cells = SPREAD_CENTRES.filter((c) => inRegion(region, c.x, c.y));
  if (!cells.length) return 1;
  const have = new Set();
  let n = 0;
  for (const q of p.tops) {
    if (q.t !== t || !inRegionSoft(region, q.x, q.y)) continue;
    n++; have.add(spreadCell(q.x, q.y));
  }
  let occ = 0;
  for (const c of cells) if (have.has(c.k)) occ++;
  const want = Math.max(1, Math.min(cells.length * 0.7, quotaFor(region) * 0.8));
  return n ? Math.min(1, occ / want) : 0;
}

// What this pizza costs the kitchen, in cents. Charged when it is served,
// binned, or abandoned — whichever happens to it.
function pizzaCost(p) {
  let c = BASE_COST;
  if (p.sauce && sauceCoverage(p) > 0.05) c += SAUCE[p.sauce].cost;
  if (cheeseDensity(p) > 1.6) c += EXTRA_CHEESE_COST;
  for (const q of p.tops) c += TOP[q.t].cost;
  return c;
}

/* -------------------------------- grading ------------------------------- */

// The grade is two separate questions.
//
//   fails[]  — did they get what they ASKED for? Any entry here means the
//              customer hands it back and takes their money with them. Each is
//              a plain sentence a child can act on, because this is the only
//              way the game ever teaches the rules.
//   parts    — how WELL was it made? Sauce and cheese coverage, how many
//              pieces, how evenly they sit, how even the cut is. This is what
//              sets the stars, and so the tip.
function gradePizza(order, p) {
  const fails = [], notes = [];
  const fail = (code, text) => { fails.push({ code, text }); notes.push({ ok: false, text }); };
  const good = (text) => notes.push({ ok: true, text });
  const warn = (text) => notes.push({ ok: false, soft: true, text });

  /* sauce */
  const sc = sauceCoverage(p);
  let sauceScore = 1;
  if (order.sauce === "none") {
    if (sc > 0.08) { fail("sauce", "They asked for no sauce."); sauceScore = 0; }
    else good("No sauce, as asked.");
  } else if (p.sauce !== order.sauce || sc < 0.12) {
    sauceScore = 0;
    if (!p.sauce || sc < 0.12) fail("sauce", `There's hardly any ${SAUCE[order.sauce].say} sauce on it.`);
    else fail("sauce", `They wanted ${SAUCE[order.sauce].say} sauce, not ${SAUCE[p.sauce].say}.`);
  } else {
    sauceScore = Math.min(1, sc / 0.85);
    if (sauceScore < 0.7) warn("The sauce is patchy."); else good("Nicely sauced.");
  }

  /* cheese */
  const cd = cheeseDensity(p), cc = cheeseCoverage(p);
  let cheeseScore = 1;
  if (order.cheese === "none") {
    if (cd > 0.05) { fail("cheese", "They asked for no cheese."); cheeseScore = 0; }
    else good("No cheese, as asked.");
  } else if (order.cheese === "extra") {
    if (cd < 1.3) { fail("cheese", "They wanted EXTRA cheese."); cheeseScore = 0; }
    else { cheeseScore = Math.min(1, cc / 0.85); good("Extra cheese — lovely."); }
  } else if (cd < 0.3) {
    fail("cheese", "There's hardly any cheese on it."); cheeseScore = 0;
  } else {
    cheeseScore = Math.min(1, cc / 0.85);
    if (cd > 2.4) { cheeseScore *= 0.8; warn("That's an awful lot of cheese."); }
    else if (cheeseScore < 0.7) warn("The cheese is patchy."); else good("Cheesy enough.");
  }

  /* toppings */
  const reqs = order.reqs || [];
  const rules = order.rules || [];
  const wantedTypes = new Set(reqs.map((r) => r.t));
  const veg = rules.find((r) => r.type === "veg");
  const byType = {};
  for (const r of reqs) (byType[r.t] = byType[r.t] || []).push(r.region);

  let quantity = 0, spread = 0, needed = 0, strays = 0;
  for (const [t, regions] of Object.entries(byType)) {
    let ratioSum = 0, spreadSum = 0;
    for (const region of regions) {
      const n = p.tops.reduce((m, q) => m + (q.t === t && inRegionSoft(region, q.x, q.y) ? 1 : 0), 0);
      ratioSum += Math.min(1, n / quotaFor(region));
      spreadSum += spreadIn(p, t, region);
      needed += quotaFor(region);
    }
    const ratio = ratioSum / regions.length;
    quantity += ratio; spread += spreadSum / regions.length;
    const where = regions.length === 1 && regions[0] !== "whole" ? ` on ${REGIONS[regions[0]].name}` : "";
    if (ratio < 0.5) fail("missing:" + t, `Not enough ${TOP[t].plural}${where}.`);
  }
  // A stray is a piece sitting where nobody asked for that topping.
  // (A free-choice veg order has no regions to stray from; meat is its own fail.)
  const strayBy = {};
  if (!veg) {
    for (const q of p.tops) {
      const regions = byType[q.t];
      if (!regions || !regions.some((r) => inRegionSoft(r, q.x, q.y))) {
        strays++; strayBy[q.t] = (strayBy[q.t] || 0) + 1;
      }
    }
  }
  for (const [t, n] of Object.entries(strayBy)) {
    if (n >= 3) {
      if (!wantedTypes.has(t)) fail("wrong:" + t, `They didn't ask for ${TOP[t].plural}.`);
      else fail("placed:" + t, `The ${TOP[t].plural} are on the wrong part of the pizza.`);
    }
  }

  // "Vegetarian" or similar: free choice, but not meat — and not too thin.
  if (veg) {
    const meat = p.tops.filter((q) => isMeat(q.t)).length;
    if (meat) fail("meat", "That has MEAT on it — they're vegetarian!");
    const kinds = new Set();
    for (const t of new Set(p.tops.map((q) => q.t))) if (isVeg(t) && countOf(p, t) >= 4) kinds.add(t);
    needed += veg.n * 8;
    quantity += Math.min(veg.n, kinds.size);
    spread += Math.min(veg.n, kinds.size);
    if (kinds.size < veg.n) fail("veggies", `They wanted at least ${veg.n} different veg toppings.`);
  }

  const groups = Object.keys(byType).length + (veg ? veg.n : 0);
  let toppingScore = 1;
  if (groups) {
    const q = quantity / groups, s = spread / groups;
    toppingScore = q * (0.55 + 0.45 * s);
    if (s < 0.6 && q >= 0.5) warn("The toppings are bunched up.");
  }
  const strayFactor = Math.max(0, 1 - 0.12 * strays);
  if (strays && !fails.some((f) => /^(wrong|placed|meat)/.test(f.code))) warn("A few toppings strayed out of place.");
  toppingScore *= strayFactor;
  const total = p.tops.length;
  if (needed && total > needed * 2.2 + 4) { toppingScore *= 0.8; warn("That's a LOT of toppings."); }
  else if (groups && !fails.some((f) => f.code.startsWith("missing")) && toppingScore > 0.85) good("Great toppings.");
  if (!groups && total >= 3 && !veg) {
    // A plain pizza someone has put things on.
    const t = p.tops[0].t;
    fail("wrong:" + t, "They wanted a plain pizza — no toppings.");
    toppingScore = 0;
  }

  /* bake */
  const bake = BAKES.find((b) => b.runs === order.runs);
  if (p.runs !== order.runs) {
    if (p.runs === 0) fail("bake", "It was never baked!");
    else if (p.runs < order.runs) fail("bake", `They wanted it ${bake.name.toLowerCase()} — it needed ${order.runs - p.runs} more trip${order.runs - p.runs > 1 ? "s" : ""} in the oven.`);
    else fail("bake", p.runs >= 4 && order.runs < 4 ? "It's burnt!" : `That's overdone — they wanted it ${bake.name.toLowerCase()}.`);
  } else good(order.runs === 1 ? "Baked just right." : `${bake.name}, just as asked.`);

  /* cut */
  const have = slicesOf(p);
  let cutScore = 1;
  if (have !== order.slices) {
    cutScore = 0;
    fail("slices", order.slices === 1 ? "They wanted it left whole." : have === 1 ? `They wanted ${order.slices} slices — it isn't cut.` : `They wanted ${order.slices} slices, but it has ${have}.`);
  } else if (have > 1) {
    const sorted = [...p.cuts].sort((a, b) => a - b);
    const ideal = Math.PI / sorted.length;
    let dev = 0;
    for (let i = 0; i < sorted.length; i++) {
      const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + Math.PI;
      dev = Math.max(dev, Math.abs(next - sorted[i] - ideal) / ideal);
    }
    cutScore = Math.max(0, Math.min(1, 1 - Math.max(0, dev - 0.3) / 0.9));
    if (cutScore < 0.75) warn("The slices are uneven."); else good("Neat slices.");
  }

  const quality = sauceScore * 0.15 + cheeseScore * 0.15 + toppingScore * 0.55 + cutScore * 0.15;
  return {
    ok: fails.length === 0,
    fails, notes,
    parts: { sauce: sauceScore, cheese: cheeseScore, toppings: toppingScore, cut: cutScore },
    quality: fails.length ? Math.min(quality, 0.4) : quality,
  };
}

// Stars from how well it was made and how happy the customer still is.
function starsFor(quality, happy) {
  const s = quality * 0.85 + Math.max(0, Math.min(1, happy)) * 0.15;
  return s >= 0.93 ? 5 : s >= 0.80 ? 4 : s >= 0.66 ? 3 : s >= 0.50 ? 2 : 1;
}

// Price of an order in cents — what the customer pays for a correct pizza.
function orderPrice(order) {
  let c = BASE_PRICE;
  if (order.sauce === "none") c -= 50; else c += SAUCE[order.sauce].price;
  if (order.cheese === "extra") c += EXTRA_CHEESE_PRICE;
  if (order.cheese === "none") c -= 40;
  for (const r of order.reqs || []) c += Math.round(TOP[r.t].price * (REGIONS[r.region].area === 1 ? 1 : REGIONS[r.region].area === 0.5 ? 0.55 : 0.3));
  for (const rule of order.rules || []) if (rule.type === "veg") c += rule.n * 130;
  c += (order.runs - 1) * 40;
  return c;
}

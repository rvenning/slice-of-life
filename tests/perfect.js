// Build the pizza an order asks for, through the same calls the UI makes. Shared
// by the content linter ("is every order satisfiable?") and the engine tests.

// A fixed hex lattice of candidate positions: deterministic, evenly spread.
function lattice() {
  const pts = [];
  for (let row = -8; row <= 8; row++) {
    for (let col = -8; col <= 8; col++) {
      const x = (col + (row & 1 ? 0.5 : 0)) * 0.17, y = row * 0.15;
      if (x * x + y * y <= 0.78 * 0.78) pts.push([x, y]);
    }
  }
  // A fixed shuffle, so one topping's pieces scatter across the board instead
  // of filling its top rows — which is what a careful player does.
  const h = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
  return pts.sort((a, b) => h(a[0], a[1]) - h(b[0], b[1]));
}

// Cover a pizza's sauce and cheese the way a careful player does.
function sauceAndCheese(S, G, id, order, kit) {
  if (order.sauce !== "none") {
    const r = kit.sauceR;
    for (let y = -0.8; y <= 0.81; y += r * 1.1) for (let x = -0.85; x <= 0.86; x += r * 0.8) G.paintSauce(id, order.sauce, x, y);
  }
  if (order.cheese !== "none") {
    const passes = order.cheese === "extra" ? 2 : 1;
    for (let p = 0; p < passes; p++) {
      for (let y = -0.8 + p * 0.07; y <= 0.81; y += kit.cheeseR * 1.3) for (let x = -0.88; x <= 0.9; x += 0.05) G.sprinkle(id, x, y);
    }
  }
}

function toppings(S, G, id, order, extra = 2) {
  const pts = lattice();
  const used = new Set();
  const place = (t, region, n) => {
    let k = 0;
    for (const [x, y] of pts) {
      if (k >= n) break;
      if (used.has(x + "," + y)) continue;
      if (!S.inRegion(region, x, y)) continue;
      // keep clear of the dividing lines, so no piece is ambiguous
      if (region !== "whole" && (Math.abs(x) < 0.1 || Math.abs(y) < 0.1)) continue;
      used.add(x + "," + y);
      G.drop(id, t, x, y, () => 0.5);
      k++;
    }
    return k;
  };
  for (const q of order.reqs) place(q.t, q.region, S.quotaFor(q.region) + extra);
  for (const rule of order.rules || []) {
    if (rule.type !== "veg") continue;
    const veg = [...G.kit.tops].filter(S.isVeg).slice(0, rule.n);
    for (const t of veg) place(t, "whole", 7);
  }
}

// The whole thing: build, bake, cut, box. Returns the open order object.
function makePerfect(S, G, o) {
  const id = o.id, order = o.order;
  sauceAndCheese(S, G, id, order, G.kit);
  toppings(S, G, id, order);
  while (o.pizza.runs < order.runs) {
    G.toOven(id);
    for (let i = 0; i < 2000 && o.phase === "oven"; i++) G.update(0.05);
  }
  G.toCut(id);
  const n = order.slices === 1 ? 0 : order.slices / 2;
  for (let k = 0; k < n; k++) G.cut(id, (k * Math.PI) / n);
  G.box(id);
  return o;
}

module.exports = { lattice, sauceAndCheese, toppings, makePerfect };

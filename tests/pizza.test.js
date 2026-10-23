// The grader. Every rule a customer enforces has a case here, because the
// sentence a child reads on a refund is the only way the game teaches the rules.

const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./load.js");
const { toppings, sauceAndCheese } = require("./perfect.js");

const S = load();
const kit = S.kitFor({ menu: Object.fromEntries(S.TOPPINGS.map((t) => ["t:" + t.id, 1]).concat(S.SAUCES.map((s) => ["s:" + s.id, 1]))) });

const baseOrder = (over = {}) => ({ sauce: "tomato", cheese: "normal", reqs: [{ t: "pepperoni", region: "whole" }], rules: [], runs: 1, slices: 6, recipe: null, ...over });

// A pizza built the way the order asks, through the same functions the UI uses.
function build(order, tweak) {
  const G = S.Game; G.on = {};
  G.start({ day: 30, kit, seed: "t", notes: true });
  G.line.push({ id: 99, entry: S.CUSTOMER.marge, order, speech: "", patience: 9999, happy: 1, state: "line" });
  G.takeOrder();
  const o = G.open[0];
  sauceAndCheese(S, G, o.id, order, kit);
  toppings(S, G, o.id, order);
  o.pizza.runs = order.runs;
  const n = order.slices === 1 ? 0 : order.slices / 2;
  for (let k = 0; k < n; k++) S.addCut(o.pizza, (k * Math.PI) / n);
  if (tweak) tweak(o.pizza);
  return o.pizza;
}
const codes = (g) => g.fails.map((f) => f.code);

test("a pizza built to the order is accepted and rated highly", () => {
  const order = baseOrder();
  const g = S.gradePizza(order, build(order));
  assert.strictEqual(codes(g).length, 0, codes(g).join());
  assert.ok(g.quality > 0.9, `quality ${g.quality}`);
  assert.strictEqual(S.starsFor(g.quality, 1), 5);
});

test("missing toppings, wrong toppings and wrong places are refunds", () => {
  const o = baseOrder();
  assert.ok(codes(S.gradePizza(o, build(o, (p) => S.clearToppings(p)))).includes("missing:pepperoni"));
  // mushrooms nobody asked for
  assert.ok(codes(S.gradePizza(o, build(o, (p) => { for (let i = 0; i < 4; i++) S.dropTopping(p, "mushroom", -0.3 + i * 0.2, 0.3); }))).includes("wrong:mushroom"));
  // one stray is only a nudge, not a refund
  const one = S.gradePizza(o, build(o, (p) => S.dropTopping(p, "mushroom", 0.3, 0.3)));
  assert.strictEqual(codes(one).length, 0, codes(one).join());
  // half and half: the right topping on the wrong half
  const half = baseOrder({ reqs: [{ t: "pepperoni", region: "L" }, { t: "mushroom", region: "R" }] });
  const swapped = build(half, (p) => { for (const q of p.tops) q.x = -q.x; });
  const g = S.gradePizza(half, swapped);
  assert.ok(codes(g).some((c) => c.startsWith("placed:") || c.startsWith("missing:")), codes(g).join());
});

test("a dividing line is forgiving, not a trap", () => {
  const half = baseOrder({ reqs: [{ t: "pepperoni", region: "L" }] });
  const p = build(half);
  // push every piece to just over the line: still counts as 'left'
  for (const q of p.tops) q.x = Math.min(q.x, 0.03);
  assert.ok(S.gradePizza(half, p).ok);
});

test("sauce rules", () => {
  const none = baseOrder({ sauce: "none" });
  assert.ok(S.gradePizza(none, build(none)).ok, "no sauce, built with none");
  const hasSauce = baseOrder({ sauce: "none" });
  assert.ok(codes(S.gradePizza(hasSauce, build(hasSauce, (p) => S.paintSauce(p, "tomato", 0, 0, 1.4)))).includes("sauce"));
  const bbq = baseOrder({ sauce: "bbq" });
  const wrong = build(baseOrder(), () => {});
  assert.ok(codes(S.gradePizza(bbq, wrong)).includes("sauce"), "tomato where bbq was asked");
  const bare = build(baseOrder(), (p) => { p.sg.fill(0); });
  assert.ok(codes(S.gradePizza(baseOrder(), bare)).includes("sauce"), "no sauce at all");
});

test("cheese rules: none, normal, extra", () => {
  const none = baseOrder({ cheese: "none" });
  assert.ok(S.gradePizza(none, build(none)).ok);
  assert.ok(codes(S.gradePizza(none, build(baseOrder()))).includes("cheese"), "cheese where none was asked");
  const extra = baseOrder({ cheese: "extra" });
  assert.ok(S.gradePizza(extra, build(extra)).ok);
  assert.ok(codes(S.gradePizza(extra, build(baseOrder()))).includes("cheese"), "a normal pizza is not extra");
  assert.ok(codes(S.gradePizza(baseOrder(), build(baseOrder(), (p) => p.cg.fill(0)))).includes("cheese"), "no cheese at all");
});

test("the oven: the wrong number of trips is a refund, with a useful sentence", () => {
  const well = baseOrder({ runs: 2 });
  assert.ok(S.gradePizza(well, build(well)).ok);
  const under = S.gradePizza(well, build(well, (p) => { p.runs = 1; }));
  assert.ok(codes(under).includes("bake") && /more trip/.test(under.fails.find((f) => f.code === "bake").text));
  const burnt = S.gradePizza(baseOrder(), build(baseOrder(), (p) => { p.runs = 4; }));
  assert.ok(/burnt/i.test(burnt.fails.find((f) => f.code === "bake").text));
  assert.ok(/never baked/i.test(S.gradePizza(baseOrder(), build(baseOrder(), (p) => { p.runs = 0; })).fails.find((f) => f.code === "bake").text));
});

test("slices: the count is exact; evenness only sets the stars", () => {
  const o8 = baseOrder({ slices: 8 });
  assert.ok(S.gradePizza(o8, build(o8)).ok);
  assert.ok(codes(S.gradePizza(o8, build(baseOrder()))).includes("slices"), "six where eight was asked");
  const uncut = baseOrder({ slices: 1 });
  assert.ok(S.gradePizza(uncut, build(uncut)).ok);
  const uneven = build(baseOrder(), (p) => { p.cuts.length = 0; S.addCut(p, 0); S.addCut(p, 0.35); S.addCut(p, 0.7); });
  const g = S.gradePizza(baseOrder(), uneven);
  assert.ok(g.ok && g.parts.cut < 0.5, `cuts ${g.parts.cut}`);
});

test("a vegetarian order: veg only, enough of them, never meat", () => {
  const veg = baseOrder({ reqs: [], rules: [{ type: "veg", n: 2 }] });
  assert.ok(S.gradePizza(veg, build(veg)).ok, "two veg toppings, built");
  assert.ok(codes(S.gradePizza(veg, build(veg, (p) => S.dropTopping(p, "pepperoni", 0.2, 0.2)))).includes("meat"));
  assert.ok(codes(S.gradePizza(veg, build(veg, (p) => { S.clearToppings(p); for (let i = 0; i < 6; i++) S.dropTopping(p, "mushroom", -0.5 + i * 0.2, 0.1); }))).includes("veggies"));
});

test("a plain order refuses toppings", () => {
  const plain = baseOrder({ reqs: [] });
  assert.ok(S.gradePizza(plain, build(plain)).ok);
  assert.ok(!S.gradePizza(plain, build(plain, (p) => { for (let i = 0; i < 4; i++) S.dropTopping(p, "olive", -0.4 + i * 0.25, 0.2); })).ok);
});

test("piling on toppings is a soft penalty that costs money, never a refund", () => {
  const o = baseOrder();
  const heavy = build(o, (p) => { for (let i = 0; i < 40; i++) S.dropTopping(p, "pepperoni", Math.cos(i) * 0.6, Math.sin(i) * 0.6); });
  const g = S.gradePizza(o, heavy);
  assert.ok(g.ok);
  assert.ok(S.pizzaCost(heavy) > S.pizzaCost(build(o)) + 200, "ingredients should cost real money");
});

test("the board holds a limited number of pieces and keeps them on the pizza", () => {
  const p = S.newPizza(1);
  assert.strictEqual(S.dropTopping(p, "olive", 0.99, 0.1), null, "off the edge");
  for (let i = 0; i < 70; i++) S.dropTopping(p, "olive", 0.1, 0.1);
  assert.strictEqual(p.tops.length, S.MAX_PIECES);
});

test("cuts: no duplicates, a cap, and a snap that only pulls nearby", () => {
  const p = S.newPizza(2);
  assert.ok(S.addCut(p, 0).ok);
  assert.strictEqual(S.addCut(p, 0.03).why, "samespot");
  for (let k = 1; k < 8; k++) assert.ok(S.addCut(p, k * 0.39).ok);
  assert.strictEqual(S.addCut(p, 3.0).why, "toomany");
  const q = S.newPizza(3); S.addCut(q, 0.2);
  // for six slices the other two lines belong at 0.2 + 60deg and 0.2 + 120deg
  const near = S.snapCut(q, 0.2 + Math.PI / 3 + 0.08, 6);
  assert.ok(Math.abs(near - (0.2 + Math.PI / 3)) < 1e-9, "snapped");
  const far = S.snapCut(q, 0.2 + Math.PI / 6, 6);
  assert.ok(Math.abs(far - (0.2 + Math.PI / 6)) < 1e-9, "left alone");
});

test("switching sauce scrapes the old one off", () => {
  const p = S.newPizza(4);
  S.paintSauce(p, "tomato", 0, 0, 0.5);
  const r = S.paintSauce(p, "bbq", 0, 0, 0.1);
  assert.ok(r.scraped);
  assert.strictEqual(p.sauce, "bbq");
});

test("the swipe geometry: a line must pass near the middle", () => {
  assert.ok(S.lineDistToCentre(-1, 0.05, 1, 0.05) < 0.06);
  assert.ok(S.lineDistToCentre(-1, 0.7, 1, 0.7) > 0.6);
});

test("stars map from quality and happiness, and a refund is capped", () => {
  assert.strictEqual(S.starsFor(1, 1), 5);
  assert.strictEqual(S.starsFor(0.88, 0.5), 4);
  assert.strictEqual(S.starsFor(0.75, 0.2), 3);
  assert.strictEqual(S.starsFor(0.3, 1), 1);
  const o = baseOrder();
  assert.ok(S.gradePizza(o, build(o, (p) => S.clearToppings(p))).quality <= 0.4);
});

// The day: lines, kitchens, ovens, patience, closing time and the books.

const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./load.js");
const { makePerfect } = require("./perfect.js");

const S = load();
const G = S.Game;
const kitWith = (upgrades = {}, menu = {}) => S.kitFor({ upgrades, menu });
const begin = (day = 1, kit = kitWith(), seed = "g", notes = true) => { G.on = {}; G.start({ day, kit, seed, notes }); return G; };
const run = (sec, dt = 0.1) => { for (let t = 0; t < sec; t += dt) G.update(dt); };
const waitForLine = (n = 1) => { for (let i = 0; i < 400 && G.line.length < n; i++) G.update(0.5); };

test("day one opens with Marge, one topping, and every default", () => {
  begin(1);
  run(2);
  assert.strictEqual(G.line.length, 1);
  const c = G.line[0];
  assert.strictEqual(c.entry.id, "marge");
  assert.strictEqual(c.order.reqs.length, 1);
  assert.strictEqual(c.order.reqs[0].region, "whole");
  assert.strictEqual(c.order.sauce, "tomato"); assert.strictEqual(c.order.cheese, "normal");
  assert.strictEqual(c.order.runs, 1); assert.strictEqual(c.order.slices, 6);
  assert.ok(c.speech.length > 10);
});

test("the same seed deals the same customers; a different seed does not", () => {
  const sig = (seed) => {
    begin(8, kitWith({}, { "t:onion": 1, "t:olive": 1, "t:sausage": 1 }), seed);
    const out = [];
    for (let i = 0; i < 4; i++) { waitForLine(1); const c = G.line.shift(); out.push(c.entry.id + ":" + JSON.stringify(c.order.reqs)); G.lastArrival = -99; }
    return out.join("|");
  };
  assert.strictEqual(sig("a"), sig("a"));
  assert.notStrictEqual(sig("a"), sig("b"));
});

test("one person at the counter; taking the order brings the next one up", () => {
  begin(13);
  waitForLine(2);
  const first = G.line[0];
  const r = G.takeOrder();
  assert.ok(r.ok);
  assert.strictEqual(G.open[0].cust, first);
  assert.strictEqual(G.focus, first.id);
  assert.ok(!G.line.includes(first));
});

test("the kitchen holds three orders at once and says why it refuses a fourth", () => {
  begin(13);
  for (let i = 0; i < 3; i++) { waitForLine(1); assert.ok(G.takeOrder().ok); G.lastArrival = -99; }
  waitForLine(1);
  assert.strictEqual(G.takeOrder().why, "full");
  assert.strictEqual(S.MAX_OPEN, 3);
});

test("the oven: one rack, a timed trip, and a refusal that says why", () => {
  begin(1);
  waitForLine(1); G.takeOrder(); G.lastArrival = -99; waitForLine(1); G.takeOrder();
  const [a, b] = G.open;
  assert.ok(G.toOven(a.id).ok);
  assert.strictEqual(G.toOven(b.id).why, "ovenfull");
  assert.strictEqual(G.toOven(a.id).why, "alreadyoven");
  G.cfg = null;
  run(G.kit.ovenTime - 0.5); assert.strictEqual(a.phase, "oven");
  run(1);
  assert.strictEqual(a.phase, "baked"); assert.strictEqual(a.pizza.runs, 1);
  assert.ok(G.toOven(b.id).ok, "the rack is free again");
});

test("an extra rack bakes two at once; a speedy oven bakes faster", () => {
  begin(1, kitWith({ slots: 1 }));
  waitForLine(1); G.takeOrder(); G.lastArrival = -99; waitForLine(1); G.takeOrder();
  assert.ok(G.toOven(G.open[0].id).ok); assert.ok(G.toOven(G.open[1].id).ok);
  assert.ok(kitWith({ oven: 3 }).ovenTime < kitWith().ovenTime);
});

test("a pizza can go round again, but four trips burn it", () => {
  begin(1);
  waitForLine(1); G.takeOrder();
  const o = G.open[0];
  for (let i = 0; i < 4; i++) { assert.ok(G.toOven(o.id).ok, "trip " + (i + 1)); run(G.kit.ovenTime + 0.2); }
  assert.strictEqual(o.pizza.runs, 4);
  assert.strictEqual(G.toOven(o.id).why, "toomanyruns");
});

test("you cannot touch a pizza that is baked, and you cannot cut a raw one", () => {
  begin(1);
  waitForLine(1); G.takeOrder();
  const o = G.open[0];
  assert.strictEqual(G.toCut(o.id).why, "raw");
  G.toOven(o.id); run(G.kit.ovenTime + 0.2);
  assert.strictEqual(G.drop(o.id, "pepperoni", 0, 0).why, "cooked");
  assert.ok(G.toCut(o.id).ok);
  assert.strictEqual(G.toOven(o.id).ok, true, "uncut: back in the oven is allowed");
});

test("serving: a correct pizza pays, a wrong one is a refund with no tip", () => {
  begin(1);
  waitForLine(1); G.takeOrder();
  const o = makePerfect(S, G, G.open[0]);
  const price = o.order.price;
  const r = G.serve(o.id).res;
  assert.ok(!r.refund && r.stars >= 4, `stars ${r.stars}`);
  assert.ok(r.pay > price * 0.9 && r.tip > 0);
  assert.strictEqual(r.profit, r.pay + r.tip - r.supplies);
  assert.strictEqual(G.stats.served, 1);

  G.lastArrival = -99; waitForLine(1); G.takeOrder();
  const bad = G.open[0];
  G.toOven(bad.id); run(G.kit.ovenTime + 0.2); G.toCut(bad.id); G.box(bad.id);
  const r2 = G.serve(bad.id).res;
  assert.ok(r2.refund && r2.pay === 0 && r2.tip === 0, "an empty pizza is sent back");
  assert.ok(r2.notes.some((n) => !n.ok));
  assert.strictEqual(G.stats.refunds, 1);
});

test("remembering an order unaided earns a bonus; asking 'What?' or a hint costs happiness", () => {
  const tipFor = (notes, ask) => {
    begin(1, kitWith(), "same", notes);
    waitForLine(1); G.takeOrder();
    const o = G.open[0];
    if (ask === "what") G.what(o.id); if (ask === "hint") G.hint(o.id);
    makePerfect(S, G, o); o.cust.happy = 1; o.cust.patience = 1e9;
    return G.serve(o.id).res;
  };
  const withNotes = tipFor(true), unaided = tipFor(false), asked = tipFor(false, "what");
  assert.ok(unaided.remembered && !withNotes.remembered && !asked.remembered);
  assert.ok(unaided.tip > withNotes.tip, "memory bonus");
  begin(1); waitForLine(1); G.takeOrder();
  const o = G.open[0], h0 = o.cust.happy;
  G.what(o.id); const h1 = o.cust.happy; G.hint(o.id);
  assert.ok(h1 < h0 && o.cust.happy < h1);
  assert.ok(G.hint(o.id).lines.length >= 4);
});

test("patience runs out: they leave, you lose the ingredients, nobody is stuck", () => {
  begin(1);
  waitForLine(1);
  const c = G.line[0];
  c.patience = 5;
  run(6);
  assert.ok(!G.line.includes(c));
  assert.strictEqual(G.stats.left, 1);
  // one in the kitchen with ingredients on it
  waitForLine(1); G.takeOrder();
  const o = G.open[0]; G.paintSauce(o.id, "tomato", 0, 0); o.cust.patience = 3; run(4);
  assert.strictEqual(G.stats.left, 2);
  assert.ok(G.stats.supplies > 0, "wasted ingredients are paid for");
  assert.strictEqual(G.open.length, 0);
});

test("closing time: nobody new comes, and the day ends when the last order does", () => {
  begin(1);
  run(G.dayLen - 1);
  waitForLine(1);
  run(2);
  assert.ok(G.closing);
  const before = G.dealt;
  run(20);
  assert.strictEqual(G.dealt, before, "no arrivals after closing");
  // customers in hand eventually give up if nobody serves them, so the day always ends
  run(900);
  assert.ok(G.finished && G.result);
  assert.strictEqual(G.result.profit, G.result.revenue - G.result.supplies);
});

test("a showdown day brings the critic, and her verdict decides the rival", () => {
  begin(6);
  const seen = new Set();
  for (let i = 0; i < 6000 && !G.finished; i++) { G.update(0.1); for (const c of G.line) seen.add(c.entry.id); if (G.t > G.dayLen * 0.8) break; }
  assert.ok(seen.has("critic"), "Ms. Marlowe came");
  run(2000);
  assert.ok(G.result.showdown && G.result.showdown.beat === false, "nobody served her, so the rival wins");
});

test("update() ignores bad time: backwards, NaN and zero do nothing, long pauses are clamped", () => {
  begin(1);
  run(3);
  const t0 = G.t;
  for (const bad of [-1, -0.016, 0, NaN, undefined]) G.update(bad);
  assert.strictEqual(G.t, t0);
  G.update(60);
  assert.ok(G.t - t0 <= 0.26, "a minute's pause is one short step");
});

test("the day's pace: a slow player gets a longer day, not a hopeless one", () => {
  assert.ok(S.lineTarget(1) === 1 && S.lineTarget(30) === S.LINE_MAX);
  assert.ok(S.arrivalGap(1) > S.arrivalGap(30));
  assert.ok(S.patienceMult(20) > S.patienceMult(1) * 0.7, "patience grows with the line");
  assert.strictEqual(S.clockText(0, 240), "12:00 PM");
  assert.strictEqual(S.clockText(240, 240), "9:00 PM");
});

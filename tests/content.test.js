// A linter for everything authored or generated: every order any customer can
// ever speak is satisfiable by a real build, says everything it asks for, and
// never asks for something the shop doesn't stock.

const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./load.js");
const { makePerfect } = require("./perfect.js");

const S = load();
const allProg = { menu: Object.fromEntries(S.TOPPINGS.map((t) => ["t:" + t.id, 1]).concat(S.SAUCES.map((s) => ["s:" + s.id, 1]))) };
const fullKit = S.kitFor(allProg);
const startKit = S.kitFor({});

test("toppings, sauces, recipes and customers are well formed", () => {
  const ids = new Set();
  for (const t of S.TOPPINGS) {
    assert.ok(!ids.has(t.id), "duplicate " + t.id); ids.add(t.id);
    assert.ok(t.cost > 0 && t.price > t.cost * 4, `${t.id}: a whole-pizza helping must pay for its ingredients`);
    assert.ok(["meat", "veg", "fish"].includes(t.kind));
  }
  assert.ok(S.TOPPINGS.filter((t) => t.unlock === 0).length >= 2, "the shop starts with a choice");
  assert.strictEqual(S.SAUCE.tomato.unlock, 0);
  for (const r of S.RECIPES) {
    assert.ok(r.tops.length >= 1 && r.tops.every((t) => S.TOP[t]), r.id);
    if (r.sauce) assert.ok(S.SAUCE[r.sauce]);
  }
  const rids = new Set();
  for (const c of S.ROSTER) { assert.ok(!rids.has(c.id), "duplicate customer " + c.id); rids.add(c.id); assert.ok(S.VOICES[c.voice] || c.voice === "tourist", c.id); }
  assert.ok(S.ROSTER.length >= 40, "plenty of faces");
});

test("every customer has a stable, valid face", () => {
  for (const c of S.ROSTER) {
    const a = S.lookFor(c), b = S.lookFor(c);
    assert.deepEqual(a, b);
    for (const k of ["skin", "hair", "hairCol", "shirt"]) assert.ok(Number.isInteger(a[k]) && a[k] >= 0, c.id + k);
  }
});

test("the campaign is five chapters of six days, each with a showdown", () => {
  assert.strictEqual(S.CHAPTERS.length, 5);
  assert.strictEqual(S.CAMPAIGN_DAYS, 30);
  for (let d = 1; d <= 36; d++) {
    assert.strictEqual(S.isShowdown(d), d % 6 === 0);
    assert.ok(S.chapterOf(d).rival.name);
    assert.ok(S.newsFor(d)[0], "a headline for day " + d);
  }
  assert.strictEqual(S.chapterOf(31).id, 6);
});

test("difficulty only ever rises along the campaign", () => {
  let prev = null;
  for (let d = 1; d <= 40; d++) {
    const p = S.params(d);
    if (prev) {
      assert.ok(p.maxTops >= prev.maxTops, "maxTops falls on " + d);
      assert.ok(p.pHalf >= prev.pHalf && p.pQuarter >= prev.pQuarter, "split orders fall on " + d);
      assert.ok(p.pRecipe >= prev.pRecipe, "recipes fall on " + d);
    }
    prev = p;
  }
  // day one is the tutorial: one topping, tomato sauce, normal cheese, golden, six slices
  const p1 = S.params(1);
  assert.strictEqual(p1.maxTops, 1);
  assert.strictEqual(p1.pHalf + p1.pQuarter + p1.pRecipe + p1.pNoSauce + p1.pNoCheese + p1.pExtraCheese + p1.pSauce + p1.pVeg, 0);
  assert.deepEqual(p1.runs, [[1, 1]]);
  assert.deepEqual(p1.slices, [[6, 1]]);
});

test("every possible order, on every day, is satisfiable by a real build", () => {
  let n = 0, bad = [];
  for (const [label, kit] of [["start", startKit], ["full", fullKit]]) {
    for (let day = 1; day <= 40; day++) {
      for (let i = 0; i < 25; i++) {
        const G = S.Game; G.on = {};
        G.start({ day, kit, seed: "lint" + i, notes: true });
        // run the clock until a customer has come in
        for (let t = 0; t < 60 && !G.line.length; t++) G.update(1);
        const c = G.line[0];
        if (!c) { bad.push(`${label} day ${day}: nobody came`); continue; }
        G.takeOrder();
        const o = G.open[0];
        makePerfect(S, G, o);
        const g = S.gradePizza(o.order, o.pizza);
        n++;
        if (!g.ok) bad.push(`${label} day ${day} #${i}: ${c.speech} -> ${g.fails.map((f) => f.text).join(" / ")}`);
      }
    }
  }
  assert.ok(n > 1500, "linted " + n);
  assert.strictEqual(bad.length, 0, bad.slice(0, 6).join("\n"));
});

test("an order never asks for something the shop doesn't stock", () => {
  for (let day = 1; day <= 40; day++) for (let i = 0; i < 20; i++) {
    const entry = S.ROSTER[(day * 7 + i) % S.ROSTER.length];
    const o = S.makeOrder(S.RNG.sub("stock", day, i), { day, tops: startKit.tops, sauces: startKit.sauces, entry });
    for (const r of o.reqs) assert.ok(startKit.tops.has(r.t), `${r.t} on day ${day}`);
    assert.ok(startKit.sauces.has(o.sauce) || o.sauce === "none", o.sauce);
  }
});

test("what is said is what is asked: every clause is in the sentence", () => {
  const bad = [];
  for (let day = 1; day <= 36; day++) for (let i = 0; i < 40; i++) {
    const entry = S.REGULARS[(day + i) % S.REGULARS.length];
    const order = S.makeOrder(S.RNG.sub("say", day, i), { day, tops: fullKit.tops, sauces: fullKit.sauces, entry });
    const text = S.sayOrder(entry, order, S.RNG.sub("say2", day, i)).toLowerCase();
    const need = [];
    if (order.recipes) order.recipes.forEach((r) => need.push(S.RECIPE[r].name.toLowerCase()));
    else if (order.recipe) need.push(S.RECIPE[order.recipe].name.toLowerCase());
    else for (const r of order.reqs) need.push(S.TOP[r.t].plural.toLowerCase());
    if (order.sauce === "none") need.push("sauce");
    if (order.cheese === "none") need.push("cheese");
    if (order.cheese === "extra") need.push("extra cheese");
    if (order.runs === 2) need.push("well done");
    if (order.runs === 3) need.push("extra crispy");
    if (order.runs === 4) need.push("burn");
    if (order.slices === 1) need.push("uncut"); else if (order.slices !== 6) need.push(S.sliceWord(order.slices));
    for (const w of need) if (!text.includes(w)) bad.push(`day ${day}: "${w}" missing from: ${text}`);
    // the one thing a customer must never do is state the default
    assert.ok(!/ in six\b/.test(text), "the default is never spoken: " + text);
  }
  assert.strictEqual(bad.length, 0, bad.slice(0, 5).join("\n"));
});

test("Marcel mimes in pictures, not words, and a tourist mangles names", () => {
  const mime = S.CUSTOMER.mime;
  const order = S.makeOrder(S.RNG.sub("m", 1), { day: 20, tops: fullKit.tops, sauces: fullKit.sauces, entry: mime });
  const text = S.sayOrder(mime, order, S.RNG.sub("m2", 1));
  assert.ok(text.startsWith("*mimes*"));
  assert.ok(!/ pizza| with /i.test(text), text);
  const tourist = S.CUSTOMER.tourist;
  const o2 = S.makeOrder(S.RNG.sub("t", 1), { day: 14, tops: fullKit.tops, sauces: fullKit.sauces, entry: tourist });
  assert.ok(o2.recipe || o2.recipes, "a tourist always orders by name");
});

test("recipes are only ordered once the chapter has started and the shop stocks them", () => {
  for (let day = 1; day <= 36; day++) for (let i = 0; i < 30; i++) {
    const o = S.makeOrder(S.RNG.sub("rc", day, i), { day, tops: fullKit.tops, sauces: fullKit.sauces, entry: S.CUSTOMER.marge });
    for (const id of [o.recipe, ...(o.recipes || [])].filter(Boolean)) assert.ok(S.RECIPE[id].chapter <= S.chapterOf(day).id, `${id} on day ${day}`);
  }
});

test("price covers the ingredients with room to spare, on every possible order", () => {
  for (let day = 1; day <= 36; day++) for (let i = 0; i < 20; i++) {
    const order = S.makeOrder(S.RNG.sub("pr", day, i), { day, tops: fullKit.tops, sauces: fullKit.sauces, entry: S.CUSTOMER.marge });
    let cost = S.BASE_COST + (order.sauce === "none" ? 0 : S.SAUCE[order.sauce].cost) + (order.cheese === "extra" ? 30 : 0);
    for (const r of order.reqs) cost += S.TOP[r.t].cost * S.quotaFor(r.region);
    assert.ok(order.price > cost * 1.8, `day ${day}: price ${order.price} vs cost ${cost}`);
  }
});

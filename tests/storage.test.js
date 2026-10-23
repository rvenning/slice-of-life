// The one function that can permanently destroy a save: the cross-device merge.
// Every field is either a monotonic counter (merged with max) or a set that only
// grows (merged by union) — and the merge must give the same answer whichever
// device syncs first.

const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { loadScripts } = require("../lib/tools/test-harness.js");

const ROOT = path.join(__dirname, "..");
const S = loadScripts({
  baseDir: ROOT,
  files: ["lib/gk-util.js", "lib/gk-storage.js", "js/menu.js", "js/pizza.js", "js/days.js", "js/orders.js", "js/upgrades.js", "js/storage.js"],
  exports: ["PROGRESS", "Storage", "money", "UPGRADE", "TOP", "SAUCE", "DECOR_BY_ID", "decorLook", "kitFor"],
  browser: true,
});
const { PROGRESS, Storage } = S;

const dev = (over) => ({ ...PROGRESS.blank(), ...over });
const same = (x, y) => assert.deepEqual(x, y);

test("merge is the same whichever device syncs first", () => {
  const a = dev({ earned: 5000, supplies: 800, spent: 1000, repGained: 40, day: 4, menu: { "t:onion": 1 }, updated: 5,
    days: { 1: { stars: 3, best: 700, avg: 4.5 }, 2: { stars: 1, best: 200, avg: 3 } }, upgrades: { oven: 1 }, met: { marge: 3 },
    decorOn: { wall: "sage" }, decor: { "wall:sage": 1 } });
  const b = dev({ earned: 4000, supplies: 900, spent: 3000, repGained: 25, repLost: 5, day: 6, menu: { "t:olive": 1 }, updated: 9,
    days: { 2: { stars: 3, best: 600, avg: 4 }, 3: { stars: 2, best: 400, avg: 3.5 } }, upgrades: { oven: 2, tipjar: 1 }, met: { marge: 1, tony: 2 },
    decorOn: { wall: "tile" }, decor: { "wall:tile": 1 } });
  const ab = PROGRESS.merge(a, b), ba = PROGRESS.merge(b, a);
  same(ab, ba);
  assert.strictEqual(ab.earned, 5000); assert.strictEqual(ab.spent, 3000); assert.strictEqual(ab.supplies, 900);
  assert.strictEqual(ab.day, 6);
  assert.strictEqual(ab.upgrades.oven, 2);
  assert.strictEqual(ab.days[2].stars, 3); assert.strictEqual(ab.days[2].best, 600);
  assert.ok(ab.menu["t:onion"] && ab.menu["t:olive"], "everything bought on either device is kept");
  assert.strictEqual(ab.met.marge, 3); assert.strictEqual(ab.met.tony, 2);
  assert.strictEqual(ab.decorOn.wall, "tile", "the newer save picks the wallpaper");
});

test("spent money stays spent: the ledger is counters, never a balance", () => {
  const phone = dev({ earned: 10000, spent: 4000 });                // bought the oven on the phone
  const ipad = dev({ earned: 10000, spent: 0 });                    // the iPad has not heard yet
  const m = PROGRESS.merge(phone, ipad);
  assert.strictEqual(Storage.balance(m), 6000);
  assert.strictEqual(Storage.balance(PROGRESS.merge(ipad, phone)), 6000);
});

test("reputation can fall without a merge undoing it", () => {
  const a = dev({ repGained: 100, repLost: 10 }), b = dev({ repGained: 80, repLost: 30 });
  const m = PROGRESS.merge(a, b);
  assert.strictEqual(Storage.rep(m), 100 - 30);
});

test("fields a newer build added survive an older client's merge", () => {
  const m = PROGRESS.merge(dev({ futureThing: { x: 1 } }), dev({}));
  assert.deepEqual(m.futureThing, { x: 1 });
});

test("recording a day banks the money, writes the day down and always opens the next", () => {
  const p = Storage.getProgress("kid");
  assert.strictEqual(p.day, 1);
  const res = { day: 1, served: 5, refunds: 1, left: 0, revenue: 5000, supplies: 900, profit: 4100, rep: 12, perfect: 2, bestTip: 220, avgStars: 4.2, stars: 2, met: { marge: 3 }, showdown: null };
  Storage.recordDay("kid", res);
  let q = Storage.getProgress("kid");
  assert.strictEqual(Storage.balance(q), 4100);
  assert.strictEqual(q.day, 2);
  assert.strictEqual(q.days[1].stars, 2);
  assert.strictEqual(Storage.rep(q), 12);
  // a terrible day still opens the next one, and a bad replay never lowers the record
  Storage.recordDay("kid", { ...res, day: 1, stars: 1, profit: 100, revenue: 1000, supplies: 900, rep: -9 });
  q = Storage.getProgress("kid");
  assert.strictEqual(q.days[1].stars, 2, "best stars kept");
  assert.strictEqual(q.day, 2);
  assert.strictEqual(Storage.rep(q), 3);
  Storage.recordDay("kid", { ...res, day: 6, showdown: { beat: true, critic: 5 } });
  assert.ok(Storage.getProgress("kid").chapters[1], "the rival is beaten");
});

test("buying: ingredients, equipment and decor spend once and never twice", () => {
  Storage.recordDay("rich", { day: 1, served: 1, refunds: 0, left: 0, revenue: 100000, supplies: 0, profit: 100000, rep: 0, perfect: 0, bestTip: 0, avgStars: 5, stars: 3, met: {}, showdown: null });
  const before = Storage.balance(Storage.getProgress("rich"));
  assert.ok(Storage.buyIngredient("rich", "t", "onion").ok);
  assert.strictEqual(Storage.buyIngredient("rich", "t", "onion").reason, "owned");
  assert.strictEqual(Storage.buyIngredient("rich", "t", "pepperoni").reason, "owned", "the free ones are already yours");
  assert.ok(Storage.buyUpgrade("rich", "oven").ok);
  assert.strictEqual(Storage.getProgress("rich").upgrades.oven, 1);
  assert.ok(Storage.buyDecor("rich", "wall", "sage").ok);
  assert.strictEqual(Storage.getProgress("rich").decorOn.wall, "sage", "hung straight away");
  assert.strictEqual(Storage.balance(Storage.getProgress("rich")), before - S.TOP.onion.unlock - S.UPGRADE.oven.costs[0] - S.DECOR_BY_ID["wall:sage"].cost);
  // the poor cannot buy
  assert.strictEqual(Storage.buyUpgrade("poor", "daylight").reason, "money");
  // a maxed upgrade says so
  for (let i = 0; i < 2; i++) Storage.buyUpgrade("rich", "cutter");
  assert.strictEqual(Storage.buyUpgrade("rich", "cutter").reason, "maxed");
});

test("a wallpaper you do not own is never shown, and the kit reads the save", () => {
  const unowned = dev({ decorOn: { wall: "sunset" } });
  assert.strictEqual(S.decorLook(unowned).wall.id, "brick", "falls back to the free one");
  const owned = dev({ decorOn: { wall: "sunset" }, decor: { "wall:sunset": 1, "props:plant": 1 } });
  assert.strictEqual(S.decorLook(owned).wall.id, "sunset");
  assert.deepEqual(S.decorLook(owned).props, ["plant"]);
  const kit = S.kitFor(dev({ upgrades: { slots: 2, oven: 3, daylight: 1, cutter: 1 }, menu: { "t:onion": 1, "s:bbq": 1 } }));
  assert.strictEqual(kit.ovenSlots, 3); assert.strictEqual(kit.ovenTime, 6); assert.strictEqual(kit.dayLen, 280); assert.ok(kit.snap);
  assert.ok(kit.tops.has("onion") && kit.tops.has("pepperoni") && !kit.tops.has("bacon"));
  assert.ok(kit.sauces.has("bbq") && kit.sauces.has("tomato") && !kit.sauces.has("pesto"));
});

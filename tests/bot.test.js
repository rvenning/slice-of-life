// The campaign, played end to end by bots that differ in SPEED and in how well
// they LISTEN — the two things the game actually asks of a person. The
// guarantees are the ones that matter to a child:
//
//   - nobody is ever stuck (every day opens and pays something),
//   - the shop genuinely makes the game easier (a speedy oven arrives in time),
//   - skill shows (a faster, more careful player earns more),
//   - and listening is a real faculty (turn the ticket off and refunds appear).
//
// Aggregates over several seeds, never one run: a single day swings on a roll.

const test = require("node:test");
const assert = require("node:assert");
const { runCampaign } = require("./campaign.js");

const SEEDS = ["a", "b", "c"];
function aggregate(skill, notes = true) {
  const t = { served: 0, refunds: 0, left: 0, profit: 0, beats: 0, days: 0, minServed: 99, ovenDay: [], endBalance: 0, avg: 0 };
  for (const seed of SEEDS) {
    const { rows } = runCampaign({ skill, days: 30, seed, notes });
    for (const r of rows) {
      t.served += r.served; t.refunds += r.refunds; t.left += r.left; t.profit += r.profit; t.days++; t.avg += r.avg;
      t.minServed = Math.min(t.minServed, r.served);
      if (r.showdown && r.showdown.beat) t.beats++;
    }
    t.ovenDay.push(rows.findIndex((r) => r.spent.some((s) => s.startsWith("oven"))) + 1);
    t.endBalance += rows[rows.length - 1].balance / SEEDS.length;
  }
  t.beats /= SEEDS.length;
  return t;
}

const pro = aggregate("pro"), normal = aggregate("normal"), kid = aggregate("kid"), slow = aggregate("slow");
const normalHard = aggregate("normal", false), kidHard = aggregate("kid", false);

test("nobody is ever stuck: every day, every skill, serves somebody and pays something", () => {
  for (const [name, t] of [["pro", pro], ["normal", normal], ["kid", kid], ["slow", slow]]) {
    assert.ok(t.minServed >= 1, `${name}: a day with nobody served`);
    assert.ok(t.profit > 0, `${name}: the campaign never made money`);
  }
});

test("skill shows: a faster, more careful player earns more", () => {
  assert.ok(pro.profit > normal.profit, "pro > normal");
  assert.ok(normal.profit > kid.profit, "normal > kid");
  assert.ok(kid.profit > slow.profit, "kid > slow");
});

test("a normal player beats every rival; a child still beats most; going very slowly still plays on", () => {
  assert.ok(normal.beats >= 4, `normal beat ${normal.beats}/5`);
  assert.ok(kid.beats >= 2, `kid beat ${kid.beats}/5`);
  assert.ok(slow.served / slow.days >= 3, "even the slowest hands serve people");
});

test("patience bites slow play but not normal play", () => {
  assert.ok(normal.left / normal.days < 0.3, `normal loses ${(normal.left / normal.days).toFixed(2)}/day`);
  assert.ok(slow.left / slow.days > 0.8, "slow play must have a cost");
});

test("listening is a real faculty: turn the order ticket off and refunds appear", () => {
  const rate = (t) => t.refunds / t.served;
  assert.ok(rate(normalHard) > rate(normal) + 0.02, `${rate(normalHard)} vs ${rate(normal)}`);
  assert.ok(rate(kidHard) > rate(kid) + 0.05);
  assert.ok(rate(normalHard) < 0.15, "but a normal listener is not buried in refunds");
});

test("the shop makes the game easier, and in time: the speedy oven arrives early", () => {
  for (const d of normal.ovenDay) assert.ok(d >= 1 && d <= 10, "normal bought the oven on day " + d);
  for (const d of pro.ovenDay) assert.ok(d <= 5, "pro bought the oven on day " + d);
});

test("money is spent, not hoarded: the shop always has something worth saving for", () => {
  assert.ok(normal.endBalance < 60000, "balance after 30 days (cents): " + normal.endBalance);   // under $600
  assert.ok(pro.endBalance < 150000, "pro balance (cents) " + pro.endBalance);                   // under $1,500
});

test("profit per day grows with the shop, not just the day number", () => {
  const { rows } = runCampaign({ skill: "normal", days: 30, seed: "g" });
  const early = rows.slice(0, 5).reduce((s, r) => s + r.profit, 0) / 5;
  const late = rows.slice(-8).reduce((s, r) => s + r.profit, 0) / 8;
  assert.ok(late > early * 1.2, `early ${early} late ${late}`);
});

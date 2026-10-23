// A one-screen summary of how each kind of player fares over the campaign.
// Usage: node tests/summary.js            (order ticket ON, the default)
//        node tests/summary.js hard       (ticket OFF: listening is the whole game)
const { runCampaign } = require("./campaign.js");
const notes = process.argv[2] !== "hard";
const seeds = ["s1", "s2", "s3"];
console.log(notes ? "ORDER TICKET ON" : "ORDER TICKET OFF (hard)");
for (const skill of ["pro", "normal", "kid", "slow"]) {
  let served = 0, refunds = 0, left = 0, profit = 0, beats = 0, days = 0, stars1 = 0, bal = 0, avg = 0, firstOven = [];
  for (const seed of seeds) {
    const { rows } = runCampaign({ skill, days: 30, seed, notes });
    for (const r of rows) { served += r.served; refunds += r.refunds; left += r.left; profit += r.profit; days++; if (r.stars <= 1) stars1++; avg += r.avg; if (r.showdown && r.showdown.beat) beats++; }
    bal += rows[rows.length - 1].balance;
    const d = rows.findIndex((r) => r.spent.some((s) => s.startsWith("oven"))); firstOven.push(d + 1);
  }
  const n = seeds.length;
  console.log(skill.padEnd(7), "served/day", (served / days).toFixed(1), "refund%", (100 * refunds / served).toFixed(0), "left/day", (left / days).toFixed(2), "profit/day $" + (profit / days / 100).toFixed(0), "avg★", (avg / days).toFixed(2), "1★ days", stars1 + "/" + days, "rivals beaten", (beats / n).toFixed(1) + "/5", "end balance $" + (bal / n / 100).toFixed(0), "oven bought day", firstOven.join(","));
}

// Where does the time go? Prints, for each customer on a given day, the work
// the order estimated, how long the bot really took, how long they waited, and
// how much of their patience was left. Run: node tests/diag.js <day> [skill]
const { load, makeBot } = require("./botlib.js");
const { SHOPPING } = require("./campaign.js");

const day = Number(process.argv[2] || 15), skill = process.argv[3] || "normal";
const S = load();
// a plausible shop for the day: the shopping list's first N items
const prog = { menu: {}, upgrades: {} };
const n = Math.min(SHOPPING.length, Math.round(day * 1.1));
for (const [kind, id, lvl] of SHOPPING.slice(0, n)) {
  if (kind === "t") prog.menu["t:" + id] = 1; else if (kind === "s") prog.menu["s:" + id] = 1; else prog.upgrades[id] = lvl;
}
const kit = S.kitFor(prog);
const G = S.Game;
G.on = {};
const rows = [];
G.start({ day, kit, seed: "diag", notes: false });
const taken = {};
G.on.order = (o) => { taken[o.id] = G.t; };
G.on.served = (r) => rows.push({ who: r.entry.name, wait: (taken[r.id] || 0), t: G.t, took: G.t - taken[r.id], happy: r.happy, ref: r.refund, stars: r.stars, pieces: r.order.reqs.length, est: S.workSeconds(r.order), runs: r.order.runs });
G.on.left = (e) => rows.push({ who: e.cust.entry.name + " (LEFT)", patience: e.cust.patience, t: G.t });
makeBot(S, skill, "diag").run();
console.log(`day ${day}, skill ${skill}, ovenTime ${kit.ovenTime}, slots ${kit.ovenSlots}, tops ${kit.tops.size}`);
for (const r of rows) console.log(r.who.padEnd(20), "est", (r.est || 0).toFixed(0).padStart(3), "took", (r.took || 0).toFixed(0).padStart(3), "happyLeft", (r.happy ?? 0).toFixed(2), r.ref ? "REFUND" : "★" + r.stars, "runs", r.runs, r.patience ? "patience " + r.patience.toFixed(0) : "");
const res = G.result; console.log(JSON.stringify({ served: res.served, left: res.left, ref: res.refunds, profit: res.profit, avg: res.avgStars.toFixed(2) }));

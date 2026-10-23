// A progression bot: plays day 1, 2, 3 ... banking what it earns and spending
// it as it earns on a fixed shopping list, the way a person buys the next
// thing they can afford. It never replays a day, so it measures whether the
// campaign is playable on the pace the shop sells you — which is the question
// "is anybody ever stuck?" actually asks.

const { load, playDay } = require("./botlib.js");

// Buy in roughly the order a player would want things. [kind, id, level?]
const SHOPPING = [
  ["t", "onion"], ["t", "olive"], ["u", "ladle", 1], ["u", "shaker", 1], ["t", "sausage"],
  ["u", "oven", 1], ["t", "pepper"], ["u", "tipjar", 1], ["t", "ham"], ["u", "slots", 1],
  ["t", "pineapple"], ["u", "chairs", 1], ["u", "daylight", 1], ["t", "basil"], ["t", "tomato"],
  ["s", "white"], ["t", "spinach"], ["u", "oven", 2], ["u", "cutter", 1], ["u", "chairs", 2],
  ["t", "bacon"], ["s", "bbq"], ["u", "tipjar", 2], ["t", "jalapeno"], ["t", "anchovy"],
  ["s", "pesto"], ["u", "daylight", 2], ["u", "slots", 2], ["t", "chicken"], ["u", "oven", 3],
  ["u", "tipjar", 3], ["u", "chairs", 3], ["u", "daylight", 3],
];

function costOf(S, item) {
  const [kind, id, lvl] = item;
  if (kind === "t") return S.TOP[id].unlock;
  if (kind === "s") return S.SAUCE[id].unlock;
  return S.UPGRADE[id].costs[lvl - 1];
}

function runCampaign({ skill = "normal", days = 30, seed = "c", shop = true, notes = true } = {}) {
  const S = load();
  const prog = { menu: {}, upgrades: {} };
  let balance = 0, rep = 0;
  const rows = [];
  const bought = new Set();
  for (let day = 1; day <= days; day++) {
    const kit = S.kitFor(prog);
    const r = playDay(S, { day, kit, skill, seed, notes });
    balance += r.profit; rep += r.rep;
    const spent = [];
    if (shop) {
      for (const item of SHOPPING) {
        const key = item.join(":");
        if (bought.has(key)) continue;
        const [kind, id, lvl] = item;
        if (kind === "u" && (prog.upgrades[id] || 0) !== lvl - 1) continue;
        const c = costOf(S, item);
        if (balance < c) continue;
        balance -= c; bought.add(key);
        if (kind === "t") prog.menu["t:" + id] = 1;
        else if (kind === "s") prog.menu["s:" + id] = 1;
        else prog.upgrades[id] = lvl;
        spent.push(id + (lvl || ""));
      }
    }
    rows.push({ day, served: r.served, refunds: r.refunds, left: r.left, profit: r.profit, avg: r.avgStars, stars: r.stars, balance, rep, spent, t: r.t, showdown: r.showdown, perfect: r.perfect, mishears: r.bot.mishears });
  }
  return { rows, prog, rep, balance, S };
}

if (require.main === module) {
  const skill = process.argv[2] || "normal";
  const days = Number(process.argv[3] || 30);
  const { rows } = runCampaign({ skill, days });
  console.log(`skill=${skill}`);
  console.log("day served ref left  profit  avg  ★  balance   rep  bought");
  for (const r of rows) {
    console.log(
      String(r.day).padStart(3), String(r.served).padStart(5), String(r.refunds).padStart(3), String(r.left).padStart(4),
      (r.profit / 100).toFixed(0).padStart(7), r.avg.toFixed(1).padStart(4), String(r.stars).padStart(2),
      (r.balance / 100).toFixed(0).padStart(7), String(r.rep).padStart(5), " " + r.spent.join(","),
      r.showdown ? (r.showdown.beat ? " [BEAT RIVAL]" : " [rival wins]") : ""
    );
  }
}

module.exports = { runCampaign, SHOPPING };

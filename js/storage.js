// Persistence: gamekit storage (lib/gk-storage.js) configured for Slice of Life.
// sol_* localStorage keys, "sliceoflife" Firestore collection.
//
// Money is SPENT in the Kitchen, so a plain max() merge would resurrect it every
// time two devices sync. The ledger is monotonic counters instead — earned,
// supplies (what the kitchen used), spent (what was bought) — and the balance is
// derived, which makes max() correct by construction. Reputation can go down
// (a refund costs you), so it is two counters too: repGained and repLost.
//
// PROGRESS is a named object because createStorage keeps its callbacks in a
// closure; the one function that can destroy a save has to be testable.

const PROGRESS = {
  blank: () => ({
    earned: 0, supplies: 0, spent: 0,       // cents; balance = earned - supplies - spent
    repGained: 0, repLost: 0,
    day: 1,                                 // the next day to open
    days: {},                               // { [day]: { stars, best, avg } }
    chapters: {},                           // { [chapterId]: 1 } — rivals beaten
    upgrades: {},                           // { [id]: level }
    menu: {},                               // { "t:onion": 1, "s:white": 1 }
    decor: {},                              // { "wall:sage": 1 }
    decorOn: {},                            // { wall, floor, sign } chosen
    met: {},                                // { [customerId]: times served }
    recipesSeen: {},                        // { [recipeId]: 1 }
    pizzas: 0, perfect: 0, bestDay: 0, bestTip: 0,
    updated: 0,
  }),

  merge: (a, b) => {
    const maxMap = (x = {}, y = {}) => {
      const out = { ...x };
      for (const [k, v] of Object.entries(y)) out[k] = Math.max(out[k] || 0, v || 0);
      return out;
    };
    const days = { ...(a.days || {}) };
    for (const [d, s] of Object.entries(b.days || {})) {
      const cur = days[d];
      days[d] = cur ? { stars: Math.max(cur.stars || 0, s.stars || 0), best: Math.max(cur.best || 0, s.best || 0), avg: Math.max(cur.avg || 0, s.avg || 0) } : s;
    }
    const m = (k) => Math.max(a[k] || 0, b[k] || 0);
    return {
      // Spread first, so a field a newer build added survives an older client's merge.
      ...a, ...b,
      earned: m("earned"), supplies: m("supplies"), spent: m("spent"),
      repGained: m("repGained"), repLost: m("repLost"),
      day: Math.max(a.day || 1, b.day || 1),
      pizzas: m("pizzas"), perfect: m("perfect"), bestDay: m("bestDay"), bestTip: m("bestTip"),
      updated: m("updated"),
      days,
      chapters: maxMap(a.chapters, b.chapters),
      upgrades: maxMap(a.upgrades, b.upgrades),
      met: maxMap(a.met, b.met),
      // Nothing is ever un-bought or un-seen, so the union is always right.
      menu: { ...(a.menu || {}), ...(b.menu || {}) },
      decor: { ...(a.decor || {}), ...(b.decor || {}) },
      recipesSeen: { ...(a.recipesSeen || {}), ...(b.recipesSeen || {}) },
      // Which wallpaper is up is a choice, not a counter: the newer save wins.
      decorOn: (a.updated || 0) >= (b.updated || 0) ? (a.decorOn || b.decorOn || {}) : (b.decorOn || a.decorOn || {}),
    };
  },
};

const Storage = GK.createStorage({
  prefix: "sol",
  collection: "sliceoflife",
  firebaseConfig: window.FIREBASE_CONFIG,
  blankProgress: PROGRESS.blank,
  mergeProgress: PROGRESS.merge,
});

Object.assign(Storage, {
  balance(prog) { return Math.max(0, (prog.earned || 0) - (prog.supplies || 0) - (prog.spent || 0)); },
  rep(prog) { return Math.max(0, (prog.repGained || 0) - (prog.repLost || 0)); },
  totalStars(prog) { return Object.values(prog.days || {}).reduce((s, x) => s + (x.stars || 0), 0); },
  daysPlayed(prog) { return Object.keys(prog.days || {}).length; },
  rivalsBeaten(prog) { return Object.keys(prog.chapters || {}).length; },

  // Write the day down. Money is banked here, once, from the day's own result —
  // the shop's balance moves when the day ends, not mid-service.
  recordDay(profileId, res) {
    const prog = this.getProgress(profileId);
    prog.earned = (prog.earned || 0) + res.revenue;
    prog.supplies = (prog.supplies || 0) + res.supplies;
    if (res.rep >= 0) prog.repGained = (prog.repGained || 0) + res.rep;
    else prog.repLost = (prog.repLost || 0) - res.rep;
    prog.pizzas = (prog.pizzas || 0) + res.served;
    prog.perfect = (prog.perfect || 0) + res.perfect;
    prog.bestTip = Math.max(prog.bestTip || 0, res.bestTip || 0);
    prog.bestDay = Math.max(prog.bestDay || 0, res.profit);
    prog.met = prog.met || {};
    for (const [id, n] of Object.entries(res.met || {})) prog.met[id] = (prog.met[id] || 0) + n;
    prog.days = prog.days || {};
    const cur = prog.days[res.day];
    prog.days[res.day] = {
      stars: Math.max((cur && cur.stars) || 0, res.stars),
      best: Math.max((cur && cur.best) || 0, res.profit),
      avg: Math.max((cur && cur.avg) || 0, Math.round(res.avgStars * 10) / 10),
    };
    // The next day always opens, however the last one went: losing a day is
    // fine, being stuck is not.
    prog.day = Math.max(prog.day || 1, res.day + 1);
    if (res.showdown && res.showdown.beat) {
      prog.chapters = prog.chapters || {};
      prog.chapters[chapterOf(res.day).id] = 1;
    }
    this.saveProgress(profileId, prog);
    return prog;
  },

  seeRecipe(profileId, id) {
    const prog = this.getProgress(profileId);
    if ((prog.recipesSeen || {})[id]) return prog;
    prog.recipesSeen = { ...(prog.recipesSeen || {}), [id]: 1 };
    this.saveProgress(profileId, prog);
    return prog;
  },

  buyUpgrade(profileId, id) {
    const prog = this.getProgress(profileId);
    const def = UPGRADE[id];
    const lvl = upgradeLevel(prog, id);
    if (!def || lvl >= def.costs.length) return { ok: false, reason: "maxed" };
    const cost = def.costs[lvl];
    if (this.balance(prog) < cost) return { ok: false, reason: "money" };
    prog.spent = (prog.spent || 0) + cost;
    prog.upgrades = { ...(prog.upgrades || {}), [id]: lvl + 1 };
    this.saveProgress(profileId, prog);
    return { ok: true, progress: prog, cost };
  },

  // kind: "t" topping, "s" sauce
  buyIngredient(profileId, kind, id) {
    const prog = this.getProgress(profileId);
    const def = kind === "t" ? TOP[id] : SAUCE[id];
    if (!def) return { ok: false, reason: "unknown" };
    if ((prog.menu || {})[kind + ":" + id] || def.unlock === 0) return { ok: false, reason: "owned" };
    if (this.balance(prog) < def.unlock) return { ok: false, reason: "money" };
    prog.spent = (prog.spent || 0) + def.unlock;
    prog.menu = { ...(prog.menu || {}), [kind + ":" + id]: 1 };
    this.saveProgress(profileId, prog);
    return { ok: true, progress: prog, cost: def.unlock };
  },

  buyDecor(profileId, group, id) {
    const prog = this.getProgress(profileId);
    const def = DECOR_BY_ID[group + ":" + id];
    if (!def) return { ok: false, reason: "unknown" };
    if (ownsDecor(prog, group, id)) return { ok: false, reason: "owned" };
    if (this.balance(prog) < def.cost) return { ok: false, reason: "money" };
    prog.spent = (prog.spent || 0) + def.cost;
    prog.decor = { ...(prog.decor || {}), [group + ":" + id]: 1 };
    // Hang it straight away — what you just bought should be the thing on the wall.
    if (group !== "props") prog.decorOn = { ...(prog.decorOn || {}), [group]: id };
    this.saveProgress(profileId, prog);
    return { ok: true, progress: prog, cost: def.cost };
  },

  chooseDecor(profileId, group, id) {
    const prog = this.getProgress(profileId);
    if (!ownsDecor(prog, group, id)) return { ok: false, reason: "locked" };
    prog.decorOn = { ...(prog.decorOn || {}), [group]: id };
    this.saveProgress(profileId, prog);
    return { ok: true, progress: prog };
  },
});

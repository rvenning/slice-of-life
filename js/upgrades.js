// Slice of Life — the Kitchen (things that make the work faster or easier) and
// the Decor (things that make the shop yours).
//
// Everything is a level or a one-off flag in the saved progress, and every
// effect is read through kitFor(), so the engine never asks "did she buy X" —
// it asks the kit what the kitchen can do.

const BASE_OVEN_TIME = 11;       // seconds for one trip through the oven

const UPGRADES = [
  { id: "oven",     icon: "🔥", name: "Speedy Oven",     desc: "Each trip through the oven takes less time.",       costs: [6000, 15000, 32000], effect: (l) => `${[11, 9, 7.5, 6][l]}s a trip` },
  { id: "slots",    icon: "♨️", name: "Extra Oven Rack", desc: "Bake another pizza at the same time.",              costs: [12000, 30000],       effect: (l) => `${1 + l} at once` },
  { id: "daylight", icon: "🌅", name: "Daylight Saving", desc: "Stay open longer, serve more people.",              costs: [8000, 18000, 35000], effect: (l) => `+${l * 40}s of day` },
  { id: "chairs",   icon: "🪑", name: "Comfy Chairs",    desc: "Customers wait a little longer before giving up.",  costs: [4000, 10000, 24000], effect: (l) => `+${l * 10}% patience` },
  { id: "tipjar",   icon: "🫙", name: "Big Tip Jar",     desc: "A bigger jar means bigger tips.",                   costs: [3000, 9000, 22000],  effect: (l) => `+${l * 6}% tips` },
  { id: "ladle",    icon: "🥄", name: "Wide Ladle",      desc: "Spreads sauce over a bigger patch at a time.",      costs: [2500, 7000],         effect: (l) => `size ${l + 1}` },
  { id: "shaker",   icon: "🧂", name: "Big Cheese Shaker", desc: "Sprinkles cheese over a wider patch.",            costs: [2500, 7000],         effect: (l) => `size ${l + 1}` },
  { id: "cutter",   icon: "🔪", name: "Guide Cutter",    desc: "Your cuts click onto the guide lines.",              costs: [5000],               effect: (l) => (l ? "on" : "off") },
];
const UPGRADE = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// Cosmetic. None of it changes how the day plays.
const DECOR = {
  wall: [
    { id: "brick",  name: "Red Brick",   cost: 0,    top: "#b5584a", bot: "#9a463a", line: "#8a3c32" },
    { id: "sage",   name: "Sage Green",  cost: 3000, top: "#9fbf9a", bot: "#86a883", line: "#6f9070" },
    { id: "tile",   name: "Blue Tile",   cost: 3000, top: "#8bb7d6", bot: "#74a3c4", line: "#5e8eb0" },
    { id: "sunset", name: "Sunset",      cost: 4500, top: "#f0b778", bot: "#e29a5c", line: "#cf8648" },
  ],
  floor: [
    { id: "pink",  name: "Pink Checks", cost: 0,    a: "#f1d3d0", b: "#e3b1ad" },
    { id: "blue",  name: "Blue Checks", cost: 2500, a: "#cfe0ee", b: "#a7c4dc" },
    { id: "wood",  name: "Wood Boards", cost: 2500, a: "#d6a76d", b: "#c4925a" },
    { id: "mono",  name: "Black & White", cost: 3500, a: "#f4f1ea", b: "#2e2a28" },
  ],
  sign: [
    { id: "open",  name: "OPEN",        cost: 0,    text: "OPEN",   color: "#59e08f" },
    { id: "fresh", name: "FRESH",       cost: 2000, text: "FRESH",  color: "#ff8fb0" },
    { id: "slices", name: "SLICES",     cost: 2000, text: "SLICES", color: "#ffd45e" },
  ],
  props: [
    { id: "plant",   name: "Palm Plant",     cost: 1500, icon: "🪴" },
    { id: "gumball", name: "Gumball Machine", cost: 2000, icon: "🍬" },
    { id: "cat",     name: "Lucky Cat",      cost: 3500, icon: "🐱" },
    { id: "lights",  name: "Fairy Lights",   cost: 2500, icon: "✨" },
    { id: "poster",  name: "Pizza Poster",   cost: 1500, icon: "🖼️" },
    { id: "jukebox", name: "Jukebox",        cost: 6000, icon: "🎵" },
    { id: "arcade",  name: "Arcade Cabinet", cost: 8000, icon: "🕹️" },
  ],
};
const DECOR_ALL = [
  ...DECOR.wall.map((d) => ({ ...d, group: "wall" })),
  ...DECOR.floor.map((d) => ({ ...d, group: "floor" })),
  ...DECOR.sign.map((d) => ({ ...d, group: "sign" })),
  ...DECOR.props.map((d) => ({ ...d, group: "props" })),
];
const DECOR_BY_ID = Object.fromEntries(DECOR_ALL.map((d) => [d.group + ":" + d.id, d]));

const upgradeLevel = (prog, id) => ((prog.upgrades || {})[id]) || 0;
const ownsTopping = (prog, id) => TOP[id].unlock === 0 || !!(prog.menu || {})["t:" + id];
const ownsSauce = (prog, id) => SAUCE[id].unlock === 0 || !!(prog.menu || {})["s:" + id];
const ownsDecor = (prog, group, id) => DECOR_BY_ID[group + ":" + id].cost === 0 || !!(prog.decor || {})[group + ":" + id];

function decorLook(prog) {
  const on = prog.decorOn || {};
  const pick = (group) => DECOR[group].find((d) => d.id === on[group] && ownsDecor(prog, group, d.id)) || DECOR[group][0];
  return {
    wall: pick("wall"), floor: pick("floor"), sign: pick("sign"),
    props: DECOR.props.filter((d) => ownsDecor(prog, "props", d.id)).map((d) => d.id),
  };
}

// What the kitchen can do, read straight from the saved progress.
function kitFor(prog) {
  const L = (id) => upgradeLevel(prog, id);
  const tops = new Set(TOPPINGS.filter((t) => ownsTopping(prog, t.id)).map((t) => t.id));
  const sauces = new Set(SAUCES.filter((s) => ownsSauce(prog, s.id)).map((s) => s.id));
  return {
    ovenTime: [BASE_OVEN_TIME, 9, 7.5, 6][L("oven")],
    ovenSlots: 1 + L("slots"),
    dayLen: BASE_DAY_SECONDS + 40 * L("daylight"),
    patience: 1 + 0.1 * L("chairs"),
    tipBonus: 0.06 * L("tipjar"),
    sauceR: [0.26, 0.32, 0.40][L("ladle")],
    cheeseR: [0.22, 0.28, 0.34][L("shaker")],
    snap: L("cutter") > 0,
    tops, sauces,
  };
}

// The kit a brand-new shop starts with.
const BASE_KIT = kitFor({});

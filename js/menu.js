// Slice of Life — the menu: every ingredient, region, bake and named recipe.
//
// Pure data plus a few lookups. Nothing here touches the DOM, so the tests and
// the balance bot load it straight into Node.
//
// MONEY IS INTEGER CENTS everywhere. Floats drift, and the ledger is merged
// across devices with max(), which only works on whole numbers.

const RNG = {
  seedFrom(str) {
    const s = String(str);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },
  // mulberry32 with the conveniences hung off the callable.
  make(seed = 0) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + next() * (hi - lo);
    next.int = (lo, hi) => Math.floor(lo + next() * (hi - lo + 1));
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.chance = (p) => next() < p;
    next.shuffle = (arr) => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    };
    next.weighted = (arr, weight) => {
      let total = 0;
      for (const it of arr) total += Math.max(0, weight(it));
      if (total <= 0) return arr[0];
      let r = next() * total;
      for (const it of arr) { r -= Math.max(0, weight(it)); if (r <= 0) return it; }
      return arr[arr.length - 1];
    };
    return next;
  },
  // A generator keyed on WHAT it is for and WHERE — never a running stream, so
  // a day's customers do not change because the player fumbled an earlier one.
  sub(seed, ...parts) { return RNG.make(RNG.seedFrom(seed + ":" + parts.join(":"))); },
};

const money = (cents) => {
  const neg = cents < 0;
  const c = Math.abs(Math.round(cents));
  return (neg ? "-" : "") + "$" + Math.floor(c / 100) + "." + String(c % 100).padStart(2, "0");
};

/* ------------------------------------------------------------------ */
/* Toppings                                                            */
/* ------------------------------------------------------------------ */

// cost  = cents per PIECE the kitchen spends (meat is dear, as in life)
// price = cents the customer pays for a whole-pizza helping
// unlock = cents in the Kitchen tab; 0 means the kitchen starts with it
const TOPPINGS = [
  { id: "pepperoni", name: "Pepperoni", plural: "pepperoni",      kind: "meat",    cost: 12, price: 200, unlock: 0 },
  { id: "mushroom",  name: "Mushroom",  plural: "mushrooms",      kind: "veg",     cost: 7,  price: 130, unlock: 0 },
  { id: "onion",     name: "Onion",     plural: "onions",         kind: "veg",     cost: 6,  price: 120, unlock: 2000 },
  { id: "olive",     name: "Olive",     plural: "olives",         kind: "veg",     cost: 7,  price: 130, unlock: 3000 },
  { id: "sausage",   name: "Sausage",   plural: "sausage",        kind: "meat",    cost: 12, price: 210, unlock: 3500 },
  { id: "pepper",    name: "Green Pepper", plural: "green peppers", kind: "veg",   cost: 7,  price: 130, unlock: 4500 },
  { id: "basil",     name: "Basil",     plural: "basil",          kind: "veg",     cost: 5,  price: 120, unlock: 4000 },
  { id: "ham",       name: "Ham",       plural: "ham",            kind: "meat",    cost: 11, price: 200, unlock: 5500 },
  { id: "tomato",    name: "Tomato",    plural: "fresh tomato",   kind: "veg",     cost: 7,  price: 130, unlock: 5000 },
  { id: "pineapple", name: "Pineapple", plural: "pineapple",      kind: "veg",     cost: 8,  price: 140, unlock: 6500 },
  { id: "spinach",   name: "Spinach",   plural: "spinach",        kind: "veg",     cost: 5,  price: 130, unlock: 6000 },
  { id: "anchovy",   name: "Anchovy",   plural: "anchovies",      kind: "fish",    cost: 13, price: 240, unlock: 7500 },
  { id: "jalapeno",  name: "Jalapeño",  plural: "jalapeños",      kind: "veg",     cost: 7,  price: 140, unlock: 8000 },
  { id: "bacon",     name: "Bacon",     plural: "bacon",          kind: "meat",    cost: 14, price: 250, unlock: 9000 },
  { id: "chicken",   name: "Chicken",   plural: "chicken",        kind: "meat",    cost: 14, price: 250, unlock: 12000 },
];
const TOP = Object.fromEntries(TOPPINGS.map((t) => [t.id, t]));
const isMeat = (id) => TOP[id].kind === "meat" || TOP[id].kind === "fish";
const isVeg = (id) => TOP[id].kind === "veg";

/* ------------------------------------------------------------------ */
/* Sauces                                                              */
/* ------------------------------------------------------------------ */

const SAUCES = [
  { id: "tomato", name: "Tomato",       say: "tomato",            price: 0,   cost: 25, unlock: 0,    color: "#c9382b", dark: "#a82a20" },
  { id: "white",  name: "Garlic Cream", say: "white garlic",      price: 60,  cost: 35, unlock: 3000, color: "#f4ecd6", dark: "#e1d2ad" },
  { id: "bbq",    name: "Barbecue",     say: "barbecue",          price: 60,  cost: 35, unlock: 5000, color: "#7c3a1d", dark: "#5e2a14" },
  { id: "pesto",  name: "Pesto",        say: "pesto",             price: 90,  cost: 45, unlock: 6500, color: "#6e9a3a", dark: "#527a2a" },
];
const SAUCE = Object.fromEntries(SAUCES.map((s) => [s.id, s]));

/* ------------------------------------------------------------------ */
/* The pizza itself                                                    */
/* ------------------------------------------------------------------ */

const BASE_PRICE = 600;      // dough, sauce and cheese
const EXTRA_CHEESE_PRICE = 80;
const BASE_COST = 55;        // dough + a normal helping of cheese
const EXTRA_CHEESE_COST = 30;

const BAKES = [
  { runs: 1, name: "Normal",       say: "" },
  { runs: 2, name: "Well done",    say: "well done" },
  { runs: 3, name: "Extra crispy", say: "extra crispy" },
  { runs: 4, name: "Burnt",        say: "burnt to a crisp" },
];

// Regions are tested in pizza space: the pizza has radius 1, +x is the
// PLAYER's right and -y is "up" the screen, as the pizza sits in front of them.
// "Left" in an order always means the player's left.
const REGIONS = {
  whole: { id: "whole", name: "all over",           area: 1,    test: () => true },
  L:     { id: "L",  name: "the left half",         area: 0.5,  test: (x) => x < 0 },
  R:     { id: "R",  name: "the right half",        area: 0.5,  test: (x) => x >= 0 },
  T:     { id: "T",  name: "the top half",          area: 0.5,  test: (x, y) => y < 0 },
  B:     { id: "B",  name: "the bottom half",       area: 0.5,  test: (x, y) => y >= 0 },
  TL:    { id: "TL", name: "the top-left quarter",  area: 0.25, test: (x, y) => x < 0 && y < 0 },
  TR:    { id: "TR", name: "the top-right quarter", area: 0.25, test: (x, y) => x >= 0 && y < 0 },
  BL:    { id: "BL", name: "the bottom-left quarter",  area: 0.25, test: (x, y) => x < 0 && y >= 0 },
  BR:    { id: "BR", name: "the bottom-right quarter", area: 0.25, test: (x, y) => x >= 0 && y >= 0 },
};
const HALVES = ["L", "R", "T", "B"];
const QUARTERS = ["TL", "TR", "BL", "BR"];
const OPPOSITE = { L: "R", R: "L", T: "B", B: "T" };
// The two halves that make up a quarter's row/column — for "quarter" requests
// that sit next to each other, so the pizza stays a sensible thing to build.
const QUARTER_NEIGHBOURS = { TL: ["TR", "BL"], TR: ["TL", "BR"], BL: ["BR", "TL"], BR: ["BL", "TR"] };

// How many pieces count as "enough" in a region. Whole 10, half 5, quarter 3.
const quotaFor = (region) => Math.max(2, Math.round(10 * REGIONS[region].area + 0.01));

/* ------------------------------------------------------------------ */
/* Named recipes                                                       */
/* ------------------------------------------------------------------ */

// A customer who says "a Hawaiian" expects exactly this. They are in the
// Recipe Book from the moment a customer first orders one.
const RECIPES = [
  { id: "classic",     name: "Classic",         tops: ["pepperoni"],                         chapter: 1, blurb: "Just pepperoni. Nothing to hide behind." },
  { id: "hawaiian",    name: "Hawaiian",        tops: ["ham", "pineapple"],                   chapter: 2, blurb: "Ham and pineapple. Argued about at every dinner table." },
  { id: "margherita",  name: "Margherita",      tops: ["tomato", "basil"],                    chapter: 2, blurb: "Fresh tomato and basil." },
  { id: "ocombo",      name: "O-Combo",         tops: ["onion", "olive"],                     chapter: 2, blurb: "Onions and olives. Both start with O." },
  { id: "capricciosa", name: "Capricciosa",     tops: ["mushroom", "olive", "ham"],           chapter: 3, blurb: "Mushrooms, olives and ham." },
  { id: "veggie",      name: "Garden Veggie",   tops: ["mushroom", "onion", "pepper", "olive"], chapter: 3, blurb: "Four vegetables, no meat." },
  { id: "meatfeast",   name: "Meat Feast",      tops: ["pepperoni", "sausage", "bacon"],      chapter: 3, blurb: "Three meats and a napkin." },
  { id: "triplep",     name: "Triple P",        tops: ["pepperoni", "pineapple", "pepper"],   chapter: 3, blurb: "Every topping starts with P." },
  { id: "firepie",     name: "Fire Pie",        tops: ["pepperoni", "jalapeno", "onion"],     chapter: 4, blurb: "Hot enough to need a glass of milk." },
  { id: "greenmachine", name: "Green Machine",  tops: ["spinach", "pepper", "olive"],         chapter: 4, blurb: "Three greens." },
  { id: "seapie",      name: "Sea Pie",         tops: ["anchovy", "olive"],                   chapter: 4, blurb: "For people who like the sea a lot." },
  { id: "bbqchicken",  name: "BBQ Chicken",     tops: ["chicken", "onion"], sauce: "bbq",    chapter: 4, blurb: "Barbecue sauce instead of tomato." },
  { id: "bianca",      name: "Bianca",          tops: ["mushroom", "spinach"], sauce: "white", chapter: 4, blurb: "White garlic sauce, mushrooms and spinach." },
  { id: "verde",       name: "Pesto Verde",     tops: ["tomato", "spinach", "mushroom"], sauce: "pesto", chapter: 5, blurb: "Pesto, tomato, spinach and mushroom." },
];
const RECIPE = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/* ------------------------------------------------------------------ */
/* The cut                                                             */
/* ------------------------------------------------------------------ */

// n cuts through the middle make 2n slices. 0 cuts = left whole.
const sliceWord = (slices) => ({ 1: "left whole", 2: "in half", 4: "in four", 6: "in six", 8: "in eight", 10: "in ten", 12: "in twelve", 16: "in sixteen" }[slices] || `in ${slices}`);

// Slice of Life — who walks in, and what they say.
//
// An order is STRUCTURED DATA first ({ sauce, cheese, reqs, rules, runs,
// slices }) and a sentence second. The grader reads the data; the customer
// speaks the sentence, once, and the player has to listen. Generating the
// words from the structure means the two can never disagree, and it means the
// tests can assert on what a customer is asking for without parsing English.

const ICON = {
  pepperoni: "🔴", mushroom: "🍄", onion: "🧅", olive: "🫒", sausage: "🌭", pepper: "🫑", basil: "🌿",
  ham: "🍖", tomato: "🍅", pineapple: "🍍", spinach: "🥬", anchovy: "🐟", jalapeno: "🌶️", bacon: "🥓", chicken: "🍗",
};

/* ------------------------------------------------------------------ */
/* The cast                                                            */
/* ------------------------------------------------------------------ */

// voice: how they talk. from: the first day they can turn up.
// Specials carry `kind`, which the renderer reads to draw them differently.
const REGULARS = [
  ["marge",   "Marge",         "polite",  1,  "Brings a crossword every day and never finishes it."],
  ["tony",    "Big Tony",      "chatty",  1,  "Knows everyone's business and shares it."],
  ["priya",   "Priya",         "excited", 1,  "Training for a marathon. Carb-loads daily."],
  ["okafor",  "Mr. Okafor",    "formal",  1,  "Retired headmaster. Corrects the menu's spelling."],
  ["pip",     "Little Pip",    "kid",     2,  "Eight years old and tough to impress."],
  ["dex",     "Dex",           "terse",   2,  "Delivers bikes. Speaks in single syllables."],
  ["hana",    "Hana",          "polite",  2,  "Draws tiny pizzas in her sketchbook."],
  ["lola",    "Lola",          "silly",   3,  "Does stand-up. Tests jokes on the queue."],
  ["wei",     "Chef Wei",      "formal",  3,  "Runs the noodle place round the corner. Studies your crust."],
  ["benny",   "Benny",         "sleepy",  3,  "Night-shift baker. Lunch is his breakfast."],
  ["rosa",    "Rosa",          "chatty",  4,  "Knows a guy for everything."],
  ["omar",    "Omar",          "polite",  4,  "Always asks about the oven."],
  ["junie",   "Junie",         "kid",     4,  "Wants to be a pizza chef. Will tell you how."],
  ["captain", "Captain Dan",   "grumpy",  5,  "Ferry captain. Hates waiting almost as much as storms."],
  ["ingrid",  "Ingrid",        "terse",   5,  "Hiking boots, big backpack, one-word answers."],
  ["felix",   "Felix",         "silly",   5,  "Juggles. Not always on purpose."],
  ["mabel",   "Granny Mabel",  "polite",  6,  "Has been eating pizza since before it was invented, she says."],
  ["raj",     "Raj",           "chatty",  7,  "Podcast host. The podcast is about podcasts."],
  ["tilly",   "Tilly",         "kid",     7,  "Wants extra of everything."],
  ["baxter",  "Baxter",        "grumpy",  8,  "Claims he could have made it better. Has never tried."],
  ["yuki",    "Yuki",          "polite",  8,  "Takes a photo of every slice."],
  ["clive",   "Clive",         "formal",  9,  "Wears a suit to everything, including this."],
  ["nell",    "Nell",          "sleepy",  9,  "Falls asleep in the queue. Always wakes up for the pizza."],
  ["dmitri",  "Dmitri",        "terse",   10, "Chess player. Thinks four moves ahead."],
  ["poppy",   "Poppy",         "silly",   10, "Hat collector. Today's hat is a pizza hat."],
  ["hector",  "Hector",        "chatty",  11, "Taxi driver. Has opinions about every road."],
  ["amara",   "Amara",         "polite",  12, "Nurse on lunch. Pays in exact change."],
  ["stan",    "Stan the Man",  "grumpy",  12, "Reviews restaurants for nobody in particular."],
  ["wanda",   "Wanda",         "excited", 13, "Roller derby. Every order is an event."],
  ["abe",     "Old Abe",       "sleepy",  13, "Remembers when this was a bank."],
  ["mei",     "Mei",           "formal",  14, "Architect. Appreciates a straight cut."],
  ["oscar",   "Oscar",         "silly",   15, "Puppeteer. Brings the puppet in."],
  ["bea",     "Bea",           "chatty",  16, "Beekeeper. Will give you honey if you listen."],
  ["kofi",    "Kofi",          "polite",  17, "Drummer. Taps the counter in perfect time."],
  ["sasha",   "Sasha",         "terse",   18, "Skateboards in. Skateboards out."],
  ["gloria",  "Gloria",        "excited", 19, "Opera singer. Orders at full volume."],
  ["lars",    "Lars",          "grumpy",  20, "Sailor. Has seen better crusts. Has seen worse."],
].map(([id, name, voice, from, blurb]) => ({ id, name, voice, from, blurb, weight: 1 }));

const SPECIALS = [
  { id: "fireman", name: "Fireman Flo",      voice: "excited", from: 4,  kind: "fire",      weight: 0.5, blurb: "Puts out fires all day. Likes her pizza as hot as the job." },
  { id: "tourist", name: "Tourist Tamsin",   voice: "chatty",  from: 8,  kind: "tourist",   weight: 0.45, blurb: "Visiting from far away. Says every recipe name slightly wrong." },
  { id: "brother", name: "Brother Basil",    voice: "formal",  from: 7,  kind: "cultist",   weight: 0.5, blurb: "Hums softly. Wants it exactly as specified." },
  { id: "sister",  name: "Sister Sage",      voice: "formal",  from: 9,  kind: "cultist",   weight: 0.4, blurb: "Says the crust has a voice. Won't say what it says." },
  { id: "nobody",  name: "Mr. Nobody",       voice: "formal",  from: 9,  kind: "invisible", weight: 0.4, blurb: "You can see a hat and a scarf. That's all anyone's ever seen." },
  { id: "prof",    name: "Professor Quark",  voice: "formal",  from: 11, kind: "prof",      weight: 0.4, blurb: "Physicist. Wants it to the nearest quarter." },
  { id: "count",   name: "Count Crustula",   voice: "formal",  from: 13, kind: "vampire",   weight: 0.4, blurb: "Only comes at dusk. Hates garlic. Loves a well-done crust." },
  { id: "mime",    name: "Marcel the Mime",  voice: "mime",    from: 14, kind: "mime",      weight: 0.4, blurb: "Orders without a word. You have to watch closely." },
  { id: "robot",   name: "Unit 7",           voice: "robot",   from: 19, kind: "robot",     weight: 0.45, blurb: "Here to 'study human pizza.' Takes notes. Smiles unconvincingly." },
  { id: "critic",  name: "Ms. Marlowe",      voice: "formal",  from: 99, kind: "critic",    weight: 0, blurb: "The city's sharpest food critic. Turns up when it matters." },
];
const ROSTER = [...REGULARS, ...SPECIALS];
const CUSTOMER = Object.fromEntries(ROSTER.map((c) => [c.id, c]));

// A look is deterministic from the id, so the same person always has the same
// face — in the queue, on the receipt and in the album.
const SKINS = ["#f5d3b3", "#e8b98c", "#c98f62", "#a86a43", "#7c4a2d", "#563222"];
const HAIRS = ["#2a1c14", "#4b2e1e", "#7a4a2a", "#b87333", "#d9b25a", "#c8c8c8", "#f2f0e8", "#c44a5a"];
const SHIRTS = ["#6b9bd1", "#e4806a", "#7dbf8e", "#e8c25a", "#b98ad6", "#e9a0b8", "#58b8b8", "#d9d2c2"];

function lookFor(entry) {
  const r = RNG.make(RNG.seedFrom("look:" + entry.id));
  const kid = entry.voice === "kid";
  const look = {
    skin: r.int(0, 5),
    hair: r.int(0, 7),           // 0 bald 1 short 2 long 3 curly 4 bun 5 spiky 6 ponytail 7 afro
    hairCol: r.int(0, 7),
    hat: r.chance(0.22) ? r.int(1, 5) : 0,  // 1 beanie 2 cap 3 sun hat 4 flower 5 chef
    glasses: r.chance(0.28) ? r.int(1, 2) : 0,
    beard: !kid && r.chance(0.2) ? r.int(1, 3) : 0,
    shirt: r.int(0, 7),
    nose: r.int(0, 2),
    age: kid ? 0 : r.int(1, 3),  // 0 child 1 young 2 middle 3 old
  };
  if (kid) { look.hair = [1, 2, 6, 5][r.int(0, 3)]; look.hat = 0; look.age = 0; }
  if (look.age === 3 && r.chance(0.5)) look.hairCol = r.chance(0.5) ? 5 : 6;
  if (entry.id === "okafor") { look.glasses = 1; look.age = 3; }
  const sp = {
    fire: { hat: 6, hair: 6 }, tourist: { hat: 3, glasses: 2 }, cultist: { hat: 7, beard: 0, shirt: 4 },
    invisible: { hat: 8, glasses: 1 }, prof: { hair: 5, hairCol: 6, glasses: 1, age: 3 }, vampire: { skin: 0, hair: 1, hairCol: 0, hat: 0, beard: 0 },
    mime: { skin: 0, hat: 9, shirt: 7 }, robot: { hat: 0 }, critic: { glasses: 2, hat: 0, hair: 4, hairCol: 7, age: 2 },
  }[entry.kind];
  if (sp) Object.assign(look, sp);
  return look;
}

/* ------------------------------------------------------------------ */
/* Voices                                                              */
/* ------------------------------------------------------------------ */

// Every voice is: opener + ask + the pizza + the extras + closer.
const VOICES = {
  polite:  { open: ["Hello!", "Hi there!", "Good afternoon!", "Hi!"], ask: ["I'd like", "Could I please get", "May I have", "Can I get"], close: ["Thank you!", "Thanks so much!", "Cheers!", "Much appreciated!"] },
  chatty:  { open: ["Oh hey! Great weather, huh?", "Hi! Busy day? Me too!", "Hey hey! Smells amazing in here.", "I was just walking by and — you're open! Perfect."], ask: ["Can I get", "I'm going to have", "Let me get", "Okay, gimme"], close: ["Anyway, that's me!", "How's your day going?", "Oh, nice shop, by the way!", "That's the order!"] },
  grumpy:  { open: ["Hmph.", "Make it quick.", "Yeah, yeah.", "Let's get this over with."], ask: ["Gimme", "I want", "Just give me", "Get me"], close: ["Don't mess it up.", "And hurry.", "Not much to ask.", "Hmph."] },
  silly:   { open: ["Greetings, pizza wizard!", "Behold, a hungry person!", "Knock knock! Who's there? Pizza!", "Quick, before my stomach attacks!"], ask: ["Conjure me", "I summon", "Bring forth", "Make me"], close: ["Make it a masterpiece!", "Do it for the glory!", "Pizza power!", "Ta-da!"] },
  terse:   { open: ["Hi.", "Yo.", "Hey.", "Morning. Well. Noon."], ask: ["Gimme", "Need", "Get me", "Make me"], close: ["Thanks.", "Cool.", "That's all.", "Done."] },
  excited: { open: ["OH WOW, I'm so hungry!", "Yay, pizza!", "I've been waiting ALL DAY for this!", "Hi hi hi!"], ask: ["I want", "Can I have", "Please make me", "I NEED"], close: ["Thank you thank you!", "This is going to be SO good!", "Yay!", "Hurry, hurry!"] },
  sleepy:  { open: ["*yawn* Oh. Hi.", "Mmm... hello...", "Is it lunchtime yet?", "Huh? Oh, pizza."], ask: ["Could I have", "I'll take", "Maybe", "Uh... get me"], close: ["Thanks... zzz.", "Wake me when it's ready.", "Mmm. Yes.", "Thanks."] },
  formal:  { open: ["Good day to you.", "Greetings.", "Pardon me.", "Good afternoon."], ask: ["I should like", "I would be obliged for", "Kindly prepare", "May I request"], close: ["Most kind.", "With thanks.", "I am obliged.", "Splendid."] },
  kid:     { open: ["Hi!", "Hello! I'm hungry!", "Can I have a pizza please?", "My mum said I can!"], ask: ["I want", "Can I have", "Please can I have", "I'd like"], close: ["Please!", "Thank you!", "I'm SO hungry!", "Can it be fast?"] },
  robot:   { open: ["GREETINGS, HUMAN.", "BEEP. HELLO.", "INITIATING PIZZA REQUEST.", "PROCESSING... HELLO."], ask: ["REQUEST:", "I REQUIRE", "PLEASE ASSEMBLE", "ORDER:"], close: ["THANK YOU. FEELING: SATISFACTORY.", "END OF REQUEST.", "BEEP.", "PIZZA LEVELS: LOW."] },
  mime:    { open: [""], ask: [""], close: [""] },
};

const REACT = {
  happy:   { polite: ["Perfect, thank you!", "Lovely!", "Just what I wanted."], chatty: ["Ooh, that's gorgeous!", "You're a star!", "Oh, that's exactly it!"], grumpy: ["...Fine. It's good.", "Hmph. Not bad.", "Don't let it go to your head."], silly: ["A masterpiece!", "I'm going to frame it!", "Pizza power!"], terse: ["Good.", "Nice.", "Yep."], excited: ["YES! That's the one!", "WOW! Look at it!", "Best. Pizza. Ever!"], sleepy: ["Mmm... lovely.", "Ahh. Yes.", "Perfect... zzz."], formal: ["Most satisfactory.", "Impeccable.", "A fine pie."], kid: ["Yay! Thank you!", "It's so pretty!", "Yummy!"], robot: ["ANALYSIS: DELICIOUS.", "JOY.EXE LOADED.", "RATING: OPTIMAL."], mime: ["*claps silently*", "*blows a kiss*", "*a very big bow*"] },
  okay:    { _: ["It's fine, thanks.", "Pretty good!", "Not bad at all.", "That'll do nicely."] },
  poor:    { _: ["Hmm. That's not quite it.", "I've had better.", "It's... a pizza.", "Well. It's food."] },
  refund:  { _: ["That's not what I ordered!", "I want my money back!", "No, no, no — that's wrong!", "That is NOT my order."] },
  left:    { _: ["I can't wait any longer!", "Forget it, I'm going!", "This is taking forever!", "Never mind!"] },
};
function reaction(entry, kind, rng) {
  const bank = REACT[kind];
  const lines = bank[entry.voice] || bank._ || bank.polite;
  return rng ? rng.pick(lines) : lines[0];
}

/* ------------------------------------------------------------------ */
/* Saying an order                                                     */
/* ------------------------------------------------------------------ */

const article = (w) => (/^[aeiou]/i.test(w) ? "an " : "a ") + w;
const joinList = (items) => (items.length <= 1 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1]);

function regionPhrase(region) {
  const r = REGIONS[region];
  if (region === "whole") return "all over";
  return REGIONS[region].area === 0.25 ? "in " + r.name : "on " + r.name;
}

// "mushrooms and olives all over, pepperoni on the left half"
function toppingsPhrase(order, mangle) {
  const groups = {};
  for (const r of order.reqs) (groups[r.region] = groups[r.region] || []).push(TOP[r.t].plural);
  const keys = Object.keys(groups).sort((a, b) => REGIONS[b].area - REGIONS[a].area);
  const parts = keys.map((k) => (keys.length === 1 && k === "whole" ? joinList(groups[k]) : joinList(groups[k]) + " " + regionPhrase(k)));
  return joinList(parts);
}

// The modifiers a customer tacks on. Six slices and a normal bake are the
// defaults, and defaults are never mentioned — that is what makes the unusual
// ones worth listening for.
function modifierPhrases(order, rng) {
  const out = [];
  if (order.sauce === "none") out.push("skip the sauce");
  else if (order.sauce !== "tomato" && !order.recipe) out.push(`use ${SAUCE[order.sauce].say} sauce instead of tomato`);
  if (order.cheese === "none") out.push(order.dairy ? "leave off the cheese — I can't have dairy" : "hold the cheese");
  else if (order.cheese === "extra") out.push("pile on the extra cheese");
  const b = BAKES.find((x) => x.runs === order.runs);
  if (b && b.say) out.push(order.runs === 4 ? "burn it to a crisp" : `bake it ${b.say}`);
  if (order.slices !== 6) out.push(order.slices === 1 ? "leave it uncut" : `cut it ${sliceWord(order.slices)}`);
  return out;
}

// A tourist says the name roughly right.
const mangle = (name) => name.replace(/[aeiou]/gi, (m, i) => (i % 3 === 0 ? m.toUpperCase() : m)).replace(/(\w{3})(?=\w{3})/g, "$1-");

function headPhrase(order, voice) {
  const tourist = voice === "tourist";
  if (order.recipes && order.recipes.length === 2) {
    const [a, b] = order.recipes.map((id) => RECIPE[id].name);
    return `a pizza that's half ${tourist ? mangle(a) : a} and half ${tourist ? mangle(b) : b}`;
  }
  if (order.recipe) {
    const n = RECIPE[order.recipe].name;
    return article(`${tourist ? mangle(n) : n} pizza`);
  }
  const veg = (order.rules || []).find((r) => r.type === "veg");
  if (veg) return `a vegetarian pizza — you pick the toppings, but at least ${veg.n} different veggies, please`;
  if (!order.reqs.length) return "a plain pizza with no toppings";
  return "a pizza with " + toppingsPhrase(order);
}

// The sentence the customer speaks. `entry` is who is speaking.
function sayOrder(entry, order, rng) {
  if (entry.voice === "mime") return mimeOrder(order);
  const v = VOICES[entry.voice] || VOICES.polite;
  const mods = modifierPhrases(order, rng);
  let line = `${rng.pick(v.open)} ${rng.pick(v.ask)} ${headPhrase(order, entry.kind === "tourist" ? "tourist" : "")}`;
  if (mods.length) line += `. ${rng.pick(["Oh, and ", "And please ", "Also, ", "One more thing: "])}${joinList(mods)}`;
  line += `. ${rng.pick(v.close)}`;
  return line.replace(/\s+/g, " ").replace(/\.\./g, ".").trim();
}

// Marcel never speaks. He mimes it: a little picture of what he wants.
function mimeOrder(order) {
  const arrow = { L: "◀", R: "▶", T: "▲", B: "▼", TL: "◤", TR: "◥", BL: "◣", BR: "◢", whole: "●" };
  const groups = {};
  for (const r of order.reqs) (groups[r.region] = groups[r.region] || []).push(ICON[r.t]);
  const bits = Object.keys(groups).map((k) => `${arrow[k]} ${groups[k].join(" ")}`);
  if (order.recipes && order.recipes.length === 2) bits.unshift("🙏");
  if (order.sauce === "none") bits.push("🚫🍅");
  else if (order.sauce !== "tomato") bits.push("🥫" + order.sauce);
  if (order.cheese === "none") bits.push("🚫🧀"); else if (order.cheese === "extra") bits.push("🧀🧀");
  if (order.runs > 1) bits.push("🔥".repeat(order.runs - 1));
  if (order.slices !== 6) bits.push(`🔪 ${order.slices}`);
  return "*mimes*  " + (bits.join("   ") || "🍕");
}

// A plain-language checklist — what the "Hint" button reveals.
function checklist(order) {
  const out = [];
  out.push(order.sauce === "none" ? "No sauce" : `${SAUCE[order.sauce].name} sauce`);
  out.push(order.cheese === "none" ? "No cheese" : order.cheese === "extra" ? "Extra cheese" : "Cheese");
  const groups = {};
  for (const r of order.reqs) (groups[r.region] = groups[r.region] || []).push(TOP[r.t].plural);
  for (const k of Object.keys(groups)) out.push(`${joinList(groups[k])} ${regionPhrase(k)}`);
  for (const rule of order.rules || []) if (rule.type === "veg") out.push(`${rule.n}+ veg toppings, no meat`);
  const b = BAKES.find((x) => x.runs === order.runs);
  out.push(`${order.runs} trip${order.runs > 1 ? "s" : ""} through the oven (${b.name.toLowerCase()})`);
  out.push(order.slices === 1 ? "Leave uncut" : `${order.slices} slices`);
  return out;
}

// The same order boiled down to short chips — the written ticket that "order
// notes" pins above the board.
function ticketChips(order) {
  const out = [];
  const sauce = order.sauce === "none" ? "No sauce" : `${SAUCE[order.sauce].name} sauce`;
  const cheese = order.cheese === "none" ? "no cheese" : order.cheese === "extra" ? "EXTRA cheese" : "cheese";
  out.push(`${sauce} · ${cheese}`);
  const groups = {};
  for (const r of order.reqs) (groups[r.region] = groups[r.region] || []).push(TOP[r.t].name);
  for (const k of Object.keys(groups)) out.push(`${groups[k].join(" + ")}${k === "whole" ? "" : " · " + REGIONS[k].name.replace("the ", "")}`);
  for (const rule of order.rules || []) if (rule.type === "veg") out.push(`${rule.n}+ veg, no meat`);
  out.push(`${order.runs === 1 ? "Bake ×1" : `Bake ×${order.runs} (${BAKES[order.runs - 1].name.toLowerCase()})`} · ${order.slices === 1 ? "don't cut" : order.slices + " slices"}`);
  return out;
}

/* ------------------------------------------------------------------ */
/* Making an order                                                     */
/* ------------------------------------------------------------------ */

// ctx: { day, tops:Set<string> owned, sauces:Set<string> owned, entry }
function makeOrder(rng, ctx) {
  const P = params(ctx.day + (ctx.boost || 0));   // a judge's order is a few days harder
  const owned = [...ctx.tops];
  const entry = ctx.entry || {};
  const order = { sauce: "tomato", cheese: "normal", reqs: [], rules: [], runs: 1, slices: 6, recipe: null, dairy: false };

  const pickW = (pairs) => rng.weighted(pairs, (p) => p[1])[0];
  order.runs = pickW(P.runs);
  order.slices = pickW(P.slices);

  /* the person tweaks the dials */
  if (entry.kind === "fire") order.runs = Math.max(order.runs, ctx.day >= 7 ? 3 : 2);
  if (entry.kind === "vampire") order.runs = Math.max(order.runs, 2);
  if (entry.kind === "prof") order.slices = rng.pick([4, 8, 8, 12].filter((s) => s !== 12 || ctx.day >= 13));
  if (entry.voice === "kid") { order.runs = 1; order.slices = rng.pick([4, 6]); }

  /* toppings */
  const eligible = RECIPES.filter((r) => r.chapter <= chapterOf(ctx.day).id && r.tops.every((t) => ctx.tops.has(t)) && (!r.sauce || ctx.sauces.has(r.sauce)));
  const forceRecipe = entry.kind === "tourist" && eligible.length;
  const wantRecipe = eligible.length && (forceRecipe || rng.chance(P.pRecipe));
  const wantVeg = !wantRecipe && owned.filter(isVeg).length >= 3 && rng.chance(P.pVeg) && entry.voice !== "kid";

  if (wantRecipe) {
    const half = rng.chance(P.pHalfRecipe);
    const pair = half ? eligibleHalfPair(rng, eligible) : null;
    if (pair) {
      const axis = rng.pick(["LR", "TB"]);
      const [ra, rb] = rng.chance(0.5) ? pair : [pair[1], pair[0]];
      order.recipes = [ra.id, rb.id];
      for (const t of ra.tops) order.reqs.push({ t, region: axis[0] });
      for (const t of rb.tops) order.reqs.push({ t, region: axis[1] });
    } else {
      const r = rng.pick(eligible);
      order.recipe = r.id;
      for (const t of r.tops) order.reqs.push({ t, region: "whole" });
      if (r.sauce) order.sauce = r.sauce;
    }
  } else if (wantVeg) {
    order.rules.push({ type: "veg", n: Math.min(3, rng.int(2, 3)) });
  } else {
    freeToppings(rng, order, owned, P, entry);
  }

  /* sauce & cheese */
  if (!order.recipe && !order.recipes && !wantVeg && rng.chance(P.pSauce)) {
    const ss = [...ctx.sauces].filter((s) => s !== "tomato");
    if (ss.length) order.sauce = rng.pick(ss);
  }
  if (order.sauce === "tomato" && rng.chance(P.pNoSauce)) order.sauce = "none";
  if (rng.chance(P.pNoCheese)) { order.cheese = "none"; order.dairy = rng.chance(0.4); }
  else if (rng.chance(P.pExtraCheese)) order.cheese = "extra";

  order.price = orderPrice(order);
  return order;
}

function eligibleHalfPair(rng, eligible) {
  const pairs = [];
  for (let i = 0; i < eligible.length; i++) for (let j = i + 1; j < eligible.length; j++) {
    const a = eligible[i], b = eligible[j];
    if (a.sauce || b.sauce) continue;
    if (a.tops.some((t) => b.tops.includes(t))) continue;
    if (a.tops.length + b.tops.length > 5) continue;
    pairs.push([a, b]);
  }
  return pairs.length ? rng.pick(pairs) : null;
}

function freeToppings(rng, order, owned, P, entry) {
  const maxN = Math.min(P.maxTops, owned.length);
  let n = rng.int(1, Math.max(1, maxN));
  if (entry.kind === "prof") n = Math.max(2, n);
  const tops = rng.shuffle(owned).slice(0, n);
  // Never an all-meat-and-fish-only joke: just pick; the player works it out.
  const roll = rng();
  const halves = tops.length >= 2 && roll < P.pHalf;
  const quarters = !halves && roll >= P.pHalf && roll < P.pHalf + P.pQuarter && tops.length >= 1;
  if (halves) {
    const axis = rng.pick(["LR", "TB"]);
    // Some on one side, the rest on the other. A lone extra can go whole.
    const split = rng.int(1, tops.length - 1);
    tops.forEach((t, i) => order.reqs.push({ t, region: i < split ? axis[0] : axis[1] }));
  } else if (quarters) {
    // One topping in a single quarter; anything else goes whole.
    const q = rng.pick(QUARTERS);
    tops.forEach((t, i) => order.reqs.push({ t, region: i === 0 ? q : "whole" }));
    if (tops.length === 1) order.reqs.push({ t: tops[0], region: QUARTER_NEIGHBOURS[q][0] });
  } else {
    tops.forEach((t) => order.reqs.push({ t, region: "whole" }));
  }
}

// A rough count of seconds of the player's own work, not counting the oven.
// The game adds the oven and turns it into patience.
function workSeconds(order) {
  let s = 4 + 3;                      // take the order, move the dough
  s += order.sauce === "none" ? 0 : 5;
  s += order.cheese === "none" ? 0 : order.cheese === "extra" ? 8 : 5;
  for (const r of order.reqs) s += quotaFor(r.region) * 0.9 + 1.2;
  for (const rule of order.rules || []) if (rule.type === "veg") s += rule.n * 8;
  s += order.slices > 1 ? order.slices / 2 * 1.3 + 1 : 0;
  s += 5;                             // box and serve
  return s;
}

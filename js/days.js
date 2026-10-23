// Slice of Life — the campaign: five chapters, a rival in each, and the numbers
// that say how hard every day is.
//
// A day is a clock (noon to nine, compressed) with a single-file queue. What
// makes day 24 harder than day 4 is not a faster clock — it is what the
// customers ASK for, so every difficulty dial lives in params(): how many
// toppings, how often half and half, how often a named recipe, how many trips
// through the oven. The kitchen's speed comes from the shop.

const DAYS_PER_CHAPTER = 6;
const CAMPAIGN_DAYS = DAYS_PER_CHAPTER * 5;

const CHAPTERS = [
  {
    id: 1, name: "The Grouch Next Door", icon: "🏠", hue: "#e4572e",
    rival: { name: "Gus Grumbleton", shop: "Grumbleton's Slice Shack", look: { skin: 1, hair: 1, hairCol: 5, beard: 1, hat: 0, glasses: 0, shirt: 4 } },
    intro: "You've just opened. Next door, Gus Grumbleton has sold slices since before you were born — and he'd like you to know you won't last the month.",
    win: "Gus came in, ordered a plain cheese, and ate it standing up. 'Fine,' he said. 'Fine!' It's the nicest thing he's ever said.",
    lose: "Gus's slices are still the talk of the street. But your queue is growing, and that's a start.",
    taunts: ["Gus has put a sign up: 'REAL pizza — no gimmicks.'", "Gus is standing outside, arms folded, watching your queue.", "Gus 'accidentally' parked his delivery moped across your doorstep."],
  },
  {
    id: 2, name: "The Crust Cult", icon: "🔮", hue: "#8e5bd6",
    rival: { name: "Mother Mozzarella", shop: "The Order of the Golden Crust", look: { skin: 3, hair: 4, hairCol: 7, beard: 0, hat: 6, glasses: 0, shirt: 5 } },
    intro: "Strangers in purple robes keep ordering at noon. They hum. They want everything exactly as specified, and they say your crust speaks to them.",
    win: "Mother Mozzarella bowed. 'The crust has chosen,' she said. The humming stopped. You are not sure what you just won.",
    lose: "The robes are still gathering by the window. Their humming is getting louder.",
    taunts: ["The cult has painted a pizza on your pavement. It's quite a good one.", "Mother Mozzarella sends word: 'The oven knows.'", "Someone left a candle outside the shop. And a coupon."],
  },
  {
    id: 3, name: "The Great Bake-Off", icon: "🏆", hue: "#f2a900",
    rival: { name: "Professor Pietro Pi", shop: "Pi's Scientifically Perfect Pizza", look: { skin: 2, hair: 2, hairCol: 6, beard: 0, hat: 0, glasses: 2, shirt: 0 } },
    intro: "The city's pizza contest has come to town, and last year's champion makes pies by the gram. Everyone wants to know if a human can beat a ruler.",
    win: "The judges measured, tasted, and measured again. 'Statistically,' said the Professor, 'that is delicious.'",
    lose: "The Professor's pies are perfectly round. Yours were more... enthusiastic. The crowd still loved them.",
    taunts: ["Professor Pi has published a graph. You are on it. You are small.", "The Professor was seen measuring your pepperoni with a ruler.", "A calibrated thermometer arrived anonymously. It's for your oven."],
  },
  {
    id: 4, name: "Rise of the Robo-Chefs", icon: "🤖", hue: "#2f9e9e",
    rival: { name: "Madame Béchamel-9000", shop: "AutoPizza™ Franchise #4,812", look: { skin: 0, hair: 0, hairCol: 0, beard: 0, hat: 0, glasses: 1, shirt: 3 } },
    intro: "Robot pizza kitchens are opening on every corner — fast, cheap, and a little bit joyless. The little pizzerias are counting on you.",
    win: "Madame Béchamel's robots tried to copy your slice and produced a perfect, flavourless circle. The street cheered for yours.",
    lose: "The robots are quick. But a few regulars still said they missed the human touch.",
    taunts: ["AutoPizza™ has launched a pizza in 0.4 seconds. Nobody liked it.", "A robot was seen taking notes outside your window.", "Madame Béchamel-9000 has offered to buy you out. Her offer was in binary."],
  },
  {
    id: 5, name: "Across the Street", icon: "🌟", hue: "#d63a6a",
    rival: { name: "Zephyra the Ancient", shop: "Zephyra's Legendary Wood-Fire", look: { skin: 4, hair: 2, hairCol: 7, beard: 0, hat: 3, glasses: 0, shirt: 1 } },
    intro: "Overnight, a brand-new restaurant appeared directly across the street. It has been here for six hundred years. Its owner says she is 'just visiting'.",
    win: "Zephyra tasted your slice for a long time. 'Six hundred years,' she said, 'and I have never been surprised until now.'",
    lose: "Zephyra's wood-fired oven smells wonderful. But you've built something that's yours, and the street knows it.",
    taunts: ["Zephyra's oven has been lit since the Renaissance.", "A raven delivered Zephyra's menu to your window.", "Zephyra waved. It was somehow rude."],
  },
];

// After the campaign the street keeps coming — one more "chapter" that repeats.
const ENDLESS = {
  id: 6, name: "The Neighbourhood", icon: "🍕", hue: "#e4572e",
  rival: { name: "Everybody's A Critic", shop: "The Whole Street", look: { skin: 2, hair: 3, hairCol: 2, beard: 0, hat: 0, glasses: 2, shirt: 6 } },
  intro: "The big rivals are beaten. The shop is yours. The street keeps coming, hungrier than ever.",
  win: "A record day. The whole street is talking about it.",
  lose: "A quiet day. Tomorrow's another.",
  taunts: ["Somebody's cousin is opening a pizza place.", "A food blogger is in the queue.", "There's a rumour about a new topping."],
};

const chapterOf = (day) => (day > CAMPAIGN_DAYS ? ENDLESS : CHAPTERS[Math.min(CHAPTERS.length - 1, Math.floor((day - 1) / DAYS_PER_CHAPTER))]);
const dayInChapter = (day) => (day > CAMPAIGN_DAYS ? ((day - CAMPAIGN_DAYS - 1) % DAYS_PER_CHAPTER) + 1 : ((day - 1) % DAYS_PER_CHAPTER) + 1);
// The last day of every chapter, and every sixth day of the endless run.
const isShowdown = (day) => dayInChapter(day) === DAYS_PER_CHAPTER;

/* ---------------------------- how hard is today ---------------------------- */

// Every dial is a function of the day, so a new day never needs authoring. The
// shop only ever offers an ingredient the player owns, so these are chances,
// not guarantees.
function params(day) {
  const d = Math.max(1, day);
  const lerpStep = (pts) => {           // piecewise-constant by day thresholds
    let v = pts[0][1];
    for (const [from, val] of pts) if (d >= from) v = val;
    return v;
  };
  return {
    maxTops:   lerpStep([[1, 1], [3, 2], [7, 3], [13, 3], [19, 4], [25, 5]]),
    pHalf:     lerpStep([[1, 0], [7, 0.25], [13, 0.35]]),
    pQuarter:  lerpStep([[1, 0], [19, 0.15], [25, 0.25]]),
    pRecipe:   lerpStep([[1, 0], [5, 0.15], [7, 0.3], [13, 0.35]]),
    pHalfRecipe: lerpStep([[1, 0], [19, 0.3]]),
    pNoSauce:  lerpStep([[1, 0], [7, 0.07]]),
    pNoCheese: lerpStep([[1, 0], [7, 0.1]]),
    pExtraCheese: lerpStep([[1, 0], [4, 0.12]]),
    pSauce:    lerpStep([[1, 0], [13, 0.12], [19, 0.25]]),
    pVeg:      lerpStep([[1, 0], [13, 0.12]]),
    // [runs, weight]
    runs:      lerpStep([[1, [[1, 1]]], [3, [[1, 0.7], [2, 0.3]]], [7, [[1, 0.6], [2, 0.3], [3, 0.1]]], [13, [[1, 0.5], [2, 0.3], [3, 0.2]]], [19, [[1, 0.45], [2, 0.3], [3, 0.2], [4, 0.05]]]]),
    // [slices, weight] — six is the default and the unspoken one
    slices:    lerpStep([[1, [[6, 1]]], [3, [[6, 0.7], [4, 0.15], [8, 0.15]]], [7, [[6, 0.5], [4, 0.2], [8, 0.2], [2, 0.1]]], [13, [[6, 0.4], [4, 0.15], [8, 0.2], [2, 0.08], [12, 0.1], [10, 0.05], [1, 0.02]]], [19, [[6, 0.35], [4, 0.15], [8, 0.2], [2, 0.05], [12, 0.1], [10, 0.05], [16, 0.07], [1, 0.03]]]]),
  };
}

// How the day is paced. The clock is the same every day (the shop can lengthen
// it); what changes is how steadily the queue fills.
const BASE_DAY_SECONDS = 240;
const LINE_MAX = 4;
const MAX_OPEN = 3;                    // orders in the kitchen at once

// How many seconds between arrivals, and how many can stand in line, by day.
const arrivalGap = (day) => Math.max(6, 16 - day * 0.35);
const lineTarget = (day) => Math.min(LINE_MAX, 1 + Math.floor(day / 6));

// Patience is a multiple of the work an order needs (its own preparation plus
// its trips through the oven), and it has to cover the people standing in front
// of them: required patience ~ latency + (queue depth - 1) x cycle. So it grows
// with the line, and falls with the day only slowly — the shop sells speed.
function patienceMult(day) {
  const base = Math.max(1.3, 1.85 - day * 0.015);
  return base * (1 + 0.55 * (lineTarget(day) - 1));
}

function dayInfo(day) {
  const chap = chapterOf(day);
  return {
    day, chapter: chap, nth: dayInChapter(day), showdown: isShowdown(day),
    patience: patienceMult(day),
    params: params(day),
  };
}

/* ------------------------------- ranks & news ------------------------------- */

const RANKS = [
  { at: 0,    name: "Dough Rookie" },
  { at: 80,   name: "Sauce Slinger" },
  { at: 250,  name: "Line Cook" },
  { at: 550,  name: "Oven Whisperer" },
  { at: 1000, name: "Pizzaiolo" },
  { at: 1700, name: "Master Ovenist" },
];
const rankFor = (rep) => {
  let r = RANKS[0], i = 0;
  RANKS.forEach((x, k) => { if (rep >= x.at) { r = x; i = k; } });
  const next = RANKS[i + 1] || null;
  return { ...r, index: i, next, toNext: next ? next.at - rep : 0 };
};

// Pizza News Network. A headline per campaign day, then generic ones.
const PNN = [
  /* 1 */ ["NEW PIZZA SHOP OPENS ON ELM STREET", "Sources say the smell is 'extremely hard to walk past.'"],
  /* 2 */ ["LOCAL MAN SAYS CHEESE 'IS GOOD'", "Experts agree. More at six."],
  /* 3 */ ["OVENS REPORTED TO BE 'HOT'", "A spokes-oven declined to comment."],
  /* 4 */ ["STREET'S LONGEST-SERVING PIZZA SHOP 'NOT WORRIED'", "'Not worried at all,' says man sweating on camera."],
  /* 5 */ ["PINEAPPLE DEBATE REACHES COUNCIL", "Mayor abstains. Mayor's lunch was pepperoni."],
  /* 6 */ ["BIG DAY AS RIVALS FACE OFF", "Both shops have lined up their finest. Pizza lovers hold their breath."],
  /* 7 */ ["PURPLE ROBES SPOTTED ON ELM STREET", "'They just hum,' says one witness. 'Politely.'"],
  /* 8 */ ["LOCAL ORDER SEEKS 'PERFECT CRUST'", "Spokesperson: 'It must be golden. It must be round. It must be on time.'"],
  /* 9 */ ["WEATHER: SUNNY, WITH A CHANCE OF CHEESE", "Forecasters are 'optimistic about the cheese.'"],
  /* 10 */ ["CULT 'NOT A CULT', SAYS CULT", "They'd also like a large Capricciosa."],
  /* 11 */ ["CLOCK WATCHERS CALL FOR LONGER OPENING HOURS", "'More pizza, more of the time,' reads one placard."],
  /* 12 */ ["THE CRUST CULT HOLDS A TASTING", "Mother Mozzarella will judge the crusts personally."],
  /* 13 */ ["GREAT BAKE-OFF COMES TO TOWN", "Entry forms were all folded into perfect triangles."],
  /* 14 */ ["PIZZA PROFESSOR UNVEILS 'PERFECT PIE'", "It is a circle. Reviewers are impressed by its circle."],
  /* 15 */ ["VAMPIRE SAID TO BE 'JUST A REGULAR'", "He prefers it well done and speaks very slowly."],
  /* 16 */ ["MIME HAS 'A LOT TO SAY' ABOUT TOPPINGS", "Witnesses saw hand gestures. Many hand gestures."],
  /* 17 */ ["ARE YOU USING ENOUGH QUARTERS? STUDY SAYS NO", "The study was about pizza, mostly."],
  /* 18 */ ["JUDGES SHARPEN FORKS AHEAD OF FINAL", "'No mercy,' says head judge. 'Some mercy,' says assistant."],
  /* 19 */ ["ROBOT KITCHENS 'NOT BAD', SAY ROBOTS", "Humans polled said 'a bit quiet.'"],
  /* 20 */ ["PIZZA IN 0.4 SECONDS? NOBODY ASKED FOR THAT", "AutoPizza™ responds: 'We did.'"],
  /* 21 */ ["BEATING THE ROBOTS: THE HUMAN TOUCH", "Experts say it's mostly thumbs."],
  /* 22 */ ["SMALL SHOPS STAND TOGETHER", "Local bakers reportedly 'tired but hopeful.'"],
  /* 23 */ ["ROBOT ASKS: 'WHAT IS A TOPPING?'", "Replied a nearby cat: 'a gift.'"],
  /* 24 */ ["AUTOPIZZA™ FINAL SHOWDOWN THIS EVENING", "Bring a friend. Or a robot. Or both."],
  /* 25 */ ["MYSTERY RESTAURANT APPEARS OVERNIGHT", "It has 'been here since 1423,' says its owner."],
  /* 26 */ ["WOOD-FIRE ENTHUSIASTS CALL FOR HOLIDAY", "'The smoke is quite pleasant,' says nearby pigeon."],
  /* 27 */ ["LEGENDARY OVEN HAS ITS OWN WEATHER", "Light rain, brief sun, small thunder."],
  /* 28 */ ["ELM STREET NAMED 'BEST PIZZA STREET' (TWICE)", "Two committees, two plaques."],
  /* 29 */ ["ZEPHYRA SPOTTED OUTSIDE YOUR WINDOW", "She did not wave. She nodded. It was intense."],
  /* 30 */ ["THE FINAL SHOWDOWN: PIZZA AT ITS BEST", "Whoever wins gets the key to the street."],
];
const PNN_ENDLESS = [
  ["PIZZA PRICES STABLE, CHEESE REMAINS GOOD", "Experts nod. Several experts are also hungry."],
  ["LOCAL SHOP KEEPS ROLLING", "'Same time tomorrow,' says a regular."],
  ["REGULARS REPORT 'STRONG CRUST VIBES'", "The shop declined to comment on vibes."],
  ["QUEUE ROUND THE BLOCK, SAYS BLOCK", "The block is proud."],
  ["NEW TOPPING RUMOURS SWEEP THE STREET", "It's probably a pineapple thing."],
  ["PIZZA LOVERS ENJOY WELL-EARNED DINNER", "Having served dinner, the shop plans lunch."],
];
const newsFor = (day) => (day <= PNN.length ? PNN[day - 1] : PNN_ENDLESS[(day - PNN.length - 1) % PNN_ENDLESS.length]);

// What the newsreader says about LAST night's takings, to run beneath the headline.
function recapLine(res) {
  if (!res) return "";
  if (res.profit >= 8000) return `A bumper day: ${money(res.profit)} profit. The street is talking.`;
  if (res.refunds >= 3) return "A few unhappy faces were seen leaving. Tomorrow's a fresh dough.";
  if (res.left >= 2) return "Several people gave up waiting. Maybe a faster oven?";
  if (res.avgStars >= 4.5) return "Customers describe the pizza as 'actually brilliant.'";
  if (res.avgStars >= 3.5) return "Pizzas described as 'good'. Some said 'great'.";
  return "Pizza was served. Pizza was eaten. Most agreed it was pizza.";
}

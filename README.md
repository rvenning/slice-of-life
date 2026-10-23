# Slice of Life 🍕

Run your own pizza shop. A customer tells you their order — once, out loud —
and you make exactly that: sauce, cheese, toppings (half and half, if they ask),
a trip or three through the oven, the right number of slices, a box. Get it right
and they tip. Get it wrong and they hand it back. Out-pizza the rival across the
street.

**[▶️ Play it](https://rvenning.github.io/slice-of-life/)**

Inspired by the cozy pizza-shop simulators — the order is *listened to*, the
toppings are laid by hand, the oven is the bottleneck, and the profit is whatever
is left after the ingredients. Everything here (name, cast, art, writing, code)
is original.

## Features

- **Listen first.** Orders are spoken once, in the customer's own voice. A
  *What?* button repeats it (and costs a little of their happiness), a *Hint*
  gives a plain checklist (costs more). A written ticket is on by default; switch
  it off for the real game and a bonus tip for remembering unaided.
- **Build it by hand.** Drag sauce, drag cheese (twice for *extra*), tap or drag
  toppings out of steel bins. Half-and-half, quarters, vegetarian, no cheese, no
  sauce, white garlic or barbecue instead of tomato — and named recipes
  (Hawaiian, Capricciosa, Triple P…) that the Recipe Book teaches you.
- **The oven runs in trips.** One is normal, two is well done, three is extra
  crispy, four is charcoal. Racks and a faster oven are in the shop.
- **Cut it.** Swipe across the middle; one cut is two slices, three is six (the
  usual). A guide cutter snaps to even slices.
- **Three pizzas on the go**, a single-file line, a patience meter on every
  customer, and a day on a clock — noon to nine.
- **Money that means something.** Ingredients cost real money (meat is dear),
  so piling it on costs you. Tips grow with stars and happiness.
- **Five chapters, a rival in each** — a grouch next door, a crust cult, a
  bake-off, robot kitchens, a six-hundred-year-old restaurant across the street —
  each ending in a showdown where a critic judges you. The **Pizza News Network**
  reports on it all.
- **47 customers**, each with a face and a voice: regulars, a fireman, a tourist
  who mangles the recipe names, a mime who orders in pictures, a vampire, a
  robot, an invisible man.
- **The Kitchen and the Decor** — fifteen toppings, four sauces, eight pieces of
  equipment, and a dozen things to hang on the walls.
- Family profiles with PINs, cross-device sync, offline play, installable.

## Built on gamekit

Screens, profiles, storage/sync, sound and PWA install come from
[gamekit](https://github.com/rvenning/gamekit), vendored into `lib/`:

```
node ../gamekit/tools/sync-to-game.js "../slice-of-life"
```

Never edit `lib/` directly — it is a vendored copy and the next sync overwrites
it. Bump the cache and the shown version with
`node lib/tools/stamp-version.js . --bump` after any shell change.

## How it is put together

No build step: plain `<script>` tags, in this order.

| File | What it holds |
|---|---|
| `js/menu.js` | Toppings, sauces, regions, bakes, recipes; the seeded RNG |
| `js/pizza.js` | One pizza as data, and the grader — no DOM, no clock |
| `js/days.js` | Five chapters, the rivals, the news, every difficulty dial |
| `js/orders.js` | The cast, their voices, and how an order becomes a sentence |
| `js/upgrades.js` | The Kitchen, the Decor, and the kit a profile plays with |
| `js/game.js` | One day in the shop — line, kitchen, oven, patience, the books |
| `js/storage.js` | Save shape and the cross-device merge |
| `js/art.js` | Every picture, drawn in canvas paths with one outline and one palette |
| `js/render.js` | The lobby, the ticket rail, the kitchen |
| `js/main.js` | Screens, the dock, input, the shop, results |

**An order is data first and a sentence second.** `{ sauce, cheese, reqs, rules,
runs, slices }` is what the grader reads; the customer speaks words generated from
it, so what is said can never disagree with what is asked.

**Two questions, not one.** The grader answers *did they get what they asked
for?* (any miss is a refund, with a plain sentence saying which) separately from
*how well was it made?* (coverage, spread, evenness of the cut — that sets the
stars and the tip).

## Tests

```
npm test
```

- `tests/pizza.test.js` — every rule a customer enforces, one case each.
- `tests/content.test.js` — every order any customer can speak, on any day, is
  satisfiable by a real build, says everything it asks for, and never asks for
  something the shop doesn't stock.
- `tests/game.test.js` — the line, the kitchen, the oven, patience, closing time.
- `tests/storage.test.js` — the sync merge, in both argument orders.
- `tests/bot.test.js` — four players (pro / normal / child / very slow) play the
  whole campaign on the real engine; they differ in speed and in how well they
  listen. `node tests/summary.js [hard]` prints a one-screen comparison.

```
node tests/diag.js 15 normal     # where one day's time really goes
```

## Local development

```
npx http-server . -p 8141 -c-1
```

Then open <http://localhost:8141>. Add `?debug=1` for the debug panel (jump to any
day, +$100) — saving is switched off while it is on.

## Storage

localStorage prefix `sol_`, Firestore collection `sliceoflife` in the shared
family project. The ledger is three monotonic counters (earned, supplies, spent)
and the balance is derived, so merging two devices with `max()` can never bring
spent money back. The Firebase API key in `js/firebase-config.js` is a client
config restricted to Firestore, not a secret.

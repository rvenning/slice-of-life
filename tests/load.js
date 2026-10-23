// Shared sandbox loader. Same concatenation order as index.html — a file that
// reads another's top-level `const` crashes on load if the order drifts.

const path = require("node:path");
const { loadScripts } = require("../lib/tools/test-harness.js");

const ROOT = path.join(__dirname, "..");

function load() {
  return loadScripts({
    baseDir: ROOT,
    files: [
      "lib/gk-util.js",
      "js/menu.js",
      "js/pizza.js",
      "js/days.js",
      "js/orders.js",
      "js/upgrades.js",
      "js/game.js",
    ],
    exports: [
      "RNG", "money", "TOPPINGS", "TOP", "isMeat", "isVeg", "SAUCES", "SAUCE", "BASE_PRICE", "BASE_COST",
      "BAKES", "REGIONS", "HALVES", "QUARTERS", "quotaFor", "RECIPES", "RECIPE", "sliceWord",
      "GRID", "CELLS", "PIECE_MAX", "MAX_PIECES", "newPizza", "paintSauce", "sprinkle", "scrape", "dropTopping",
      "undoTopping", "clearToppings", "addCut", "undoCut", "guideAngles", "snapCut", "slicesOf",
      "sauceCoverage", "cheeseDensity", "cheeseCoverage", "pizzaCost", "gradePizza", "starsFor", "orderPrice",
      "inRegion", "inRegionSoft", "normAngle", "angleGap", "lineDistToCentre",
      "CHAPTERS", "ENDLESS", "chapterOf", "dayInChapter", "isShowdown", "params", "dayInfo", "DAYS_PER_CHAPTER",
      "CAMPAIGN_DAYS", "patienceMult", "BASE_DAY_SECONDS", "LINE_MAX", "MAX_OPEN", "RANKS", "rankFor", "PNN", "newsFor", "recapLine",
      "ICON", "REGULARS", "SPECIALS", "ROSTER", "CUSTOMER", "lookFor", "VOICES", "sayOrder", "checklist",
      "makeOrder", "workSeconds", "headPhrase", "modifierPhrases", "reaction",
      "UPGRADES", "UPGRADE", "DECOR", "DECOR_ALL", "kitFor", "BASE_KIT", "upgradeLevel", "ownsTopping", "ownsSauce",
      "ownsDecor", "decorLook",
      "Game", "clockText", "arrivalGap", "lineTarget", "PAY_MULT", "TIP_RATE", "REP_FOR",
    ],
    browser: true,
    globals: { performance: { now: () => 0 }, requestAnimationFrame() {} },
  });
}

module.exports = { load, ROOT };

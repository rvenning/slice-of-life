// Slice of Life icons: a whole pizza, seen from above, with a slice lifted out,
// on a warm cream tablecloth. Everything gets a thick ink outline, drawn as a
// slightly larger ink shape behind each fill, since png.js only fills.
//
//   $env:Path += ';C:\Program Files\nodejs'
//   node tools/make-icons.js

const fs = require("fs");
const path = require("path");
const { makeCanvas, downsample, encodePNG } = require("../lib/tools/png.js");

const INK = "#4a2a24";
const CLOTH = "#f6e0cf";
const CLOTH_CHECK = "#e9b3aa";
const CRUST = "#dfa24c";
const CRUST_DK = "#c78534";
const CHEESE = "#f7d878";
const SAUCE = "#d24b32";
const PEP = "#bf3d2a";
const PEP_DK = "#962c1e";
const MUSH = "#efe0c2";
const OLIVE = "#34303a";

function paint(size, art) {
  const SS = 4, big = size * SS;
  const cv = makeCanvas(big);
  const u = big / 100;
  const mid = big / 2;
  const S = (n) => n * u * art;

  cv.fillRect(0, 0, big, big, CLOTH);
  // tablecloth checks
  const cell = 12.5 * u;
  for (let r = 0; r * cell < big; r++) for (let q = 0; q * cell < big; q++) {
    if ((r + q) % 2 === 0) cv.fillRect(q * cell, r * cell, cell, cell, CLOTH_CHECK);
  }

  const cx = mid, cy = mid + S(2), R = S(40);
  // the pizza: ink, crust, dough, sauce, cheese
  cv.fillCircle(cx, cy, R + S(2.6), INK);
  cv.fillCircle(cx, cy, R, CRUST);
  cv.fillCircle(cx - S(1.5), cy - S(2), R * 0.97, CRUST_DK);
  cv.fillCircle(cx, cy, R * 0.93, CRUST);
  cv.fillCircle(cx, cy, R * 0.82, SAUCE);
  cv.fillCircle(cx, cy, R * 0.76, CHEESE);

  // toppings
  const pep = [[-0.34, -0.3], [0.3, -0.38], [0.02, 0.0], [-0.4, 0.26], [0.36, 0.26], [-0.04, 0.5], [0.52, -0.02]];
  for (const [dx, dy] of pep) {
    cv.fillCircle(cx + dx * R, cy + dy * R, S(7.4), INK);
    cv.fillCircle(cx + dx * R, cy + dy * R, S(6), PEP);
    cv.fillCircle(cx + dx * R - S(1.4), cy + dy * R - S(1.4), S(1.5), PEP_DK);
    cv.fillCircle(cx + dx * R + S(1.6), cy + dy * R + S(1.2), S(1.2), PEP_DK);
  }
  for (const [dx, dy] of [[-0.18, -0.58], [0.46, 0.5], [-0.6, -0.04], [0.14, 0.28]]) {
    cv.fillCircle(cx + dx * R, cy + dy * R, S(4.2), INK);
    cv.fillCircle(cx + dx * R, cy + dy * R, S(3.3), MUSH);
  }
  for (const [dx, dy] of [[-0.5, 0.5], [0.12, -0.6], [0.62, 0.3], [-0.12, 0.12]]) {
    cv.fillCircle(cx + dx * R, cy + dy * R, S(3.2), INK);
    cv.fillCircle(cx + dx * R, cy + dy * R, S(2.2), OLIVE);
    cv.fillCircle(cx + dx * R, cy + dy * R, S(0.9), CHEESE);
  }

  // two cut lines
  cv.fillRect(cx - R * 0.96, cy - S(0.7), R * 1.92, S(1.4), INK);
  cv.fillRect(cx - S(0.7), cy - R * 0.96, S(1.4), R * 1.92, INK);

  return encodePNG(size, size, downsample(cv.px, big, SS));
}

const out = path.join(__dirname, "..", "icons");
fs.mkdirSync(out, { recursive: true });

for (const [name, size, art] of [
  ["icon-192.png", 192, 1.0],
  ["icon-512.png", 512, 1.0],
  ["maskable-512.png", 512, 0.72],
]) {
  fs.writeFileSync(path.join(out, name), paint(size, art));
  console.log("wrote", name);
}

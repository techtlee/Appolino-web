// The browser tab's icon: the logo itself (src/assets/appolino-sun.svg), unchanged but for its
// viewBox, cut closer round the sun, and a dark tile laid under it. The logo's box is mostly its own glow, so at a tab's 16px
// the disc was 8px across and read as a faint smudge; this crop makes the disc and its beams
// some 1.5 times larger while the glow still fades before the edge on a dark tab strip (the
// owner, 2026-11-01: "tab favicon more stunning"). Nothing is redrawn: run this again whenever
// the logo changes. Usage: node scripts/tab-icon.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logo = readFileSync(join(root, "src/assets/appolino-sun.svg"), "utf8");
// The sun a little smaller in its tile than the first cut (owner: "a little bit smaller"), with
// room round it for the night.
const CROP = "-94 -86 188 188";
// On a tile of the hero's night (owner, 2026-11-01: "with that darker background", "stunning"):
// near black at the top going to the night's navy at the horizon, and a warm glow rising behind
// the disc as at daybreak - the hero in sixteen pixels.
const TILE =
  `<defs><linearGradient id="tabSky" x1="0" y1="-86" x2="0" y2="102" gradientUnits="userSpaceOnUse">` +
  `<stop offset="0" stop-color="#03050B"/><stop offset="0.6" stop-color="#0E1526"/><stop offset="1" stop-color="#1A2445"/></linearGradient>` +
  `<radialGradient id="tabDawn" cx="0" cy="18" r="92" gradientUnits="userSpaceOnUse">` +
  `<stop offset="0" stop-color="#F4B860" stop-opacity="0.42"/><stop offset="0.45" stop-color="#E9A23B" stop-opacity="0.14"/><stop offset="1" stop-color="#E9A23B" stop-opacity="0"/></radialGradient></defs>` +
  `<rect x="-94" y="-86" width="188" height="188" rx="42" fill="url(#tabSky)"/>` +
  `<rect x="-94" y="-86" width="188" height="188" rx="42" fill="url(#tabDawn)"/>`;
const icon = logo.replace(/viewBox="[^"]+"/, `viewBox="${CROP}"`).replace(/(<svg\b[^>]*>)/, `$1${TILE}`);
if (!icon.includes(`viewBox="${CROP}"`) || !icon.includes(TILE)) throw new Error("The logo has no viewBox to crop or no svg tag to tile");
writeFileSync(join(root, "public/appolino-tab.svg"), icon);
console.log(`public/appolino-tab.svg written, viewBox ${CROP}`);

// The browser tab's icon: the logo's mark alone - its dome and bar, the paths of the owner's logo
// file (src/assets/appolino-logo.svg) unchanged, in its own navy, on no background (owner,
// 2026-11-08: "jen to logo, ideálně v té tmavěmodré"). Nothing is redrawn: run this again
// whenever the logo changes. The file has a new name from the old sun's (appolino-tab.svg) so
// browsers holding that one cached fetch this. Usage: node scripts/tab-icon.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logo = readFileSync(join(root, "src/assets/appolino-logo.svg"), "utf8");
// The logo's paths are the name, then the bar, then the dome: the mark is the last two.
const paths = logo.match(/<path [^>]+\/>/g);
if (!paths || paths.length !== 3) throw new Error("Expected the logo's three paths: name, bar, dome");
const mark = paths.slice(1).join("");
// The mark spans x 0 to 102.5, y 13.5 to 81.5: a square round its middle, as wide as the mark.
const S = 103;
const X = 51.25 - S / 2;
const Y = 47.5 - S / 2;
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${X} ${Y} ${S} ${S}">${mark}</svg>\n`;
writeFileSync(join(root, "public/appolino-icon.svg"), icon);
console.log(`public/appolino-icon.svg written, viewBox ${X} ${Y} ${S} ${S}`);

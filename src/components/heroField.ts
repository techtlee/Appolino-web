/**
 * The hero's sky, a planetarium: the real stars (Hipparcos, to magnitude 6.0)
 * projected as a dome projects them - north up, east to the left - turning
 * about the celestial pole as the sun turns (sunTurn), so constellations rise
 * on the left and set on the right and the whole sky comes by in a few
 * minutes, over an even grain of fainter ones and no Milky Way. At rest a
 * figure is only its stars, brighter than the rest, each with a camera's
 * glint; the pointer on one draws its lines, thin and white, star to star, and
 * once its dots are joined a faint drawing of what it pictures - the hunter,
 * the swan, the bear - comes in, pinned to its own stars (James Hedberg's
 * constellation art for OpenSpace, credited in the footer), with its
 * caption. Now and then a falling star, and a slower one writing a wish.
 */
import { ART, FIELD, SKY, type SkyFigure } from "./skyData";
import { pageLang } from "../i18n";
import { sunTurn } from "./sunTurn";

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const GOLD = "242, 196, 106";
/** The warmth a figure's stars are lifted toward at rest. */
const WARM = "255, 214, 150";
/** Below this the hero has no room beside its headline. */
const WIDE = 1100;
/** The headline's width, which the wishes' lanes stand clear of. */
const TEXT = 760;
/** Where the dome looks: south from Czechia, about 50 degrees north, 62
 *  degrees up - declination 22 at the middle of the hero, the celestial
 *  pole above its top edge. */
const DEC_C = 22;
const LAT = 50;
/** The right ascension on the meridian when the page opens: the sky over
 *  Czechia as it stands at sunrise today, since the hero's sun is on the
 *  horizon - in November the Lion high in the south-east and Orion going
 *  down in the west; in May, the Swan and the Eagle. The sun's place comes
 *  from the date (its longitude along the ecliptic, a turn a year from the
 *  March equinox) and sunrise from the latitude: right to a degree or two,
 *  which is less than the width of the Moon. */
function sunriseMeridian(now: Date): number {
  const days = (now.getTime() - Date.UTC(now.getUTCFullYear(), 2, 20, 12)) / 86400000;
  const lon = ((days / 365.2422) * 360) * RAD;
  const tilt = 23.44 * RAD;
  const ra = Math.atan2(Math.cos(tilt) * Math.sin(lon), Math.cos(lon));
  const dec = Math.asin(Math.sin(tilt) * Math.sin(lon));
  const rise = Math.acos(Math.max(-1, Math.min(1, -Math.tan(LAT * RAD) * Math.tan(dec))));
  return ((((ra - rise) / RAD) % 360) + 360) % 360;
}
const RA_START = sunriseMeridian(new Date());
/** Degrees the dome turns for each radian the sun does. The sky turns as
 *  the real one does - about the pole, east (left) to west (right) as the
 *  sun turns on, back as it is dragged back - and one full turn of the sun
 *  turns it a quarter, 90 degrees: six hours of the night, or the same hour
 *  three months on, so four turns bring the four seasons round. */
const DOME = 90 / TAU;
/** The pole of the view - the headline's middle - as a share of the height. */
const POLE_Y = 0.45;
/** How far the nearest stars shift as the pointer crosses the hero. */
const SHIFT_X = 6;
const SHIFT_Y = 4;
/** How close the pointer must come to a figure to draw it, and how far it
 *  may then wander before the figure lets go. */
const REACH = 40;
const HOLD = 90;
/** Seconds per line as a figure draws, and at most for all of its lines -
 *  the Twins have sixteen, and their picture would keep the visitor
 *  waiting - and for its illustration to come. */
const LINE_S = 0.36;
const LINES_MAX_S = 4;
const ART_S = 1.8;
/** Seconds before anything answers the pointer, while the headline arrives. */
const FIRST = 1.4;
/** The sky fades into the dawn over this last share of the hero. */
const DAWN = 0.2;
/** The headline's clear sky: how much the dome is dimmed round the words. */
const CLEAR = 0.5;

/** What a slow falling star writes as it passes: the wishes everyone who
 *  lives in spreadsheets makes, in their own everyday words (the owner's
 *  examples first) - and each one something appolino really does. */
const WISHES = [
  "I wish the Monday report would build itself.",
  "I wish I knew where this number came from.",
  "I wish I didn't do the same thing every month.",
  "I wish the files would come in by themselves.",
  "I wish I never had to copy and paste again.",
  "I wish the spreadsheet would not be broken all the time.",
  "I wish I knew who changed this cell.",
];
/** The same wishes as a Czech team makes them. */
const WISHES_CS = [
  "Kéž by se pondělní report udělal sám.",
  "Kéž bych věděl, odkud se to číslo vzalo.",
  "Kéž bych nemusel každý měsíc dělat totéž.",
  "Kéž by soubory chodily samy.",
  "Kéž bych už nikdy nemusel kopírovat a vkládat.",
  "Kéž by ta tabulka pořád nebyla rozbitá.",
  "Kéž bych věděl, kdo změnil tuhle buňku.",
];
const COMET_FIRST = 8.5;
const COMET_GAP: [number, number] = [14, 22];
/** The wishing star falls as a slow real one does (pixels a second on a laptop's hero), and its
 *  wish is its trail (owner, 2026-11-01: "appears and disappears like the star is falling"):
 *  each letter lights as the star passes and is gone a couple of seconds later, so the line
 *  is written and fades from its start while the star is still writing its end - slow enough
 *  that the eye following the star reads it. */
const COMET_SPEED = 180;
const LETTER_IN = 0.12;
const LETTER_HOLD = 1.5;
const LETTER_OUT = 0.9;

/** A point of the sky: where it is, worked out once (the sines and cosines
 *  the projection needs), and where it fell on the hero this frame. */
type Pt = { sd: number; cd: number; sr: number; cr: number; x: number; y: number; on: boolean };
type Dot = Pt & { r: number; a: number; ink: string; tw: number; sp: number; ph: number; z: number };
type Fig = {
  sky: Asterism;
  stars: Dot[];
  /** The points of the sky its drawing is pinned to (its art's anchors). */
  mesh: Pt[];
  box: { x0: number; y0: number; x1: number; y1: number };
  seen: boolean;
  /** Its middle and a point a little north of it, or its feet and its head (HEAD_UP): where
   *  the figure's own up points on the screen. */
  probe: [Pt, Pt];
  /** Standing within sixty degrees of upright on the screen, so its drawing can be shown. */
  up: boolean;
  fade: number;
  draw: number;
  art: number;
};
/** A figure's drawing, decoded, and the pattern its triangles are filled
 *  with. */
type Art = { bitmap: ImageBitmap; pattern: CanvasPattern };
type View = { cx: number; cy: number; R: number; sd1: number; cd1: number; sr0: number; cr0: number };
type Meteor = { x: number; y: number; x0: number; y0: number; vx: number; vy: number; age: number; life: number; flare: boolean; green: boolean; fire: boolean };
type Comet = { x0: number; y0: number; ux: number; uy: number; len: number; age: number; chars: string[]; at: number[]; size: number };
type Fonts = { sans: string; serif: string; mono: string };

/** The shapes everyone knows, each drawn true from its stars (right
 *  ascension and declination in degrees, magnitude, B-V) where the dome
 *  puts them: they rise, cross and set with the turning sky, so a visitor
 *  who turns the sun a good way sees another season's sky - Orion in
 *  winter, the Lion in spring, the Swan in summer, Cassiopeia in autumn,
 *  the two Dippers round the pole; with its Czech name, and the picture of
 *  what it is (ART, the whole constellation each shape belongs to). The
 *  rest come whole from Stellarium's western sky (SKY), each standing well
 *  clear of every other figure (scripts/sky-data.mjs): the Twins after
 *  Orion, the Herdsman after the Bear, the Scorpion low in the south, the
 *  Eagle below the Swan, Andromeda beside Cassiopeia. */
type Asterism = SkyFigure;
/** The figures the sky itself holds head-down or on their side, as seen from Europe with north
 *  up: Pegasus flies upside down, his legs to the north and his back to the south; Andromeda's
 *  head is Alpheratz, south-west of her feet at Almach; Virgo lies along the ecliptic with her
 *  head to the west. For them "upright" is their feet-to-head line pointing up the screen, not
 *  north (owner, 2026-11-01: "why is Pegasus not head on top - Virgo, Andromeda the same"), so
 *  their drawing shows only while the turning sky holds them head-up, and otherwise they are
 *  their stars alone. Each is RA and Dec of a foot star, then of a head star (J2000): η Peg to
 *  α Peg, γ And to α And, μ Vir to ν Vir. */
const HEAD_UP: Record<string, [number, number, number, number]> = {
  Peg: [340.75, 30.22, 346.19, 15.21],
  And: [30.97, 42.33, 2.1, 29.09],
  Vir: [220.77, -5.66, 176.46, 6.53],
};
const NO_ART: SkyFigure["art"] = { file: "", w: 0, h: 0, cols: 0, anchors: [] };
const ASTERISMS: Asterism[] = [
  {
    id: "UMa", name: "Big Dipper", sub: "Velký vůz", bright: [],
    // Dubhe, Merak, Phecda, Megrez, Alioth, Mizar, Alkaid.
    stars: [165.93, 61.75, 1.79, 1.07, 165.46, 56.38, 2.37, 0.03, 178.46, 53.69, 2.44, 0.04, 183.86, 57.03, 3.31, 0.08, 193.51, 55.96, 1.77, -0.02, 200.98, 54.93, 2.27, 0.02, 206.88, 49.31, 1.86, -0.1],
    lines: [0, 1, 1, 2, 2, 3, 3, 0, 3, 4, 4, 5, 5, 6],
    art: ART.UMa ?? NO_ART,
  },
  {
    id: "UMi", name: "Little Dipper", sub: "Malý vůz", bright: [],
    // Polaris, Yildun, epsilon, zeta, eta, Pherkad, Kochab.
    stars: [37.95, 89.26, 1.98, 0.6, 263.05, 86.59, 4.36, 0.02, 251.49, 82.04, 4.21, 0.89, 236.01, 77.79, 4.32, 0.04, 244.38, 75.76, 4.95, 0.37, 230.18, 71.83, 3.0, 0.06, 222.68, 74.16, 2.08, 1.47],
    lines: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 3],
    art: ART.UMi ?? NO_ART,
  },
  {
    id: "Cas", name: "Cassiopeia", sub: "Kasiopeja", bright: [],
    // Caph, Schedar, Navi, Ruchbah, Segin.
    stars: [2.29, 59.15, 2.27, 0.34, 10.13, 56.54, 2.24, 1.17, 14.18, 60.72, 2.47, -0.15, 21.45, 60.24, 2.68, 0.13, 28.6, 63.67, 3.37, -0.15],
    lines: [0, 1, 1, 2, 2, 3, 3, 4],
    art: ART.Cas ?? NO_ART,
  },
  {
    id: "Ori", name: "Orion", sub: "Orion", bright: [],
    // Betelgeuse, Rigel, Bellatrix, Mintaka, Alnilam, Alnitak, Saiph, Meissa.
    stars: [88.79, 7.41, 0.5, 1.85, 78.63, -8.2, 0.13, -0.03, 81.28, 6.35, 1.64, -0.22, 83.0, -0.3, 2.23, -0.22, 84.05, -1.2, 1.69, -0.18, 85.19, -1.94, 1.77, -0.2, 86.94, -9.67, 2.09, -0.17, 83.78, 9.93, 3.39, -0.16],
    lines: [7, 0, 7, 2, 0, 5, 2, 3, 3, 4, 4, 5, 5, 6, 3, 1],
    art: ART.Ori ?? NO_ART,
  },
  {
    id: "Leo", name: "Leo", sub: "Lev", bright: [],
    // Regulus, Denebola, Algieba, Zosma, Chertan, eta, Adhafera, mu, epsilon.
    stars: [152.09, 11.97, 1.36, -0.09, 177.26, 14.57, 2.14, 0.09, 154.99, 19.84, 2.01, 1.13, 168.53, 20.52, 2.56, 0.13, 168.56, 15.43, 3.33, -0.01, 151.83, 16.76, 3.48, -0.03, 154.17, 23.42, 3.43, 0.31, 148.19, 26.01, 3.88, 1.22, 146.46, 23.77, 2.97, 0.81],
    lines: [0, 5, 5, 2, 2, 6, 6, 7, 7, 8, 2, 3, 3, 1, 1, 4, 4, 0],
    art: ART.Leo ?? NO_ART,
  },
  {
    id: "Cyg", name: "Cygnus", sub: "Labuť", bright: [],
    // Deneb, Sadr, Albireo, delta, Gienah, zeta, iota, kappa.
    stars: [310.36, 45.28, 1.25, 0.09, 305.56, 40.26, 2.23, 0.67, 292.68, 27.96, 3.05, 1.09, 296.24, 45.13, 2.87, -0.03, 311.55, 33.97, 2.48, 1.02, 318.23, 30.23, 3.21, 0.99, 291.84, 51.73, 3.77, 0.15, 289.28, 53.37, 3.8, 0.96],
    lines: [0, 1, 1, 2, 1, 3, 3, 6, 6, 7, 1, 4, 4, 5],
    art: ART.Cyg ?? NO_ART,
  },
  ...SKY,
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function point(ra: number, dec: number): Pt {
  return { sd: Math.sin(dec * RAD), cd: Math.cos(dec * RAD), sr: Math.sin(ra * RAD), cr: Math.cos(ra * RAD), x: 0, y: 0, on: false };
}

/** A star's colour by its B-V index: blue-white to orange-red. */
function ink(bv: number): string {
  if (bv < 0) return "200, 218, 255";
  if (bv < 0.4) return "232, 238, 255";
  if (bv < 0.8) return "255, 244, 222";
  if (bv < 1.3) return "255, 216, 168";
  return "255, 186, 140";
}

/** A figure's star a shade warmer than the sky's: its colour a third of
 *  the way to WARM. */
function warmer(ink: string): string {
  const to = WARM.split(",").map(Number);
  return ink
    .split(",")
    .map((v, i) => Math.round(+v + (to[i] - +v) * 0.35))
    .join(", ");
}

/** Where a star sits, to a tenth of a degree, the way the catalogue rounds
 *  it - so a figure's star and the field's copy of it share a key. */
const spot = (ra: number, dec: number) => `${Math.round(Math.round(ra * 100) / 10)},${Math.round(Math.round(dec * 100) / 10)}`;

/** A star as the eye sees it: the brighter, the bigger and the steadier - a touch brighter
 *  than the eye would have it, as on a clear night far from town (owner, 2026-11-01: the
 *  other stars "a little brighter, stunning, breathtaking"). */
function dot(ra: number, dec: number, mag: number, bv: number, scale: number): Dot {
  return {
    ...point(ra, dec),
    r: clamp(2.75 - 0.42 * mag, 0.45, 2.95) * scale,
    a: clamp(1.22 - 0.14 * mag, 0.3, 1),
    ink: ink(bv),
    tw: mag > 3 ? rnd(0.15, 0.5) : 0.08,
    sp: rnd(0.5, 2.2),
    ph: Math.random() * TAU,
    z: clamp(1 - mag / 7, 0.2, 0.9),
  };
}

/** Where a point of the sky falls on the hero: stereographic, as a dome
 *  shows the sky, with north up and east to the left. */
function project(p: Pt, v: View) {
  const cosdl = p.cr * v.cr0 + p.sr * v.sr0;
  const sindl = p.sr * v.cr0 - p.cr * v.sr0;
  const cosc = v.sd1 * p.sd + v.cd1 * p.cd * cosdl;
  p.on = cosc > -0.2;
  if (!p.on) return;
  const k = (2 * v.R) / (1 + cosc);
  p.x = v.cx - k * p.cd * sindl;
  p.y = v.cy - k * (v.cd1 * p.sd - v.sd1 * p.cd * cosdl);
}

/** Deep space: the nebulae and galaxies a long exposure shows, each where it
 *  really is (right ascension and declination in degrees), its size in
 *  degrees, its colour - the red of glowing hydrogen, the blue of starlight
 *  on dust, a galaxy's old gold - and how strongly it shows. The eye alone
 *  sees only Andromeda and the Orion Nebula as smudges; the rest are there
 *  as a camera sees them, kept faint so they stay behind the stars. A
 *  galaxy is an ellipse: its axes' ratio and its tilt on the sky. */
type Deep = { ra: number; dec: number; size: number; tint: string; a: number; ratio?: number; tilt?: number; gal?: boolean };
const DEEP: Deep[] = [
  { ra: 83.8, dec: -5.4, size: 1.4, tint: "255, 120, 175", a: 0.26 }, // Orion Nebula, M42
  { ra: 84.5, dec: -3.5, size: 9, tint: "255, 90, 120", a: 0.05 }, // Barnard's Loop, round Orion
  { ra: 98.0, dec: 4.9, size: 1.5, tint: "255, 105, 125", a: 0.1 }, // Rosette Nebula
  { ra: 56.8, dec: 24.1, size: 1.5, tint: "140, 175, 255", a: 0.2 }, // Pleiades, their blue haze
  { ra: 60.2, dec: 36.4, size: 2.4, tint: "255, 105, 120", a: 0.09, ratio: 0.35, tilt: -35 }, // California Nebula
  { ra: 38.2, dec: 61.5, size: 2.2, tint: "255, 100, 125", a: 0.08 }, // Heart and Soul
  { ra: 10.7, dec: 41.3, size: 3.2, tint: "240, 222, 196", a: 0.22, ratio: 0.3, tilt: 38, gal: true }, // Andromeda Galaxy, M31
  { ra: 23.5, dec: 30.7, size: 1.0, tint: "205, 215, 245", a: 0.12, ratio: 0.62, tilt: 23, gal: true }, // Triangulum Galaxy, M33
  { ra: 314.7, dec: 44.3, size: 2.6, tint: "255, 95, 115", a: 0.11 }, // North America Nebula
  { ra: 312.8, dec: 30.7, size: 3.2, tint: "120, 205, 235", a: 0.07, ratio: 0.8 }, // Veil Nebula
  { ra: 270.9, dec: -24.4, size: 1.6, tint: "255, 120, 150", a: 0.12 }, // Lagoon Nebula, M8
  { ra: 148.9, dec: 69.1, size: 0.5, tint: "235, 220, 195", a: 0.08, ratio: 0.5, tilt: -30, gal: true }, // Bode's Galaxy, M81
  { ra: 130.1, dec: 19.7, size: 1.3, tint: "205, 218, 255", a: 0.12 }, // Beehive Cluster, M44
  { ra: 105.7, dec: -10.6, size: 2.2, tint: "255, 110, 135", a: 0.09, ratio: 0.55, tilt: 30 }, // Seagull Nebula
  { ra: 100.3, dec: 9.9, size: 1.2, tint: "150, 175, 255", a: 0.08 }, // Christmas Tree and Cone
];

/** A galaxy's light: a bright core, falling off softly - drawn once. */
function galaxySprite(rgb: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `rgba(${rgb}, 1)`);
  grad.addColorStop(0.08, `rgba(${rgb}, 0.75)`);
  grad.addColorStop(0.35, `rgba(${rgb}, 0.22)`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

/** A bright star as a camera catches it (the owner's reference, 2026-11-01): a white core, a
 *  soft halo, and four thin spikes - drawn once, stamped on every star of a figure. */
function glintSprite(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d")!;
  const halo = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  halo.addColorStop(0, "rgba(255, 255, 255, 1)");
  halo.addColorStop(0.06, "rgba(255, 255, 255, 0.95)");
  halo.addColorStop(0.18, "rgba(225, 235, 255, 0.32)");
  halo.addColorStop(0.45, "rgba(205, 220, 255, 0.07)");
  halo.addColorStop(1, "rgba(205, 220, 255, 0)");
  g.fillStyle = halo;
  g.fillRect(0, 0, 96, 96);
  for (const across of [true, false]) {
    const s = across ? g.createLinearGradient(0, 48, 96, 48) : g.createLinearGradient(48, 0, 48, 96);
    s.addColorStop(0, "rgba(255, 255, 255, 0)");
    s.addColorStop(0.5, "rgba(255, 255, 255, 0.85)");
    s.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.fillStyle = s;
    if (across) g.fillRect(0, 47.3, 96, 1.4);
    else g.fillRect(47.3, 0, 1.4, 96);
  }
  return c;
}

/** The sky's fine grain: the faint stars a long exposure shows past what the eye picks out,
 *  scattered evenly over the sphere and turning with it, in four strengths so each strength is
 *  one fill of many tiny squares a frame. Made up, the one part of the sky that is; every star
 *  that can be picked out is still a real one. */
const GRAIN_INK = ["rgba(255, 255, 255, 0.24)", "rgba(255, 255, 255, 0.38)", "rgba(240, 244, 255, 0.56)", "rgba(240, 244, 255, 0.8)"];
function grainOf(n: number): Pt[][] {
  const out: Pt[][] = GRAIN_INK.map(() => []);
  for (let i = 0; i < n; i++) {
    const b = Math.min(3, Math.floor(Math.pow(Math.random(), 2.2) * 4));
    out[b].push(point(Math.random() * 360, (Math.asin(2 * Math.random() - 1) * 180) / Math.PI));
  }
  return out;
}

/** A soft round glow in one colour, drawn once: a nebula's light, a star's warmth. */
function glowSprite(rgb: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `rgba(${rgb}, 1)`);
  grad.addColorStop(0.5, `rgba(${rgb}, 0.35)`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

/** How strongly the drawing shows at most: faint - its lines read as a
 *  little light on the sky, its fill only as a hint of the body, and the
 *  stars and their lines stay in front of it. */
const ART_ALPHA = 0.5;

/** The pixel-to-hero transform that puts three of a drawing's anchors -
 *  pixels i, j and k of `anchors`, four numbers each - on the points of the
 *  sky they are pinned to, where the dome has put them (`mesh`), written
 *  into PIN as a, b, c, d, e, f; false if one of them is off the dome. It
 *  runs for every triangle of a drawing every frame, so it makes nothing. */
const PIN = new Float64Array(6);
function pin(anchors: number[], mesh: Pt[], i: number, j: number, k: number): boolean {
  const p = mesh[i];
  const q = mesh[j];
  const r = mesh[k];
  if (!p.on || !q.on || !r.on) return false;
  const x1 = anchors[4 * i];
  const y1 = anchors[4 * i + 1];
  const x2 = anchors[4 * j];
  const y2 = anchors[4 * j + 1];
  const x3 = anchors[4 * k];
  const y3 = anchors[4 * k + 1];
  const det = x1 * (y2 - y3) - y1 * (x2 - x3) + (x2 * y3 - x3 * y2);
  if (Math.abs(det) < 1e-6) return false;
  // Cramer's rule, once for where x lands and once for y.
  PIN[0] = (p.x * (y2 - y3) - y1 * (q.x - r.x) + (q.x * y3 - r.x * y2)) / det;
  PIN[2] = (x1 * (q.x - r.x) - p.x * (x2 - x3) + (x2 * r.x - x3 * q.x)) / det;
  PIN[4] = (x1 * (y2 * r.x - y3 * q.x) - y1 * (x2 * r.x - x3 * q.x) + p.x * (x2 * y3 - x3 * y2)) / det;
  PIN[1] = (p.y * (y2 - y3) - y1 * (q.y - r.y) + (q.y * y3 - r.y * y2)) / det;
  PIN[3] = (x1 * (q.y - r.y) - p.y * (x2 - x3) + (x2 * r.y - x3 * q.y)) / det;
  PIN[5] = (x1 * (y2 * r.y - y3 * q.y) - y1 * (x2 * r.y - x3 * q.y) + p.y * (x2 * y3 - x3 * y2)) / det;
  return true;
}

/** The figure the pointer is nearest, if within reach of one. A figure whose
 *  middle is behind the headline is left in peace: its drawing and caption
 *  would lie over the words and buttons. */
function under(figs: Fig[], x: number, y: number, keep: { x0: number; y0: number; x1: number; y1: number } | null): Fig | null {
  let best: Fig | null = null;
  let bestScore = REACH;
  for (const f of figs) {
    if (!f.seen || !f.up) continue;
    const { box } = f;
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    if (keep && cx > keep.x0 && cx < keep.x1 && cy > keep.y0 && cy < keep.y1) continue;
    const edge = Math.hypot(Math.max(box.x0 - x, 0, x - box.x1), Math.max(box.y0 - y, 0, y - box.y1));
    const score = edge + Math.hypot(x - (box.x0 + box.x1) / 2, y - (box.y0 + box.y1) / 2) * 1e-3;
    if (score < bestScore) {
      best = f;
      bestScore = score;
    }
  }
  return best;
}

/** A colour ("r, g, b") at an alpha, as a CSS string made once for each
 *  colour and hundredth of alpha. The stars set their colour every frame,
 *  and a new string each time - some five thousand a frame, each handed to
 *  the canvas and kept by it - had the garbage collector stopping the page
 *  every two seconds. */
const INKS = new Map<string, string[]>();
function rgba(ink: string, a: number): string {
  let row = INKS.get(ink);
  if (!row) INKS.set(ink, (row = []));
  const k = Math.round(clamp(a, 0, 1) * 100);
  if (!row[k]) row[k] = `rgba(${ink}, ${k / 100})`;
  return row[k];
}

/** A bright star's halo in its ink, fading to nothing at its edge: drawn
 *  once per ink and stamped, where a gradient made every frame for every
 *  bright star was more garbage. */
const HALOS = new Map<string, HTMLCanvasElement>();
function halo(ink: string): HTMLCanvasElement {
  let c = HALOS.get(ink);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${ink}, 1)`);
    grad.addColorStop(1, `rgba(${ink}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    HALOS.set(ink, c);
  }
  return c;
}

/** A star: `lit` lifts it, `dim` (1 = as the sky has it) takes it down - its light and a little
 *  of its size, and the halo of a bright star with it. */
function drawDot(ctx: CanvasRenderingContext2D, d: Dot, sx: number, sy: number, time: number, lit: number, dim = 1) {
  const a = Math.min(1, (d.a * (1 - d.tw * (0.5 + 0.5 * Math.sin(time * d.sp + d.ph))) + lit * 0.3) * dim);
  const x = d.x + sx * d.z;
  const y = d.y + sy * d.z;
  const r = d.r * (1 + lit * 0.25) * (0.55 + 0.45 * dim);
  if (r < 0.75) {
    ctx.fillStyle = rgba(d.ink, a);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    return;
  }
  if (d.r > 1.6 && dim > 0.95) {
    ctx.globalAlpha = a * 0.42;
    ctx.drawImage(halo(d.ink), x - r * 6, y - r * 6, r * 12, r * 12);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = rgba(d.ink, a);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** A figure's star. The figures are made of the sky's brightest stars, so drawn as the sky has
 *  them they outshone everything (owner, 2026-11-01, more than once: "dim them, but still
 *  visible that they are constellations"). At rest each is taken down to some sixty per cent
 *  of its light, a little smaller and without its halo, kept apart from the field only by a
 *  warmer ink and the faintest warm glow (`rest`); while its figure is pointed at (`lit`, its
 *  fade) it comes back to the sky's own brightness - never above it - with a soft glint.
 *  Sprites, so nothing is made per frame. */
function drawFigureStar(ctx: CanvasRenderingContext2D, d: Dot, sx: number, sy: number, time: number, glow: HTMLCanvasElement, rest: number, lit: number, glint: HTMLCanvasElement) {
  const x = d.x + sx * d.z;
  const y = d.y + sy * d.z;
  const k = Math.min(1, lit);
  if (rest > 0.01) {
    const g = 3 + d.r * 2.5;
    ctx.globalAlpha = Math.min(1, 0.06 * rest);
    ctx.drawImage(glow, x - g, y - g, 2 * g, 2 * g);
  }
  if (k > 0.4) {
    const gs = 3 + d.r * 3;
    ctx.globalAlpha = Math.min(1, ((k - 0.4) / 0.6) * 0.25 * Math.min(1, 0.45 + d.r * 0.35));
    ctx.drawImage(glint, x - gs, y - gs, 2 * gs, 2 * gs);
  }
  ctx.globalAlpha = 1;
  drawDot(ctx, d, sx, sy, time, 0, 0.6 + 0.4 * k);
}

/** A figure's lines, only while it is pointed at: drawn star to star, thin
 *  and see-through, with a spark where the line has got to and a soft
 *  golden glow on every star it has joined (sprites: `gold`, `spark`). At
 *  rest a figure has no lines; its stars alone show it. */
function drawLines(ctx: CanvasRenderingContext2D, f: Fig, ox: number, oy: number, time: number, gold: HTMLCanvasElement, spark: HTMLCanvasElement) {
  if (f.fade < 0.01) return;
  const L = f.sky.lines;
  const n = L.length / 2;
  const progress = f.draw * n;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  const seg = (k: number, s: number) => {
    const a = f.stars[L[2 * k]];
    const b = f.stars[L[2 * k + 1]];
    if (!a.on || !b.on) return null;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const ga = a.r + 3.5;
    const gb = b.r + 3.5;
    if (d <= ga + gb) return null;
    const ux = (b.x - a.x) / d;
    const uy = (b.y - a.y) / d;
    const len = (d - ga - gb) * s;
    return [a.x + ux * ga, a.y + uy * ga, a.x + ux * (ga + len), a.y + uy * (ga + len)] as const;
  };
  let tip: readonly [number, number] | null = null;
  // White and clear, as in the owner's reference (2026-11-01): a faint wide glow, a soft line
  // and a bright hairline core.
  for (const [width, alpha] of [
    [4, 0.05],
    [1.4, 0.3],
    [0.7, 0.62],
  ] as const) {
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const s = clamp(progress - k, 0, 1);
      const p = s > 0 ? seg(k, s) : null;
      if (!p) continue;
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[2], p[3]);
      if (s < 1) tip = [p[2], p[3]];
    }
    ctx.strokeStyle = width < 1 ? rgba("255, 252, 246", alpha * f.fade * (0.88 + 0.12 * Math.sin(time * 2))) : rgba("225, 232, 250", alpha * f.fade);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.32 * f.fade;
  for (let k = 0; k < Math.min(n, Math.ceil(progress)); k++) {
    for (const i of [L[2 * k], L[2 * k + 1]]) {
      const s = f.stars[i];
      if (s.on) ctx.drawImage(gold, s.x - 9, s.y - 9, 18, 18);
    }
  }
  if (tip) {
    ctx.globalAlpha = 0.8 * f.fade;
    ctx.drawImage(spark, tip[0] - 8, tip[1] - 8, 16, 16);
  }
  ctx.restore();
}

/** The picture, once the figure's dots are joined: its drawing pinned to
 *  its stars, so it turns with them, coming in slowly and evenly - no wipe
 *  or flash - and going the same way when the pointer moves on. The dome
 *  bends a flat picture more than one transform can follow - over the Bear,
 *  one missed its stars by thirty pixels - so each cell of the drawing's
 *  mesh is put on the sky by itself, as two triangles, each pinned to its
 *  three anchors and filled with the picture as a pattern. Its light is
 *  added to the sky's, as a planetarium projector adds it, which also
 *  leaves no seam where two triangles meet. Every triangle sets the
 *  transform outright rather than saving and clipping: each save made the
 *  page a little garbage, and forty a frame had the collector stopping it
 *  every two seconds. `dpr` is the canvas's own scale, put back after. */
function drawArt(ctx: CanvasRenderingContext2D, f: Fig, art: Art | null | undefined, ox: number, oy: number, dpr: number) {
  if (!art || f.art < 0.01 || f.fade < 0.01) return;
  const { anchors, cols } = f.sky.art;
  const t = clamp(f.art * 1.2, 0, 1);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = ART_ALPHA * f.fade * t * t * (3 - 2 * t);
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = art.pattern;
  const triangle = (i: number, j: number, k: number) => {
    if (!pin(anchors, f.mesh, i, j, k)) return;
    ctx.setTransform(dpr * PIN[0], dpr * PIN[1], dpr * PIN[2], dpr * PIN[3], dpr * (PIN[4] + ox), dpr * (PIN[5] + oy));
    ctx.beginPath();
    ctx.moveTo(anchors[4 * i], anchors[4 * i + 1]);
    ctx.lineTo(anchors[4 * j], anchors[4 * j + 1]);
    ctx.lineTo(anchors[4 * k], anchors[4 * k + 1]);
    ctx.closePath();
    ctx.fill();
  };
  const row = cols + 1;
  for (let k = 0; k + row < f.mesh.length; k++) {
    if (k % row === cols) continue;
    triangle(k, k + 1, k + row + 1);
    triangle(k, k + row + 1, k + row);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingQuality = "low";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

type Box = { x0: number; y0: number; x1: number; y1: number };
/** The headline, eyebrow and buttons, where no caption may land. */
type Keep = Box | null;

/** Where a caption goes: under the figure, else over it, else beside it on
 *  the side away from the middle, else the other side - the first place
 *  that is on screen, above the dawn, below the bar and clear of the words
 *  and buttons (`keep`). A caption is some 180 by 40 pixels. */
function labelAt(f: Fig, ox: number, oy: number, w: number, h: number, keep: Keep): { x: number; y: number; align: CanvasTextAlign } {
  const mid = (f.box.x0 + f.box.x1) / 2 + ox;
  const y = (f.box.y0 + f.box.y1) / 2 + oy;
  const right = { x: f.box.x1 + ox + 26, y, align: "left" as CanvasTextAlign };
  const left = { x: f.box.x0 + ox - 26, y, align: "right" as CanvasTextAlign };
  const tries = [
    { x: mid, y: f.box.y1 + oy + 30, align: "center" as CanvasTextAlign },
    { x: mid, y: f.box.y0 + oy - 44, align: "center" as CanvasTextAlign },
    ...(mid >= w / 2 ? [right, left] : [left, right]),
  ];
  const fits = (t: (typeof tries)[number]) => {
    const x0 = t.align === "center" ? t.x - 90 : t.align === "left" ? t.x : t.x - 180;
    const b = { x0, y0: t.y - 18, x1: x0 + 180, y1: t.y + 26 };
    const onScreen = b.x0 > 8 && b.x1 < w - 8 && b.y0 > 72 && b.y1 < h * (1 - DAWN);
    const clear = !keep || b.x1 < keep.x0 || b.x0 > keep.x1 || b.y1 < keep.y0 || b.y0 > keep.y1;
    return onScreen && clear;
  };
  return tries.find(fits) ?? tries[0];
}

/** The caption, as an atlas sets one: the name in gold capitals and, when it
 *  differs, what it is called in Czech. */
function drawLabel(ctx: CanvasRenderingContext2D, f: Fig, ox: number, oy: number, w: number, h: number, fonts: Fonts, keep: Keep) {
  const a = f.fade * clamp((f.art - 0.15) / 0.5, 0, 1);
  if (a < 0.02) return;
  const { x, y, align } = labelAt(f, ox, oy, w, h, keep);
  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  ctx.textAlign = align;
  ctx.font = `500 15px ${fonts.serif}`;
  spaced.letterSpacing = "0.2em";
  ctx.fillStyle = rgba(GOLD, 0.95 * a);
  ctx.shadowColor = rgba(GOLD, 0.45 * a);
  ctx.shadowBlur = 10;
  // In the page's language: the English name over the Czech one, or the Czech one over the
  // English, read as the caption is drawn so a switch of language shows at once.
  const [main, second] = pageLang() === "cs" ? [f.sky.sub, f.sky.name] : [f.sky.name, f.sky.sub];
  ctx.fillText(main.toUpperCase(), x, y);
  ctx.shadowBlur = 0;
  if (second !== main) {
    ctx.font = `italic 400 14px ${fonts.serif}`;
    spaced.letterSpacing = "0.02em";
    ctx.fillStyle = rgba("226, 230, 240", 0.8 * a);
    ctx.fillText(second, x, y + 19);
  }
  spaced.letterSpacing = "0px";
}

/** How long a fireball's train hangs in the sky after it has gone, seconds. */
const TRAIN_S = 1.8;

/** A falling star as the eye sees one: there and gone in a third of a second
 *  to most of one, crossing 5 to 30 degrees of sky at 15 to 35 degrees a
 *  second, anywhere in the upper sky and always on its way down. It
 *  brightens as it goes deeper into the air and goes out at its brightest,
 *  often with a last flare; its head is white, a fast one touched with the
 *  green of burning magnesium, and its streak is short, since the air
 *  behind it glows only a moment. About one in seven is a fireball:
 *  brighter, slower, and leaving a faint train that hangs a while after. */
function launch(w: number, h: number, perDeg: number): Meteor {
  const fire = Math.random() < 0.15;
  const ang = rnd(20, 160) * RAD;
  const degS = fire ? rnd(10, 16) : rnd(15, 35);
  const x = rnd(0.06, 0.94) * w;
  const y = rnd(0.04, 0.38) * h;
  return {
    x,
    y,
    x0: x,
    y0: y,
    vx: Math.cos(ang) * degS * perDeg,
    vy: Math.sin(ang) * degS * perDeg,
    age: 0,
    life: fire ? rnd(1.1, 1.6) : rnd(0.3, 0.85),
    flare: Math.random() < 0.4,
    green: degS > 26 && Math.random() < 0.6,
    fire,
  };
}

/** How bright a falling star is at its age, 0 to 1: rising, a flare near the
 *  end for some, then out. */
function meteorLight(m: Meteor): number {
  const u = m.age / m.life;
  if (u >= 1) return 0;
  let a = Math.pow(u, 0.7) * (u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2);
  if (m.flare && u > 0.68 && u < 0.86) a += 0.55 * Math.sin(((u - 0.68) / 0.18) * Math.PI);
  return Math.min(1, a * (m.fire ? 1 : 0.85));
}

function drawMeteor(ctx: CanvasRenderingContext2D, m: Meteor, glow: HTMLCanvasElement) {
  const speed = Math.hypot(m.vx, m.vy);
  const ux = m.vx / speed;
  const uy = m.vy / speed;
  // A fireball's train: its whole path, faintly, lingering after it.
  if (m.fire) {
    const after = m.age - m.life;
    const ta = after < 0 ? 0.1 * Math.min(1, m.age / (m.life * 0.6)) : 0.1 * (1 - after / TRAIN_S);
    if (ta > 0.005) {
      ctx.strokeStyle = rgba("190, 210, 255", ta);
      ctx.lineWidth = 2.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(m.x0, m.y0);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
    }
  }
  const a = meteorLight(m);
  if (a <= 0.01) return;
  const len = Math.min(m.age * speed, speed * (m.fire ? 0.28 : 0.14));
  const tx = m.x - ux * len;
  const ty = m.y - uy * len;
  const head = m.green ? "215, 255, 225" : "255, 249, 236";
  const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
  g.addColorStop(0, rgba(head, a));
  g.addColorStop(0.3, rgba("200, 218, 255", 0.45 * a));
  g.addColorStop(1, "rgba(200, 218, 255, 0)");
  ctx.strokeStyle = g;
  ctx.lineWidth = m.fire ? 2.4 : 1.3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(m.x, m.y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  const r = m.fire ? 11 : 5;
  ctx.globalAlpha = 0.7 * a;
  ctx.drawImage(glow, m.x - r, m.y - r, 2 * r, 2 * r);
  ctx.globalAlpha = 1;
}

/** The k-th wishing star: it falls as a shooting star does, steeply, down
 *  one of the columns beside the headline, left to right so its sentence
 *  reads as it is written; on a narrow hero, more gently over the words. */
function comet(ctx: CanvasRenderingContext2D, w: number, h: number, k: number, serif: string, below: number | null): Comet {
  const size = w < WIDE ? 10 : 10.5;
  ctx.font = `italic 500 ${size}px ${serif}`;
  const wishes = pageLang() === "cs" ? WISHES_CS : WISHES;
  const chars = [...wishes[k % wishes.length]];
  const at: number[] = [];
  let s = 60;
  for (const ch of chars) {
    at.push(s);
    s += ctx.measureText(ch).width + size * 0.04;
  }
  const len = s + 50;
  if (w < WIDE) {
    const ang = rnd(10, 16) * RAD;
    // On a narrow hero the sky above the words belongs to the figures; the wish falls in the
    // open sky under the buttons, above the sun.
    return { x0: Math.max(8, (w - len * Math.cos(ang)) / 2), y0: below !== null ? Math.min(h * 0.78, below + 34) : Math.max(84, h * 0.09), ux: Math.cos(ang), uy: Math.sin(ang), len, age: 0, chars, at, size };
  }
  const side = (w - TEXT) / 2 + 60;
  const ang = Math.max(rnd(28, 36), Math.acos(Math.min(1, (side - 24) / len)) / RAD) * RAD;
  const reach = len * Math.cos(ang);
  const x0 = k % 2 === 0 ? rnd(12, Math.max(12, side - reach - 12)) : w - side + rnd(12, Math.max(12, side - reach - 12));
  return { x0, y0: rnd(0.1, 0.24) * h, ux: Math.cos(ang), uy: Math.sin(ang), len, age: 0, chars, at, size };
}

const fallen = (c: Comet) => c.age * COMET_SPEED;
/** Seconds since the star passed a letter. */
const since = (c: Comet, i: number) => (fallen(c) - c.at[i]) / COMET_SPEED;
const spent = (c: Comet) => since(c, c.at.length - 1) > LETTER_IN + LETTER_HOLD + LETTER_OUT;

/** The wishing star itself, as a real falling star looks: a white head and a
 *  short streak - the air glows only a moment behind it - brightening as it
 *  goes and gone at the end of its path. */
function drawComet(ctx: CanvasRenderingContext2D, c: Comet, glow: HTMLCanvasElement) {
  const d = fallen(c);
  if (d > c.len) return;
  const u = d / c.len;
  const a = Math.min(1, 0.35 + u * 0.9) * (u < 0.9 ? 1 : 1 - (u - 0.9) / 0.1);
  const hx = c.x0 + c.ux * d;
  const hy = c.y0 + c.uy * d;
  const tail = Math.min(COMET_SPEED * 0.22, d);
  const g = ctx.createLinearGradient(hx, hy, hx - c.ux * tail, hy - c.uy * tail);
  g.addColorStop(0, rgba("255, 249, 236", a));
  g.addColorStop(0.3, rgba("200, 218, 255", 0.4 * a));
  g.addColorStop(1, "rgba(200, 218, 255, 0)");
  ctx.strokeStyle = g;
  ctx.lineCap = "round";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx - c.ux * tail, hy - c.uy * tail);
  ctx.stroke();
  ctx.globalAlpha = 0.7 * a;
  ctx.drawImage(glow, hx - 6, hy - 6, 12, 12);
  ctx.globalAlpha = 1;
}

/** The wish, letter by letter along the star's fall, in the captions' serif: each letter
 *  comes in warm as the star passes, holds a moment and fades, as the star's own trail. */
function drawWish(ctx: CanvasRenderingContext2D, c: Comet, fonts: Fonts) {
  ctx.save();
  ctx.translate(c.x0, c.y0);
  ctx.rotate(Math.atan2(c.uy, c.ux));
  ctx.font = `italic 500 ${c.size}px ${fonts.serif}`;
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(244, 196, 106, 0.5)";
  c.chars.forEach((ch, i) => {
    const s = since(c, i);
    const a = s < 0 ? 0 : s < LETTER_IN ? s / LETTER_IN : s < LETTER_IN + LETTER_HOLD ? 1 : clamp(1 - (s - LETTER_IN - LETTER_HOLD) / LETTER_OUT, 0, 1);
    if (a < 0.02) return;
    // Fresh from the star a letter glows a moment; settled, it is plain light.
    ctx.shadowBlur = s < 0.4 ? 8 * (1 - s / 0.4) : 0;
    ctx.fillStyle = rgba(s < 0.3 ? "255, 238, 204" : "232, 228, 216", 0.82 * a);
    ctx.fillText(ch, c.at[i], c.size + 7);
  });
  ctx.restore();
}

/** Starts the sky on `canvas`, listening for the pointer on `host`; returns
 *  the stop. Still is drawn once - the winter sky, its figures' stars
 *  lifted - and never animated. */
export function runField(canvas: HTMLCanvasElement, host: HTMLElement, still: boolean): () => void {
  const ctx = canvas.getContext("2d")!;
  const css = getComputedStyle(canvas);
  const fonts: Fonts = {
    sans: css.fontFamily,
    serif: '"Cormorant Garamond", "Cormorant", "Trajan Pro", Georgia, "Times New Roman", serif',
    mono: css.getPropertyValue("--mono").trim() || "ui-monospace, monospace",
  };
  // The glows of a figure's stars at rest, of the stars its lines have
  // joined, and of the spark drawing them.
  const warm = glowSprite(WARM);
  const gold = glowSprite(GOLD);
  const spark = glowSprite("255, 246, 225");
  const glint = glintSprite();
  const deep = DEEP.map((o) => ({ ...o, ...point(o.ra, o.dec), sprite: o.gal ? galaxySprite(o.tint) : glowSprite(o.tint) }));
  /** Each figure's drawing as fetched, and as decoded while it is wanted
   *  (null while it decodes). */
  const blobs = new Map<string, Promise<Blob>>();
  const arts = new Map<string, Art | null>();
  const failed = new Set<string>();
  let stopped = false;
  let dpr = 1;
  const ptr = { x: 0, y: 0, in: false };
  const tilt = { x: 0, y: 0 };
  let w = 0;
  let h = 0;
  let view: View = { cx: 0, cy: 0, R: 1, sd1: 0, cd1: 1, sr0: 0, cr0: 1 };
  let field: Dot[] = [];
  let grain: Pt[][] = [];
  let figs: Fig[] = [];
  let meteor: Meteor | null = null;
  let nextMeteor = rnd(4, 7);
  let wishing: Comet | null = null;
  let nextComet = COMET_FIRST;
  let comets = 0;
  let held: Fig | null = null;
  let keep: Keep = null;
  /** How far the figures' stars are lifted: they come forward while the
   *  visitor drags the sun round, and settle a moment after. */
  let shown = 0;
  let raf = 0;
  let last = 0;
  let time = 0;
  let visible = true;
  let asleep = false;

  // The drawings are made ready to draw when the site is built
  // (scripts/sky-art.mjs), never here: preparing them on this thread froze
  // the page just as the visitor began pointing at the sky. Their files come
  // once the page has settled, on a hero wide enough for the figures; each
  // is decoded only when its figure is pointed at - off this thread, by
  // createImageBitmap, while the lines take their seconds to draw - and let
  // go once its picture has faded. Holding every decoded picture at once
  // set the garbage collector off every few seconds, and each pass froze
  // the page, the first for half a second. A drawing that fails to come
  // leaves its figure its lines and caption.
  const blobOf = (s: Asterism) => {
    let b = blobs.get(s.id);
    if (!b) {
      b = fetch(`${import.meta.env.BASE_URL}${s.art.file}`).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))));
      blobs.set(s.id, b);
      b.catch(() => blobs.delete(s.id));
    }
    return b;
  };
  const wantArt = (f: Fig) => {
    const id = f.sky.id;
    if (still || !f.sky.art.file || arts.has(id) || failed.has(id)) return;
    arts.set(id, null);
    blobOf(f.sky)
      .then((b) => createImageBitmap(b))
      .then((bitmap) => {
        if (stopped || arts.get(id) !== null) return bitmap.close();
        const pattern = ctx.createPattern(bitmap, "no-repeat");
        if (pattern) arts.set(id, { bitmap, pattern });
        else {
          bitmap.close();
          arts.delete(id);
        }
      })
      .catch(() => {
        arts.delete(id);
        failed.add(id);
      });
  };
  /** Let a figure's picture go once it has faded; one that failed may be
   *  tried again the next time the figure is pointed at, not every frame. */
  const dropArt = (id: string) => {
    failed.delete(id);
    if (!arts.has(id)) return;
    arts.get(id)?.bitmap.close();
    arts.delete(id);
  };
  const artTimer = window.setTimeout(() => {
    if (still || w < WIDE) return;
    for (const s of ASTERISMS) if (s.art.file) blobOf(s).catch(() => {});
  }, 2500);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = rect.width;
    h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = w < WIDE ? 0.85 : 1;
    // A wide field: more sky on the screen, each figure smaller in it.
    const fov = clamp(w / 10, 72, 140);
    view = { ...view, cx: w / 2, cy: h * POLE_Y, R: w / (4 * Math.tan((fov / 4) * RAD)) };
    const before = figs;
    // On a phone too: there the field is narrower, so each figure is larger,
    // its stars glow at rest, and a tap above or below the words draws it
    // (a figure behind the words stays still, as everywhere). Its drawing
    // is fetched only when tapped, not ahead.
    figs = ASTERISMS.map((sky) => {
      const was = before.find((f) => f.sky === sky);
      const stars: Dot[] = [];
      for (let i = 0; i < sky.stars.length; i += 4) {
        const d = dot(sky.stars[i], sky.stars[i + 1], sky.stars[i + 2], sky.stars[i + 3], scale);
        d.z = 0.5;
        d.ink = warmer(d.ink);
        stars.push(d);
      }
      // The points of the sky the picture is pinned to, from its anchors.
      const mesh: Pt[] = [];
      for (let i = 0; i < sky.art.anchors.length; i += 4) mesh.push(point(sky.art.anchors[i + 2], sky.art.anchors[i + 3]));
      // Its middle on the sphere (the mean of its stars as vectors, so a figure across 0h is
      // not averaged to the far side), and a point two degrees north of it.
      let vx = 0;
      let vy = 0;
      let dec = 0;
      for (let i = 0; i < sky.stars.length; i += 4) {
        vx += Math.cos(sky.stars[i] * RAD);
        vy += Math.sin(sky.stars[i] * RAD);
        dec += sky.stars[i + 1];
      }
      const ra = Math.atan2(vy, vx) / RAD;
      dec /= sky.stars.length / 4;
      // Up is north for most figures; for the few the sky holds head-down or on their side it
      // is their own feet-to-head line (HEAD_UP).
      const own = HEAD_UP[sky.id];
      const probe: [Pt, Pt] = own ? [point(own[0], own[1]), point(own[2], own[3])] : [point(ra, dec), point(ra, Math.min(dec + 2, 89.5))];
      return { sky, stars, mesh, box: { x0: 0, y0: 0, x1: 0, y1: 0 }, seen: false, probe, up: true, fade: was?.fade ?? 0, draw: was?.draw ?? 0, art: was?.art ?? 0 };
    });
    // Every star stays in the field, but where the figures show, a figure's
    // stars are its own to draw - warmer, glowing - and the field leaves
    // them out rather than draw each twice, a hair apart as the pointer
    // tilts the sky.
    const own = new Set<string>();
    for (const f of figs) for (let i = 0; i < f.sky.stars.length; i += 4) own.add(spot(f.sky.stars[i], f.sky.stars[i + 1]));
    // Every star that can be picked out is a real one, to magnitude 6 - a truly dark sky - and
    // under them the even grain of fainter ones. No Milky Way: its glowing band and its crowd
    // lit the background, and the owner wanted it darker (2026-11-01).
    field = [];
    for (let i = 0; i < FIELD.length; i += 4) if (!own.has(spot(FIELD[i], FIELD[i + 1]))) field.push(dot(FIELD[i], FIELD[i + 1], FIELD[i + 2], FIELD[i + 3], scale));
    // Some 22 000 over the whole sphere on a laptop, so about a third over the hero at once
    // (owner: "more stars, stunning"); fewer on a phone, whose sky is smaller.
    grain = grainOf(Math.round(clamp(w * 15, 8000, 24000)));
    // Where the eyebrow, the headline and the buttons stand, by layout and
    // with room round them: no caption may land there.
    // Every turning word too: the longer ones run on past the heading's box.
    const words = [...host.querySelectorAll<HTMLElement>(".eyebrow, h1, .turn-w, .lede, .ctas")].map((el) => el.getBoundingClientRect()).filter((b) => b.width);
    keep = words.length
      ? {
          x0: Math.min(...words.map((b) => b.left)) - rect.left - 24,
          y0: Math.min(...words.map((b) => b.top)) - rect.top - 16,
          x1: Math.max(...words.map((b) => b.right)) - rect.left + 24,
          y1: Math.max(...words.map((b) => b.bottom)) - rect.top + 16,
        }
      : null;
    fills();
  };

  /** The dome as the sun has turned it: every star and figure where it is.
   *  A figure is drawn from the part of it that is over the hero, so it
   *  comes in star by star over one edge and goes out over the other. */
  const turn = (ra: number) => {
    view = { ...view, sd1: Math.sin(DEC_C * RAD), cd1: Math.cos(DEC_C * RAD), sr0: Math.sin(ra * RAD), cr0: Math.cos(ra * RAD) };
    for (const d of field) project(d, view);
    for (const b of grain) for (const p of b) project(p, view);
    for (const o of deep) project(o, view);
    for (const f of figs) {
      const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      let on = 0;
      for (const s of f.stars) {
        project(s, view);
        if (!s.on) continue;
        on++;
        b.x0 = Math.min(b.x0, s.x);
        b.y0 = Math.min(b.y0, s.y);
        b.x1 = Math.max(b.x1, s.x);
        b.y1 = Math.max(b.y1, s.y);
      }
      f.box = b;
      f.seen = on >= 2 && b.x1 > -40 && b.x0 < w + 40 && b.y1 > -40 && b.y0 < h * (1 - DAWN * 0.5);
      // As the sky turns, a figure rising on the left leans one way and one setting on the
      // right the other, as the real ones do - up to some seventy degrees over two turns of the
      // sun, which reads as lying on its side or upside down. Its drawing is offered only while
      // it stands within sixty degrees of upright (its picture's top up the screen); leaning
      // further it is its stars alone until it comes round (owner, 2026-11-01: "aligned, not
      // upside down").
      const [c, n] = f.probe;
      project(c, view);
      project(n, view);
      const nx = n.x - c.x;
      const ny = n.y - c.y;
      f.up = !c.on || !n.on || -ny / (Math.hypot(nx, ny) || 1) > 0.5;
      // Only a figure on its way in or out shows its picture; its picture
      // follows its lines by seconds, so this frame's turn is ready for it.
      if (f.fade > 0) for (const a of f.mesh) project(a, view);
    }
  };

  /** The figure pointed at, held while the pointer stays near it. */
  const chosen = (ox: number, oy: number): Fig | null => {
    if (!ptr.in || sunTurn.over || sunTurn.held || time < FIRST) return (held = null);
    const x = ptr.x - ox;
    const y = ptr.y - oy;
    if (!held || !held.seen || !held.up || Math.hypot(Math.max(held.box.x0 - x, 0, x - held.box.x1), Math.max(held.box.y0 - y, 0, y - held.box.y1)) > HOLD) held = under(figs, x, y, keep);
    return held;
  };

  const step = (dt: number, ox: number, oy: number) => {
    time += dt;
    tilt.x += ((ptr.in ? (ptr.x / w) * 2 - 1 : 0) - tilt.x) * Math.min(1, dt * 1.2);
    tilt.y += ((ptr.in ? (ptr.y / h) * 2 - 1 : 0) - tilt.y) * Math.min(1, dt * 1.2);
    shown += ((sunTurn.held ? 1 : 0) - shown) * Math.min(1, dt * (sunTurn.held ? 3 : 0.8));
    const lit = chosen(ox, oy);
    // One picture at a time: the figure pointed at waits for any other's to
    // have gone, and for its own to be decoded, before its picture comes.
    const clear = !figs.some((g) => g !== lit && g.fade > 0.01 && g.art > 0.01);
    for (const f of figs) {
      const on = f === lit;
      if (on) wantArt(f);
      f.fade = on ? Math.min(1, f.fade + dt * 1.4) : Math.max(0, f.fade - dt * 0.7);
      if (on && f.draw < 1) f.draw = Math.min(1, f.draw + dt / Math.min(LINES_MAX_S, LINE_S * (f.sky.lines.length / 2)));
      else if (on && clear && arts.get(f.sky.id)) f.art = Math.min(1, f.art + dt / ART_S);
      else if (f.fade === 0) {
        f.draw = f.art = 0;
        dropArt(f.sky.id);
      }
    }
    nextComet -= dt;
    // A wish waits while a figure is shown, so the two never write over each other.
    if (!wishing && nextComet <= 0 && !figs.some((f) => f.fade > 0.01)) wishing = comet(ctx, w, h, comets++, fonts.serif, keep ? keep.y1 : null);
    if (wishing) {
      wishing.age += dt;
      if (spent(wishing)) {
        wishing = null;
        nextComet = rnd(...COMET_GAP);
      }
    }
    nextMeteor -= dt;
    if (!meteor && !wishing && nextMeteor <= 0) {
      // Degrees of sky to pixels near the middle of the dome.
      meteor = launch(w, h, view.R * RAD);
      nextMeteor = rnd(18, 34);
    }
    if (meteor) {
      meteor.age += dt;
      if (meteor.age < meteor.life) {
        meteor.x += meteor.vx * dt;
        meteor.y += meteor.vy * dt;
      }
      if (meteor.age > meteor.life + (meteor.fire ? TRAIN_S : 0)) meteor = null;
    }
  };

  /** Deep space where it really is: each nebula and galaxy as a soft light,
   *  a galaxy drawn as its tilted ellipse, all behind the stars. */
  const drawDeep = (sx: number, sy: number) => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const perDeg = view.R * RAD;
    for (const o of deep) {
      const r = Math.max(6, o.size * perDeg);
      if (!o.on || o.x < -r || o.x > w + r || o.y < -r || o.y > h + r) continue;
      ctx.globalAlpha = Math.min(1, o.a * 1.35);
      const x = o.x + sx * 0.15;
      const y = o.y + sy * 0.15;
      if (o.ratio) {
        ctx.translate(x, y);
        ctx.rotate((o.tilt ?? 0) * RAD);
        ctx.drawImage(o.sprite, -r, -r * o.ratio, 2 * r, 2 * r * o.ratio);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else ctx.drawImage(o.sprite, x - r, y - r, 2 * r, 2 * r);
    }
    ctx.restore();
  };

  /** The fine grain, one path of tiny squares per strength - four fills a frame, however many
   *  thousand grains are over the hero. */
  const drawGrain = (gx: number, gy: number) => {
    const s = dpr > 1 ? 0.75 : 1;
    grain.forEach((b, i) => {
      ctx.beginPath();
      for (const p of b) {
        if (!p.on) continue;
        const x = p.x + gx;
        const y = p.y + gy;
        if (x > 0 && x < w && y > 0 && y < h) ctx.rect(x, y, s, s);
      }
      ctx.fillStyle = GRAIN_INK[i];
      ctx.fill();
    });
  };

  /** The headline's clear sky: the dome dimmed in a soft pool round it.
   *  Its gradient, and the dawn's, change only with the hero's size, so
   *  they are made then rather than every frame. */
  let pool: CanvasGradient | null = null;
  let dawnFill: CanvasGradient | null = null;
  const fills = () => {
    const r = Math.min(w * 0.34, 520);
    pool = ctx.createRadialGradient(view.cx, view.cy, 0, view.cx, view.cy, r);
    pool.addColorStop(0, `rgba(0, 0, 0, ${CLEAR})`);
    pool.addColorStop(0.55, `rgba(0, 0, 0, ${CLEAR * 0.6})`);
    pool.addColorStop(1, "rgba(0, 0, 0, 0)");
    dawnFill = ctx.createLinearGradient(0, h * (1 - DAWN), 0, h);
    dawnFill.addColorStop(0, "rgba(0, 0, 0, 0)");
    dawnFill.addColorStop(1, "rgba(0, 0, 0, 1)");
  };
  const clearPool = () => {
    if (!pool) return;
    const r = Math.min(w * 0.34, 520);
    ctx.save();
    ctx.translate(view.cx, view.cy);
    ctx.scale(1, 0.62);
    ctx.translate(-view.cx, -view.cy);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = pool;
    ctx.fillRect(view.cx - r, view.cy - r, 2 * r, 2 * r);
    ctx.restore();
  };

  /** The sky thins out into the dawn over the hero's last stretch. */
  const dawn = () => {
    if (!dawnFill) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = dawnFill;
    ctx.fillRect(0, h * (1 - DAWN), w, h * DAWN);
    ctx.globalCompositeOperation = "source-over";
  };

  const frame = (t: number) => {
    raf = 0;
    if (!still && scrollY >= innerHeight) {
      asleep = true;
      return;
    }
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    const sx = -tilt.x * SHIFT_X;
    const sy = -tilt.y * SHIFT_Y;
    const ox = sx * 0.5;
    const oy = sy * 0.5;
    turn(RA_START + (still ? 0 : DOME * sunTurn.angle));
    if (!still) step(dt, ox, oy);
    ctx.clearRect(0, 0, w, h);
    drawDeep(sx, sy);
    drawGrain(sx * 0.2, sy * 0.2);
    for (const d of field) if (d.on && d.x > -4 && d.x < w + 4 && d.y > -4 && d.y < h + 4) drawDot(ctx, d, sx, sy, time, 0);
    if (meteor) drawMeteor(ctx, meteor, spark);
    // The figures at rest are only their stars, a little brighter and
    // warmer than the rest, and more so while the visitor turns the sky by
    // the sun. They belong to the sky, so the clear pool round the headline
    // dims them with it.
    const lift = still ? 1 : 1 + 0.6 * shown;
    for (const f of figs) {
      if (!f.seen || f.fade >= 0.01) continue;
      for (const s of f.stars) if (s.on) drawFigureStar(ctx, s, sx, sy, time, warm, lift, 0.1 * lift, glint);
    }
    clearPool();
    if (wishing) {
      drawComet(ctx, wishing, spark);
      drawWish(ctx, wishing, fonts);
    }
    // The figure pointed at stands in front: its drawing, its lines, its
    // stars and its caption.
    for (const f of figs) {
      if (!f.seen || f.fade < 0.01) continue;
      if (!still) drawArt(ctx, f, arts.get(f.sky.id), ox, oy, dpr);
      drawLines(ctx, f, ox, oy, time, gold, spark);
      for (const s of f.stars) if (s.on) drawFigureStar(ctx, s, sx, sy, time, warm, lift * (1 - f.fade), Math.max(0.1 * lift, f.fade), glint);
      if (!still) drawLabel(ctx, f, ox, oy, w, h, fonts, keep);
    }
    dawn();
    if (visible && !still) raf = requestAnimationFrame(frame);
  };

  const run = () => {
    if (raf || still) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  };
  // A mouse points; a finger taps - and a tapped figure stays until the next tap.
  const move = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    ptr.x = e.clientX - rect.left;
    ptr.y = e.clientY - rect.top;
    ptr.in = true;
  };
  const leave = (e: PointerEvent) => {
    if (e.pointerType !== "touch") ptr.in = false;
  };
  const wake = () => {
    if (asleep && scrollY < innerHeight) {
      asleep = false;
      run();
    }
  };

  resize();
  frame(performance.now());

  const ro = new ResizeObserver(() => {
    resize();
    if (still) frame(performance.now());
  });
  ro.observe(canvas);
  const io = new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    if (visible) run();
  });
  io.observe(canvas);
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerdown", move);
  host.addEventListener("pointerleave", leave);
  addEventListener("scroll", wake, { passive: true });

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(artTimer);
    stopped = true;
    for (const a of arts.values()) a?.bitmap.close();
    ro.disconnect();
    io.disconnect();
    host.removeEventListener("pointermove", move);
    host.removeEventListener("pointerdown", move);
    host.removeEventListener("pointerleave", leave);
    removeEventListener("scroll", wake);
  };
}

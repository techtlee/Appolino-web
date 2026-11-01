/**
 * The sun rising behind the app window: one light, drawn as a camera sees
 * a low sun. An overexposed core of cream light, gold at the edge with the
 * faintest grain, a glowing limb and a soft bloom; a warm band of air along
 * the horizon and a glow up the sky; a few slow shafts of light through it;
 * embers rising out of the glow; and a line of light where the disc meets
 * the horizon. Everything moves slowly - the glow breathes, the shafts
 * sweep, the embers climb - and nothing is sharp but the horizon.
 *
 * Its turn is the sky's clock (sunTurn): the constellations over the hero
 * follow it, and a visitor can grab the sun and spin it to turn the sky;
 * the grain on the disc and the shafts are what show it turning.
 *
 * The canvas is 4R wide and 1.5R tall, its bottom edge the horizon; the
 * disc's centre sits below it so a dome of DOME radii stands above. Nothing
 * reaches further than REACH radii from the centre, so everything fades to
 * nothing before the canvas edge - the sides are 2R away, the top 1.9R.
 *
 * It is drawn every frame while the page scrolls under it, so it is kept
 * cheap: no shadow blur, the surface shaded at a fixed low resolution and
 * scaled up, and each soft shape laid down in few passes.
 */
import { sunTurn, TURN_S } from "./sunTurn";

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** How much of the disc stands above the horizon once risen, in radii: a
 *  heavy sun just clear of the line, the headline's buttons above it. */
const DOME = 0.6;
/** The furthest any light reaches from the disc's centre, in radii. */
const REACH = 1.8;
/** Surface pixels per CSS pixel. The grain is faint and the core light
 *  washes over it, so it is shaded coarse and scaled up: a fifth of the
 *  work of shading it sharp on a 1.5x screen. */
const SHADE = 0.66;

/** One light, from its white-hot core out to the ember at the horizon. */
const CORE = "255, 247, 226";
const CREAM = "255, 232, 184";
const GOLD = "255, 204, 118";
const AMBER = "247, 158, 64";
const EMBER = "236, 112, 52";
const rgba = (c: string, a: number) => `rgba(${c}, ${a})`;

/** The surface map: longitude across, latitude down, one texel about a
 *  third of a degree. */
const TW = 1024;
const TH = 512;
/** The axis leans away from us, so the dome above the horizon shows the
 *  sun's middle latitudes turning rather than its pole standing still. */
const TILT = (50 * Math.PI) / 180;
/** The turn when nobody touches it, in radians a second. */
const SPIN = TAU / TURN_S;

function hash(x: number, y: number, k: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(k, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise at (x, y) in cell units, wrapping every `period`
 *  cells across. */
function vnoise(x: number, y: number, period: number, k: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (i: number, j: number) => hash(((i % period) + period) % period, j, k);
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
  const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
  return top + (bot - top) * sy;
}

/** The same noise over the surface map, wrapping in longitude. */
function noise(u: number, v: number, cells: number, k: number): number {
  return vnoise((u / TW) * cells, (v / TH) * (cells / 2), cells, k);
}

/** Only these rows of the map ever face us: latitudes -58 to 48. */
const V0 = Math.floor((0.5 - 48 / 180) * TH);
const V1 = Math.ceil((0.5 + 58 / 180) * TH);

/** Granulation: bright cells parted by dark lanes, each cell a little
 *  brighter or dimmer than the next (distance to the nearest two of a
 *  jittered grid of points, wrapping in longitude). */
function granulate(base: Float32Array) {
  const GX = 400;
  const GY = 200;
  const cs = TW / GX;
  const px = new Float32Array(GX * GY);
  const py = new Float32Array(GX * GY);
  const pb = new Float32Array(GX * GY);
  for (let j = 0; j < GY; j++)
    for (let i = 0; i < GX; i++) {
      px[j * GX + i] = (i + hash(i, j, 1)) * cs;
      py[j * GX + i] = (j + hash(i, j, 2)) * cs;
      pb[j * GX + i] = 0.97 + 0.05 * hash(i, j, 3);
    }
  for (let v = V0; v < V1; v++) {
    const gy0 = Math.floor(v / cs);
    for (let u = 0; u < TW; u++) {
      const gx0 = Math.floor(u / cs);
      let f1 = Infinity;
      let f2 = Infinity;
      let b = 1;
      for (let dy = -1; dy <= 1; dy++) {
        const gy = gy0 + dy;
        if (gy < 0 || gy >= GY) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const g = gx0 + dx;
          const gx = (g + GX) % GX;
          const c = gy * GX + gx;
          const ddx = u - (px[c] + (g < 0 ? -TW : g >= GX ? TW : 0));
          const ddy = v - py[c];
          const d = ddx * ddx + ddy * ddy;
          if (d < f1) {
            f2 = f1;
            f1 = d;
            b = pb[c];
          } else if (d < f2) f2 = d;
        }
      }
      const lane = (Math.sqrt(f2) - Math.sqrt(f1)) / cs;
      // The broad mottle is what the eye follows round as the sun turns: a
      // touch stronger than a real sun's, so the turning is seen.
      const large = 0.95 + 0.08 * noise(u, v, 24, 9) + 0.03 * noise(u, v, 90, 11);
      base[v * TW + u] = b * large * (0.92 + 0.1 * smooth(0, 0.45, lane));
    }
  }
}

/** The sun's face: the granular mottle everywhere, and nothing else. */
function makeSurface(): Float32Array {
  const base = new Float32Array(TW * TH).fill(1);
  granulate(base);
  return base;
}

/** Brightness to colour: amber at the limb, gold across the middle, cream
 *  where it is brightest. The core light over it blows the centre out. */
const LUT = (() => {
  const stops: [number, [number, number, number]][] = [
    [0, [214, 116, 44]],
    [0.25, [232, 136, 54]],
    [0.45, [246, 169, 78]],
    [0.65, [255, 203, 120]],
    [0.85, [255, 228, 174]],
    [1.05, [255, 243, 214]],
    [1.28, [255, 249, 234]],
  ];
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const I = i / 200;
    let k = 0;
    while (k < stops.length - 2 && stops[k + 1][0] < I) k++;
    const [a, ca] = stops[k];
    const [b, cb] = stops[k + 1];
    const t = clamp((I - a) / (b - a), 0, 1);
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = ca[c] + (cb[c] - ca[c]) * t;
  }
  return lut;
})();

/** The upper half of the disc, worked out once per size: for every pixel
 *  where on the sphere it looks (longitude before the turn, the map row),
 *  how much the limb darkens it, and how much of the pixel the disc
 *  covers. */
type Disc = {
  s: number;
  W: number;
  H: number;
  img: HTMLCanvasElement;
  ictx: CanvasRenderingContext2D;
  data: ImageData;
  pix: Int32Array;
  lon: Float32Array;
  row: Int32Array;
  limb: Float32Array;
  alpha: Uint8Array;
  rowEnd: Int32Array;
};

function prepare(R: number, s: number): Disc {
  const W = Math.max(1, Math.ceil(2 * R * s));
  const H = Math.max(1, Math.ceil(R * s));
  const img = document.createElement("canvas");
  img.width = W;
  img.height = H;
  const ictx = img.getContext("2d")!;
  const max = W * H;
  const pix = new Int32Array(max);
  const lon = new Float32Array(max);
  const row = new Int32Array(max);
  const limb = new Float32Array(max);
  const alpha = new Uint8Array(max);
  const rowEnd = new Int32Array(H);
  const cosB = Math.cos(TILT);
  const sinB = Math.sin(TILT);
  let n = 0;
  for (let j = 0; j < H; j++) {
    const y = R - (j + 0.5) / s;
    for (let i = 0; i < W; i++) {
      const x = (i + 0.5) / s - R;
      const r2 = x * x + y * y;
      const cover = clamp((R - Math.sqrt(r2)) * s + 0.5, 0, 1);
      if (cover <= 0) continue;
      const z = Math.sqrt(Math.max(0, R * R - r2)) / R;
      const px = x / R;
      const py = y / R;
      const lat = Math.asin(clamp(py * cosB - z * sinB, -1, 1));
      const m = 1 - z;
      pix[n] = (j * W + i) * 4;
      lon[n] = Math.atan2(px, py * sinB + z * cosB);
      row[n] = clamp(Math.floor((0.5 - lat / Math.PI) * TH), V0, V1 - 1) * TW;
      limb[n] = 1 - 0.56 * m - 0.1 * m * m;
      alpha[n] = cover * 255;
      n++;
    }
    rowEnd[j] = n;
  }
  return { s, W, H, img, ictx, data: ictx.createImageData(W, H), pix, lon, row, limb, alpha, rowEnd };
}

/** The disc as turned to `angle`, its first `rows` rows - the ones above
 *  the horizon. */
function shade(d: Disc, base: Float32Array, angle: number, rows: number) {
  if (rows <= 0) return;
  const out = d.data.data;
  const k = TW / TAU;
  const end = d.rowEnd[Math.min(rows, d.H) - 1];
  for (let n = 0; n < end; n++) {
    let u = ((d.lon[n] - angle) * k) % TW;
    if (u < 0) u += TW;
    const t = d.row[n] + (u | 0);
    // A little brighter than the limb law alone: the dome above the horizon
    // is all near the edge, and it must still read as gold there.
    const c = (base[t] * d.limb[n] * 215) | 0;
    const li = (c > 255 ? 255 : c < 0 ? 0 : c) * 3;
    const p = d.pix[n];
    out[p] = LUT[li];
    out[p + 1] = LUT[li + 1];
    out[p + 2] = LUT[li + 2];
    out[p + 3] = d.alpha[n];
  }
  d.ictx.putImageData(d.data, 0, 0, 0, 0, d.W, Math.min(rows, d.H));
}

/** The air the sun lights: a warm band along the horizon, a wide
 *  glow up the sky that breathes, and the corona hugging the disc. The
 *  band and the glow come up with the dawn (`up`), the corona with the
 *  disc (`rise`). */
function atmosphere(ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number, R: number, t: number, up: number, rise: number) {
  ctx.save();
  ctx.translate(cx, h);
  ctx.scale(R * 1.95, R * 0.75);
  const band = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  band.addColorStop(0, rgba(AMBER, 0.3 * up));
  band.addColorStop(0.35, rgba(AMBER, 0.12 * up));
  band.addColorStop(0.7, rgba(EMBER, 0.04 * up));
  band.addColorStop(1, rgba(EMBER, 0));
  ctx.fillStyle = band;
  ctx.fillRect(-1, -1, 2, 1);
  ctx.restore();

  const out = R * (REACH - 0.05 + 0.05 * Math.sin(t * 0.5));
  const glow = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, out);
  glow.addColorStop(0, rgba(GOLD, 0.36 * up));
  glow.addColorStop(0.18, rgba(GOLD, 0.22 * up));
  glow.addColorStop(0.38, rgba(AMBER, 0.11 * up));
  glow.addColorStop(0.62, rgba(AMBER, 0.045 * up));
  glow.addColorStop(0.85, rgba(EMBER, 0.015 * up));
  glow.addColorStop(1, rgba(EMBER, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, out, 0, TAU);
  ctx.fill();

  const corona = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.4);
  corona.addColorStop(0, rgba(GOLD, 0.45 * rise));
  corona.addColorStop(0.25, rgba(GOLD, 0.2 * rise));
  corona.addColorStop(0.6, rgba(AMBER, 0.06 * rise));
  corona.addColorStop(1, rgba(AMBER, 0));
  ctx.fillStyle = corona;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.4, 0, TAU);
  ctx.fill();
}

/** Shafts of light through the air: wide, faint wedges fanning out from
 *  the disc all round it, of which only those above the horizon show. The
 *  fan turns with the sun, turn for turn - the owner wanted the turning
 *  plainly seen - so the shafts sweep as it spins and swing with it when a
 *  visitor drags it, rising
 *  on one side and setting on the other; and each one's light follows the
 *  turn too, as the brighter face of the sun comes round to it. Each is
 *  laid down three times, narrower each time at a third of its light, so
 *  its edges are soft without a filter. */
function shafts(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, turn: number, t: number, up: number) {
  if (up <= 0) return;
  const N = 18;
  ctx.globalAlpha = 1 / 3;
  for (let i = 0; i < N; i++) {
    const th = ((i + 0.5) / N) * TAU + turn + 0.06 * Math.sin(t * 0.07 + i * 2.3);
    if (Math.sin(th) > 0.15) continue;
    const half = 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(i * 2.7 + 1));
    const len = R * (REACH - 0.5 + 0.45 * (0.5 + 0.5 * Math.sin(i * 1.9 + t * 0.11)));
    const a = up * 0.09 * (0.5 + 0.5 * Math.sin(turn * 2 + i * 1.7 + t * 0.1));
    const g = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, len);
    g.addColorStop(0, rgba(CREAM, a));
    g.addColorStop(0.35, rgba(GOLD, a * 0.6));
    g.addColorStop(1, rgba(AMBER, 0));
    ctx.fillStyle = g;
    for (const k of [1, 0.62, 0.3]) {
      const s = half * k;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, len, th - s, th + s);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Over the disc: the core light that blows its centre out, clipped to
 *  it, and then the limb as a glowing edge rather than a line. Leaves the
 *  context adding light. */
function discLight(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, rise: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.clip();
  const g = ctx.createRadialGradient(cx, cy - R * 0.08, 0, cx, cy - R * 0.08, R);
  g.addColorStop(0, rgba(CORE, 0.95 * rise));
  g.addColorStop(0.45, rgba(CORE, 0.8 * rise));
  g.addColorStop(0.75, rgba(CREAM, 0.35 * rise));
  g.addColorStop(0.95, rgba(GOLD, 0.05 * rise));
  g.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - R, cy - R, 2 * R, R);
  ctx.restore();
  ctx.globalCompositeOperation = "lighter";
  const limb = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.08);
  limb.addColorStop(0, rgba(AMBER, 0));
  limb.addColorStop(0.55, rgba(AMBER, 0.4 * rise));
  limb.addColorStop(1, rgba(AMBER, 0));
  ctx.fillStyle = limb;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.08, 0, TAU);
  ctx.fill();
}

/** The line of light where the disc meets the horizon: a long faint
 *  streak, a line of cream, and a short white core. */
function glint(ctx: CanvasRenderingContext2D, cx: number, h: number, R: number, rise: number) {
  const y = h - 1;
  for (const [rx, ry, c, a] of [
    [1.9, 5, AMBER, 0.22],
    [1.3, 2.2, CREAM, 0.6],
    [0.6, 1.4, CORE, 0.85],
  ] as [number, number, string, number][]) {
    ctx.fillStyle = rgba(c, a * rise);
    ctx.beginPath();
    ctx.ellipse(cx, y, R * rx, ry, 0, 0, TAU);
    ctx.fill();
  }
}

type Ember = { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number; ph: number };

/** An ember born in the glow along the horizon, to climb slowly and go
 *  out. */
function ember(cx: number, h: number, R: number): Ember {
  return {
    x: cx + (Math.random() - 0.5) * 2.6 * R,
    y: h + Math.random() * 0.08 * R,
    vx: (Math.random() - 0.5) * 4,
    vy: (-(6 + Math.random() * 14) * R) / 260,
    age: 0,
    life: 7 + Math.random() * 9,
    r: 0.7 + Math.random() * 1.6,
    ph: Math.random() * TAU,
  };
}

/** One ember's light, drawn once and stamped wherever an ember is. */
function spark(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, rgba(CORE, 1));
  r.addColorStop(0.35, rgba(GOLD, 0.6));
  r.addColorStop(1, rgba(AMBER, 0));
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  return c;
}

/** The embers: each climbs, sways, brightens and fades over its life and
 *  is born again at the horizon; brighter the nearer the sun. */
function embers(ctx: CanvasRenderingContext2D, list: Ember[], sprite: HTMLCanvasElement, cx: number, h: number, R: number, dt: number, t: number, rise: number) {
  for (const e of list) {
    e.age += dt;
    if (e.age > e.life) Object.assign(e, ember(cx, h, R));
    e.x += (e.vx + 3 * Math.sin(t * 0.6 + e.ph)) * dt;
    e.y += e.vy * dt;
    const a = rise * Math.sin((Math.PI * e.age) / e.life) * 0.85;
    if (a <= 0.01) continue;
    const near = clamp(1 - Math.abs(e.x - cx) / (1.5 * R), 0.3, 1);
    ctx.globalAlpha = a * near;
    const s = e.r * 8;
    ctx.drawImage(sprite, e.x - s / 2, e.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}

/** Over the disc, the one line that says it can be turned. */
function hint(ctx: CanvasRenderingContext2D, cx: number, y: number, a: number, font: string) {
  if (a < 0.02) return;
  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  ctx.textAlign = "center";
  ctx.font = `600 10.5px ${font}`;
  spaced.letterSpacing = "0.2em";
  ctx.fillStyle = `rgba(238, 242, 251, ${0.8 * a})`;
  ctx.fillText("DRAG THE SUN TO TURN THE SKY", cx, y);
  spaced.letterSpacing = "0px";
}

export function runSun(canvas: HTMLCanvasElement, still: boolean): () => void {
  const ctx = canvas.getContext("2d")!;
  const font = getComputedStyle(canvas).fontFamily;
  const surface = makeSurface();
  const sprite = spark();
  let disc: Disc | null = null;
  let glowing: Ember[] = [];
  let w = 0;
  let h = 0;
  let R = 0;
  let cx = 0;
  let cy = 0;
  let spin = SPIN;
  let hintA = 0;
  let raf = 0;
  let last = 0;
  let t0 = 0;
  let visible = true;
  let asleep = false;
  /** The turn and the height the disc was last shaded at: it is shaded
   *  again only once it has moved, not every frame. */
  let shadedAt = { angle: NaN, rows: -1 };
  const grab = { x: 0, at: 0 };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = rect.width;
    h = rect.height;
    R = w / 4;
    cx = w / 2;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    disc = prepare(R, SHADE);
    shadedAt = { angle: NaN, rows: -1 };
    // Embers at every stage of their lives, so none arrive all at once.
    glowing = Array.from({ length: 36 }, () => {
      const e = ember(cx, h, R);
      e.age = Math.random() * e.life;
      e.y += e.vy * e.age;
      return e;
    });
  };

  const step = (dt: number) => {
    if (!sunTurn.held) {
      spin += (SPIN - spin) * Math.min(1, dt * 0.7);
      sunTurn.angle += spin * dt;
    }
    hintA += ((sunTurn.over && !sunTurn.held ? 1 : 0) - hintA) * Math.min(1, dt * 5);
  };

  const frame = (now: number) => {
    raf = 0;
    // Once the day has risen past it the sun has faded out (index.css,
    // .dawn): sleep until the page scrolls back up.
    if (!still && scrollY > innerHeight * 0.72) {
      asleep = true;
      return;
    }
    if (!t0) t0 = now;
    const t = still ? 0 : (now - t0) / 1000;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (!still) step(dt);
    ctx.clearRect(0, 0, w, h);

    // The sunrise: the sky warms first, then the disc lifts from fully
    // hidden to just clear of the horizon, and the shafts come last.
    const up = still ? 1 : smooth(0, 1, (t - 0.15) / 1.6);
    const rise = still ? 1 : easeOut(clamp((t - 0.5) / 2.3, 0, 1));
    const rays = still ? 1 : smooth(0, 1, (t - 1.3) / 2.2);
    cy = h + R * (1 - DOME * rise);

    ctx.globalCompositeOperation = "lighter";
    atmosphere(ctx, cx, cy, h, R, t, up, rise);
    shafts(ctx, cx, cy, R, sunTurn.angle, t, rays);
    ctx.globalCompositeOperation = "source-over";
    if (disc) {
      const rows = Math.ceil((h - (cy - R)) * disc.s);
      if (rows !== shadedAt.rows || !(Math.abs(sunTurn.angle - shadedAt.angle) < 0.003)) {
        shade(disc, surface, sunTurn.angle, rows);
        shadedAt = { angle: sunTurn.angle, rows };
      }
      // The glow round the disc is the corona's (atmosphere), not a shadow
      // blur: a blur here costs more than everything else in the frame.
      ctx.drawImage(disc.img, cx - R, cy - R, 2 * R, R);
      discLight(ctx, cx, cy, R, rise);
    }
    ctx.globalCompositeOperation = "lighter";
    // Bloom: the light spilling over the disc's own edge, as a camera sees
    // a bright sun - brightest high on the dome.
    const bloom = ctx.createRadialGradient(cx, cy - R * 0.3, R * 0.2, cx, cy, R * 1.35);
    bloom.addColorStop(0, rgba(CORE, 0.18 * rise));
    bloom.addColorStop(0.6, rgba(GOLD, 0.07 * rise));
    bloom.addColorStop(1, rgba(GOLD, 0));
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.35, 0, TAU);
    ctx.fill();
    glint(ctx, cx, h, R, rise);
    if (!still) embers(ctx, glowing, sprite, cx, h, R, dt, t, rise);
    ctx.globalCompositeOperation = "source-over";
    hint(ctx, cx, cy - R - 26, hintA, font);

    if (visible && !still) raf = requestAnimationFrame(frame);
  };

  /** Whether the pointer is on the part of the disc above the horizon. */
  const onDisc = (e: PointerEvent) => {
    if (e.pointerType === "touch") return false;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left - cx;
    const y = e.clientY - r.top;
    return y < h && x * x + (y - cy) * (y - cy) <= R * R;
  };
  const cursor = () => {
    document.documentElement.style.cursor = sunTurn.held ? "grabbing" : sunTurn.over ? "grab" : "";
  };
  const move = (e: PointerEvent) => {
    if (sunTurn.held) {
      const turn = (e.clientX - grab.x) / R;
      const secs = Math.max(0.008, (e.timeStamp - grab.at) / 1000);
      sunTurn.angle += turn;
      spin = clamp(spin * 0.5 + (turn / secs) * 0.5, -6, 6);
      grab.x = e.clientX;
      grab.at = e.timeStamp;
      return;
    }
    const over = onDisc(e);
    if (over !== sunTurn.over) {
      sunTurn.over = over;
      cursor();
    }
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || !onDisc(e)) return;
    e.preventDefault();
    sunTurn.held = true;
    spin = 0;
    grab.x = e.clientX;
    grab.at = e.timeStamp;
    cursor();
  };
  const up = () => {
    if (!sunTurn.held) return;
    sunTurn.held = false;
    cursor();
  };

  resize();
  frame(performance.now());

  const ro = new ResizeObserver(() => {
    resize();
    if (still) frame(performance.now());
  });
  ro.observe(canvas);

  /** The loop, started if it is not running - one loop, however many
   *  things ask for it. */
  const run = () => {
    if (raf || still) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  };
  const wake = () => {
    if (asleep && scrollY <= innerHeight * 0.72) {
      asleep = false;
      run();
    }
  };

  const io = new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    if (visible) run();
  });
  io.observe(canvas);

  if (!still) {
    addEventListener("pointermove", move);
    addEventListener("pointerdown", down);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    addEventListener("scroll", wake, { passive: true });
  }

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    removeEventListener("pointermove", move);
    removeEventListener("pointerdown", down);
    removeEventListener("pointerup", up);
    removeEventListener("pointercancel", up);
    removeEventListener("scroll", wake);
    sunTurn.over = sunTurn.held = false;
    document.documentElement.style.cursor = "";
  };
}

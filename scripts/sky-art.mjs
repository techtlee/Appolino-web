// The drawings over the hero's sky (heroField.ts): James Hedberg's
// constellation art as OpenSpace ships it (CC BY 4.0; the OpenSpace
// documentation, Milky Way > Constellations > Constellation Art), each put
// on the sky where OpenSpace puts it, and prepared here, once, rather than
// in the visitor's browser: the white lines turned a pale warm cream over
// the faintest fill of the figure's inside, cut to the drawing, written to
// public/sky/ as WebP with its alpha.
//
// Used by sky-data.mjs, which writes what this returns into skyData.ts; it
// does nothing run on its own. It needs Playwright's Chromium (a dev
// dependency) for a canvas to draw and encode with.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

/** OpenSpace's sync server lists the files of each version of a data set.
 *  Version 4 of the drawings keeps most of them from version 1 and redraws
 *  a few (in 2 and 3), so each file is fetched from where the list says. */
const LIST = "https://data.openspaceproject.com/request?identifier=constellation_images&file_version=4&application_version=1";

/** The drawings are 2048-pixel squares, mostly empty round the figure.
 *  They are worked on at half that - a 1024-pixel square - then cut to the
 *  drawing, and the cut is made no longer than MAX on its longer side:
 *  the hero draws a figure a few hundred pixels across, and the page holds
 *  a decoded picture in memory while it shows. */
const SOURCE = 2048;
const HALF = 1024;
const MAX = 512;
/** Pixels kept round the drawing, for its glow. */
const MARGIN = 8;
/** How wide a gap in an outline may be, in pixels at half size, and still
 *  be closed when the inside is found (twice this). The bear's open belly
 *  leaves a wider gap than any other outline. (Of drawings not shown now:
 *  Virgo's robe needs 12; Taurus and Pegasus are open strokes with no
 *  inside, and would stay lines.) */
const CLOSE = { UMa: 20, Vir: 12 };
const CLOSE_DEFAULT = 6;
/** How opaque the fill of the inside is, under lines that are fully so. */
const FILL = 0.1;
/** Alpha in 32 steps: the soft glow does not show the steps on the night
 *  sky, and the files come out half the size. */
const LEVELS = 32;
/** A drawing is pinned to the sky by a mesh of anchors, no cell wider than
 *  this many degrees. The dome is stereographic and the drawing flat, and
 *  over a figure as big as the Bear one affine fit missed its stars by
 *  thirty pixels or more; with cells this size the miss is a few. */
const CELL = 10;

const RAD = Math.PI / 180;
const PARSEC = 3.0856776e16;
/** ICRS (J2000) to galactic coordinates: g = T e (Hipparcos, vol. 1, 1.5.11). */
const T = [
  [-0.0548755604162154, -0.873437090234885, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.7469822444972189],
  [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
];
const times = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const apply = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const applyT = (M, v) => [0, 1, 2].map((j) => M[0][j] * v[0] + M[1][j] * v[1] + M[2][j] * v[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => {
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};
const r2 = (v, d) => +v.toFixed(d);

/** A direction in galactic coordinates as right ascension and declination. */
function equatorial(g) {
  const e = applyT(T, g);
  return { ra: (((Math.atan2(e[1], e[0]) / RAD) % 360) + 360) % 360, dec: Math.asin(Math.max(-1, Math.min(1, e[2]))) / RAD, v: e };
}

/** glm's quat(vec3) as a matrix, as OpenSpace's StaticRotation builds it
 *  from three Euler angles: about x first, then y, then z. */
function euler(x, y, z) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(x), Math.sin(x), Math.cos(y), Math.sin(y), Math.cos(z), Math.sin(z)];
  const Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
  const Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const Rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
  return times(Rz, times(Ry, Rx));
}

/** Where OpenSpace hangs a drawing (constellation_art.asset): a plane
 *  centred on the direction of its row's x, y, z - galactic, in parsecs, as
 *  OpenSpace's whole scene is - 3.2 parsecs out, turned by the row's three
 *  angles, reaching `scale` x 3.2e16 metres from its centre each way
 *  (RenderablePlane's Size is the half-width). The image's top row is at
 *  the plane's +y: OpenSpace's texture reader turns the rows over. */
function plane(row) {
  const P = unit([row.x, row.y, row.z]).map((v) => v * 3.2);
  const R = euler(row.rotX, row.rotY, row.rotZ);
  return { P, R, half: (1e17 * row.scale * 3.2) / 10 / PARSEC };
}

/** The point of the sky a pixel of the source image is seen at from the
 *  sun, which is where the sky's centre is. */
function skyAt(pl, X, Y) {
  const local = [pl.half * ((2 * X) / SOURCE - 1), pl.half * (1 - (2 * Y) / SOURCE), 0];
  return equatorial(unit(apply(pl.R, local).map((v, i) => v + pl.P[i])));
}

const separation = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a.v, b.v)))) / RAD;

/** A drawing must read as the sky does from Earth - north up, east to the
 *  left - or the dome would show it mirrored. The turn from the image's
 *  top-left corner to its top-right and then its bottom-left is the same
 *  way round on the sky, seen from inside, as it is in the image. */
function readsAsSeen(at, w, h) {
  const [a, b, c] = [at(0, 0), at(w, 0), at(0, h)];
  const east = unit(cross([0, 0, 1], a.v));
  const north = cross(a.v, east);
  const flat = (p) => [-dot(p.v, east), -dot(p.v, north)];
  const [pa, pb, pc] = [flat(a), flat(b), flat(c)];
  return (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]) > 0;
}

/** The anchors pinning a cut drawing to the sky: a grid over it, (cols + 1)
 *  to a row, each the pixel and the sky's position there. */
function mesh(pl, crop) {
  const at = (px, py) => skyAt(pl, ((crop.x0 + px / crop.kx) * SOURCE) / HALF, ((crop.y0 + py / crop.ky) * SOURCE) / HALF);
  if (!readsAsSeen(at, crop.w, crop.h)) throw new Error("a drawing would be mirrored on the sky");
  const across = separation(at(0, crop.h / 2), at(crop.w, crop.h / 2));
  const down = separation(at(crop.w / 2, 0), at(crop.w / 2, crop.h));
  const cols = Math.max(1, Math.ceil(across / CELL));
  const rows = Math.max(1, Math.ceil(down / CELL));
  const anchors = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const px = (crop.w * i) / cols;
      const py = (crop.h * j) / rows;
      const s = at(px, py);
      anchors.push(r2(px, 1), r2(py, 1), r2(s.ra, 4), r2(s.dec, 4));
    }
  }
  return { cols, anchors };
}

/** Runs in Chromium. The drawing at half size, cut to what is drawn and
 *  made no longer than `max`: its lines (the source's white, alpha only,
 *  glow included) in cream over a faint fill of the figure's inside. The
 *  inside is what the outside cannot reach - the outside flooded in from
 *  the border with the lines thickened by `close`, so a small gap in an
 *  outline does not let it in - with the thickening taken back off. */
async function prepare({ src, half, max, close, fill, levels, margin }) {
  const N = half;
  const img = new Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = N;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, N, N);
  const px = g.getImageData(0, 0, N, N).data;
  const ink = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) ink[k] = px[4 * k + 3] / 255;

  // How far each pixel is from the nearest pixel of `on`, in thirds of a
  // pixel: a 3-4 chamfer distance, two passes.
  const distance = (on) => {
    const d = new Float32Array(N * N);
    for (let k = 0; k < N * N; k++) d[k] = on[k] ? 0 : 1e9;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const k = y * N + x;
        let v = d[k];
        if (x > 0) v = Math.min(v, d[k - 1] + 3);
        if (y > 0) {
          v = Math.min(v, d[k - N] + 3);
          if (x > 0) v = Math.min(v, d[k - N - 1] + 4);
          if (x < N - 1) v = Math.min(v, d[k - N + 1] + 4);
        }
        d[k] = v;
      }
    }
    for (let y = N - 1; y >= 0; y--) {
      for (let x = N - 1; x >= 0; x--) {
        const k = y * N + x;
        let v = d[k];
        if (x < N - 1) v = Math.min(v, d[k + 1] + 3);
        if (y < N - 1) {
          v = Math.min(v, d[k + N] + 3);
          if (x < N - 1) v = Math.min(v, d[k + N + 1] + 4);
          if (x > 0) v = Math.min(v, d[k + N - 1] + 4);
        }
        d[k] = v;
      }
    }
    return d;
  };
  const line = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) line[k] = ink[k] > 0.4 ? 1 : 0;
  const nearLine = distance(line);
  const outside = new Uint8Array(N * N);
  const queue = new Int32Array(N * N);
  let head = 0;
  let tail = 0;
  const flood = (k) => {
    if (outside[k] || nearLine[k] <= 3 * close) return;
    outside[k] = 1;
    queue[tail++] = k;
  };
  for (let i = 0; i < N; i++) {
    flood(i);
    flood((N - 1) * N + i);
    flood(i * N);
    flood(i * N + N - 1);
  }
  while (head < tail) {
    const k = queue[head++];
    const x = k % N;
    if (x > 0) flood(k - 1);
    if (x < N - 1) flood(k + 1);
    if (k >= N) flood(k - N);
    if (k < N * (N - 1)) flood(k + N);
  }
  const fromOutside = distance(outside);
  let inside = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) inside[k] = fromOutside[k] > 3 * close ? 1 : 0;
  // The fill's edge softened over a few pixels: a box blur, twice.
  const blur = (s, r) => {
    const t = new Float32Array(N * N);
    const o = new Float32Array(N * N);
    const n = 2 * r + 1;
    const at = (i) => Math.min(N - 1, Math.max(0, i));
    for (let y = 0; y < N; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += s[y * N + at(x)];
      for (let x = 0; x < N; x++) {
        t[y * N + x] = acc / n;
        acc += s[y * N + at(x + r + 1)] - s[y * N + at(x - r)];
      }
    }
    for (let x = 0; x < N; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += t[at(y) * N + x];
      for (let y = 0; y < N; y++) {
        o[y * N + x] = acc / n;
        acc += t[at(y + r + 1) * N + x] - t[at(y - r) * N + x];
      }
    }
    return o;
  };
  inside = blur(blur(inside, 2), 2);

  let x0 = N;
  let y0 = N;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (ink[y * N + x] < 0.03) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + 1);
      y1 = Math.max(y1, y + 1);
    }
  }
  x0 = Math.max(0, x0 - margin);
  y0 = Math.max(0, y0 - margin);
  x1 = Math.min(N, x1 + margin);
  y1 = Math.min(N, y1 + margin);
  const cw = x1 - x0;
  const ch = y1 - y0;
  const whole = document.createElement("canvas");
  whole.width = cw;
  whole.height = ch;
  const wg = whole.getContext("2d");
  const drawn = wg.createImageData(cw, ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const k = (y + y0) * N + (x + x0);
      const o = 4 * (y * cw + x);
      drawn.data[o] = 246;
      drawn.data[o + 1] = 226;
      drawn.data[o + 2] = 188;
      drawn.data[o + 3] = Math.round(255 * (1 - (1 - ink[k]) * (1 - inside[k] * fill)));
    }
  }
  wg.putImageData(drawn, 0, 0);
  // Down to `max`, then the alpha in its steps and the colour cream again,
  // which scaling leaves a little off where the alpha is low.
  const k = Math.min(1, max / Math.max(cw, ch));
  const w = Math.max(1, Math.round(cw * k));
  const h = Math.max(1, Math.round(ch * k));
  const cut = document.createElement("canvas");
  cut.width = w;
  cut.height = h;
  const cg = cut.getContext("2d", { willReadFrequently: true });
  cg.imageSmoothingQuality = "high";
  cg.drawImage(whole, 0, 0, w, h);
  const out = cg.getImageData(0, 0, w, h);
  const step = 255 / (levels - 1);
  for (let o = 0; o < out.data.length; o += 4) {
    out.data[o] = 246;
    out.data[o + 1] = 226;
    out.data[o + 2] = 188;
    out.data[o + 3] = Math.round(Math.round(out.data[o + 3] / step) * step);
  }
  cg.putImageData(out, 0, 0);
  return { x0, y0, kx: w / cw, ky: h / ch, w, h, url: cut.toDataURL("image/webp", 0.8) };
}

const get = async (url, as = "text") => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return as === "text" ? r.text() : Buffer.from(await r.arrayBuffer());
};

/** Each figure's drawing, prepared into `dir` (public/sky/), and how it is
 *  pinned to the sky, by figure id. */
export async function drawings(ids, dir) {
  const files = (await get(LIST)).split(/\s+/).filter(Boolean).map((u) => u.replace(/^http:/, "https:"));
  const csv = await get(files.find((u) => u.endsWith("/constellation_data.csv")));
  // group, IAU abbreviation, name, x, y, z, scale, image, rotX, rotY, rotZ, centre star, origins
  const rows = new Map();
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const c = line.split(",");
    if (c.length < 11) continue;
    rows.set(c[1].toLowerCase(), { image: c[7], x: +c[3], y: +c[4], z: +c[5], scale: +c[6], rotX: +c[8], rotY: +c[9], rotZ: +c[10] });
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const out = {};
  try {
    for (const id of ids) {
      const row = rows.get(id.toLowerCase());
      const url = row && files.find((u) => u.endsWith(`/${row.image}`));
      if (!url) throw new Error(`${id}: OpenSpace has no drawing`);
      const src = `data:image/png;base64,${(await get(url, "buffer")).toString("base64")}`;
      const cut = await page.evaluate(prepare, { src, half: HALF, max: MAX, close: CLOSE[id] ?? CLOSE_DEFAULT, fill: FILL, levels: LEVELS, margin: MARGIN });
      const file = `${id.toLowerCase()}.webp`;
      const webp = Buffer.from(cut.url.slice(cut.url.indexOf(",") + 1), "base64");
      writeFileSync(join(dir, file), webp);
      const { cols, anchors } = mesh(plane(row), cut);
      out[id] = { file: `sky/${file}`, w: cut.w, h: cut.h, cols, anchors };
      console.log(`${id}: ${cut.w}x${cut.h}, ${cols}x${anchors.length / 4 / (cols + 1) - 1} mesh, ${Math.round(webp.length / 1024)} KB`);
    }
  } finally {
    await browser.close();
  }
  return out;
}

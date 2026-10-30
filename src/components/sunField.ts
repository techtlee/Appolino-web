/**
 * The sun rising behind the app window, drawn on a canvas so its edge can be
 * alive: the limb wobbles slightly, two translucent coronas with their own
 * wobble fuzz the rim, short spicules flicker off it, and embers lift off the
 * surface and fade as they drift away. The ember density falls off with the
 * distance from the rim, so the air is orange next to the sun and clear
 * further out.
 *
 * The canvas is 4R wide and 1.5R tall; the disc's centre sits below the
 * bottom edge, so only a cap of R/2 shows above the horizon (the window's top).
 */

const EMBER_INKS = ["233, 162, 59", "244, 184, 96", "248, 200, 119", "201, 127, 35"];

type Ember = { th: number; d: number; vd: number; vt: number; r: number; a: number; age: number; life: number; ink: string; wob: number };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Distance from the rim, in radii: exponential so most embers hug the sun. */
function born(R: number): Ember {
  const e: Ember = {
    th: rnd(Math.PI, Math.PI * 2),
    d: 0,
    vd: rnd(3, 11),
    vt: rnd(-0.03, 0.03),
    r: rnd(0.7, 2.1),
    a: rnd(0.35, 0.95),
    age: 0,
    life: rnd(4, 9),
    ink: EMBER_INKS[Math.floor(Math.random() * EMBER_INKS.length)],
    wob: Math.random() * Math.PI * 2,
  };
  e.d = R * (1.0 + Math.min(0.75, -Math.log(1 - Math.random()) * 0.11));
  return e;
}

function seed(R: number): Ember[] {
  const n = Math.round(Math.max(120, Math.min(260, R * 0.95)));
  const out: Ember[] = [];
  for (let i = 0; i < n; i++) {
    const e = born(R);
    e.age = Math.random() * e.life; // start mid-life, so the field is full at once
    out.push(e);
  }
  return out;
}

/** The limb's radius at angle th, in multiples of R: a few slow waves and a
 *  faster ripple, each with its own drift so the edge never repeats. */
function limb(th: number, t: number, k: number): number {
  return (
    1 +
    k * (0.6 * Math.sin(3 * th + t * 0.5) + 0.45 * Math.sin(7 * th - t * 0.9 + 1.3) + 0.3 * Math.sin(13 * th + t * 1.7) + 0.18 * Math.sin(29 * th - t * 2.8 + 0.7))
  );
}

function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, t: number, k: number) {
  const N = 220;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2;
    const r = R * limb(th, t, k);
    const x = cx + Math.cos(th) * r;
    const y = cy + Math.sin(th) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

export function runSun(canvas: HTMLCanvasElement, still: boolean): () => void {
  const ctx = canvas.getContext("2d")!;
  let w = 0;
  let h = 0;
  let R = 0;
  let embers: Ember[] = [];
  let raf = 0;
  let last = 0;
  let t0 = 0;
  let visible = true;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    R = w / 4;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    embers = seed(R);
  };

  const frame = (now: number) => {
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    ctx.clearRect(0, 0, w, h);

    // The sunrise: the centre lifts from fully hidden to half a radius below the horizon.
    const lift = still ? 0.5 : 1 - 0.5 * easeOut(Math.max(0, Math.min(1, (t - 0.4) / 1.8)));
    const cx = w / 2;
    const cy = h + R * lift;
    const wob = still ? 0 : t;

    // The corona: a wider, wobblier, blurred halo, so the rim is fuzzy rather than drawn.
    ctx.globalCompositeOperation = "lighter";
    disc(ctx, cx, cy, R * 1.04, wob + 2.1, 0.035);
    ctx.fillStyle = "rgba(233, 162, 59, 0.1)";
    ctx.shadowColor = "rgba(233, 162, 59, 0.5)";
    ctx.shadowBlur = R * 0.1;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";

    // Spicules: short flickering rays off the limb.
    if (!still) {
      ctx.lineWidth = 1;
      for (let i = 0; i < 36; i++) {
        const th = Math.PI + ((i + 0.5) / 36) * Math.PI + 0.05 * Math.sin(t * 1.3 + i * 2.3);
        const len = R * (0.025 + 0.03 * (0.5 + 0.5 * Math.sin(t * 3.1 + i * 1.7)) * (0.5 + 0.5 * Math.sin(t * 0.7 + i * 0.9)));
        const r0 = R * limb(th, wob, 0.012) - 2;
        const c = Math.cos(th);
        const s = Math.sin(th);
        ctx.beginPath();
        ctx.moveTo(cx + c * r0, cy + s * r0);
        ctx.lineTo(cx + c * (r0 + len), cy + s * (r0 + len));
        ctx.strokeStyle = `rgba(244, 184, 96, ${0.12 + 0.18 * (0.5 + 0.5 * Math.sin(t * 2.3 + i))})`;
        ctx.stroke();
      }
    }

    // The disc itself: a soft glow around a limb that is not quite round,
    // brightest near the top of the cap and reddening towards the rim.
    disc(ctx, cx, cy, R, wob, 0.016);
    const g = ctx.createRadialGradient(cx, cy - R * 0.2, 0, cx, cy - R * 0.1, R * 1.05);
    g.addColorStop(0, "#FBD48A");
    g.addColorStop(0.45, "#F0B050");
    g.addColorStop(0.85, "#E39B34");
    g.addColorStop(1, "#C97F23");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(233, 162, 59, 0.6)";
    ctx.shadowBlur = R * 0.14;
    ctx.fill();
    ctx.shadowBlur = 0;

    // A faint grain across the disc so it is not a flat fill.
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "rgba(255, 236, 200, 0.05)";
    for (let i = 0; i < 70; i++) {
      const a = (i * 2.399963) % (Math.PI * 2); // golden angle, a still scatter
      const d = R * Math.sqrt(((i * 7919) % 997) / 997);
      const x = cx + Math.cos(a) * d + (still ? 0 : 2 * Math.sin(t * 0.4 + i));
      const y = cy + Math.sin(a) * d;
      if (y > h) continue;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + ((i * 31) % 7) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Embers: born at the rim, drifting out and up, fading with age and distance.
    for (const e of embers) {
      if (!still) {
        e.age += dt;
        if (e.age > e.life) Object.assign(e, born(R));
        e.d += e.vd * dt;
        e.th += e.vt * dt;
      }
      const x = cx + Math.cos(e.th) * e.d + 3 * Math.sin(wob * 0.8 + e.wob);
      const y = cy + Math.sin(e.th) * e.d - (still ? 0 : e.age * 7) + 2 * Math.cos(wob * 0.6 + e.wob);
      if (y > h || y < -4) continue;
      const far = Math.max(0, 1 - (e.d - R) / (R * 0.7));
      const life = Math.sin((Math.PI * e.age) / e.life);
      const a = e.a * life * (0.2 + 0.8 * far * far);
      if (a < 0.02) continue;
      ctx.beginPath();
      ctx.arc(x, y, e.r * (0.6 + 0.4 * far), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${e.ink}, ${a})`;
      ctx.fill();
    }

    if (visible && !still) raf = requestAnimationFrame(frame);
  };

  resize();
  frame(performance.now());

  const ro = new ResizeObserver(() => {
    resize();
    if (still) frame(performance.now());
  });
  ro.observe(canvas);

  const io = new IntersectionObserver((es) => {
    const v = es[0].isIntersecting;
    if (v && !visible && !still) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
    visible = v;
  });
  io.observe(canvas);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
  };
}

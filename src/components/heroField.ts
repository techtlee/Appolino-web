/**
 * The hero's field, after Appolino's own (frontend/src/features/home/heroField.ts):
 * drifting motes on a canvas that the visitor's pointer nudges aside and
 * brightens, with the motes in its reach threaded together - "we connect the
 * dots" made literal. Inked in the brand kit's cool greys and light blue.
 */

const INKS = ["133, 144, 168", "113, 124, 148", "149, 173, 216", "233, 162, 59"];
const REACH = 160;
const THREAD = 84;
const AWAY = -1e4;

type Mote = {
  x: number;
  y: number;
  r: number;
  bvx: number;
  bvy: number;
  vx: number;
  vy: number;
  ink: string;
  a: number;
  near: number;
};

function seed(w: number, h: number): Mote[] {
  const motes: Mote[] = [];
  const count = Math.round((w * h) / 1500);
  for (let i = 0; i < count; i++) {
    const drift = 6 + Math.random() * 14;
    const angle = Math.random() * Math.PI * 2;
    const bvx = Math.cos(angle) * drift;
    const bvy = Math.sin(angle) * drift;
    motes.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.7 + Math.random() * 1.5,
      bvx,
      bvy,
      vx: bvx,
      vy: bvy,
      ink: INKS[Math.random() < 0.5 ? 0 : Math.random() < 0.5 ? 1 : Math.random() < 0.8 ? 2 : 3],
      a: 0.14 + Math.random() * 0.34,
      near: 0,
    });
  }
  return motes;
}

/** Starts the field on `canvas`, listening for the pointer on `host`; returns
 *  the stop. Still is drawn once and never animated. */
export function runField(canvas: HTMLCanvasElement, host: HTMLElement, still: boolean): () => void {
  const ctx = canvas.getContext("2d")!;
  const ptr = { x: AWAY, y: AWAY };
  let w = 0;
  let h = 0;
  let motes: Mote[] = [];
  let raf = 0;
  let last = 0;
  let visible = true;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    motes = seed(w, h);
  };

  const frame = (t: number) => {
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    ctx.clearRect(0, 0, w, h);

    const reach: Mote[] = [];
    for (const m of motes) {
      const dx = m.x - ptr.x;
      const dy = m.y - ptr.y;
      const d = Math.hypot(dx, dy);
      m.near = 0;
      if (d < REACH && d > 0.001) {
        m.near = 1 - d / REACH;
        m.vx += (dx / d) * m.near * 520 * dt;
        m.vy += (dy / d) * m.near * 520 * dt;
        reach.push(m);
      }
      m.vx += (m.bvx - m.vx) * 2 * dt;
      m.vy += (m.bvy - m.vy) * 2 * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < -4) m.x += w + 8;
      if (m.x > w + 4) m.x -= w + 8;
      if (m.y < -4) m.y += h + 8;
      if (m.y > h + 4) m.y -= h + 8;
    }

    for (let i = 0; i < reach.length; i++) {
      for (let j = i + 1; j < reach.length; j++) {
        const a = reach[i];
        const b = reach[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > THREAD) continue;
        const strength = a.near * b.near * (1 - d / THREAD);
        if (strength < 0.02) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(233, 162, 59, ${strength * 0.6})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    for (const m of motes) {
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * (1 + m.near * 0.6), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${m.ink}, ${Math.min(0.95, m.a * (1 + m.near * 1.8))})`;
      ctx.fill();
    }

    if (visible && !still) raf = requestAnimationFrame(frame);
  };

  const move = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    ptr.x = e.clientX - rect.left;
    ptr.y = e.clientY - rect.top;
  };
  const leave = () => {
    ptr.x = ptr.y = AWAY;
  };

  resize();
  frame(performance.now());

  const ro = new ResizeObserver(() => {
    resize();
    if (still) frame(performance.now());
  });
  ro.observe(canvas);

  // Off screen, the field stops drawing.
  const io = new IntersectionObserver((es) => {
    const v = es[0].isIntersecting;
    if (v && !visible && !still) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
    visible = v;
  });
  io.observe(canvas);

  host.addEventListener("pointermove", move);
  host.addEventListener("pointerleave", leave);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    host.removeEventListener("pointermove", move);
    host.removeEventListener("pointerleave", leave);
  };
}

import { useEffect, useRef, useState } from "react";
import { prefersLessMotion } from "../motion";

const S1 = "This is how company data should work.";
const S2 = "Import once, check every time, deliver on a schedule, and never paste between spreadsheets again.";

/** Two sentences that light up word by word as they scroll into the
 *  middle of the window; lit from the start when less motion is asked for. */
export function Statement() {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(prefersLessMotion() ? 1 : 0);

  useEffect(() => {
    if (prefersLessMotion()) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const start = innerHeight * 0.88;
        const end = innerHeight * 0.4;
        setP(Math.max(0, Math.min(1, (start - r.top) / (start - end + r.height))));
      });
    };
    on();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => {
      removeEventListener("scroll", on);
      removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, []);

  const w1 = S1.split(" ");
  const w2 = S2.split(" ");
  const n = w1.length + w2.length;
  const lit = (i: number) => (i + 0.5) / n <= p;

  return (
    <section className="statement" aria-label="What Appolino is for">
      <div className="wrap" ref={ref}>
        <p className="s1">
          {w1.map((w, i) => (
            <span key={i} className={`w${lit(i) ? " lit" : ""}`}>
              {w}{" "}
            </span>
          ))}
        </p>
        <p>
          {w2.map((w, i) => (
            <span key={i} className={`w${lit(w1.length + i) ? " lit" : ""}`}>
              {w}{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

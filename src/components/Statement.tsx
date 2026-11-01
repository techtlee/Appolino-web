import { useEffect, useRef, useState } from "react";
import { prefersLessMotion } from "../motion";
import { useT } from "../i18n";

/** The statement in English and Czech: the eyebrow and the sentence lit word by word. Its old
 *  closing line, "Your road to digitalization starts here.", heads the road through the work
 *  at the end of Solutions now (owner, 2026-11-01: not under the slogan; About folded into
 *  Solutions). */
const S1 = ["The new standard for company data", "Nový standard pro firemní data"] as const;
/** It ends on what the data is to the people who use it, trustworthy and reliable, rather than
 *  on what was done to it (owner, 2026-11-01: "clean, validated data - more like trustworthy,
 *  reliable data"). */
const S2 = [
  "Every file, manual input and process, automated into one flawless flow of trustworthy, reliable data.",
  "Každý soubor, ruční vstup i proces, automatizovaný do jednoho bezchybného toku důvěryhodných, spolehlivých dat.",
] as const;
/** The words that carry the promise, lit in the sun's amber rather than ink, in both languages. */
const GOLD = new Set(["Every", "automated", "flawless", "trustworthy,", "reliable", "Každý", "automatizovaný", "bezchybného", "důvěryhodných,", "spolehlivých"]);

/** Where the section's top is, in window heights, as each stage starts and
 *  ends. The pin holds from PINNED on (index.css, .statement .pin's top)
 *  and lets go when the section's foot reaches the pin's (0.75 less the
 *  section's height: -1.75 at 250svh). The words light over the first five
 *  eighths of the pinned stretch and stay lit to seven eighths; then they
 *  dissolve, by a fifth of a window after the pin lets go, so the sentence
 *  is still fading as it moves up while the demo's intro comes up under it,
 *  and there is no empty moment between them. Measured from the section's
 *  own height, so a phone's shorter section (index.css) keeps the same
 *  rhythm in less scrolling. */
const PINNED = 0.25;
const stages = (height: number) => {
  const free = 0.75 - height;
  return { lit: PINNED + (free - PINNED) * 0.625, fade: PINNED + (free - PINNED) * 0.875, gone: free - 0.2 };
};

/** Two sentences pinned in the middle of the window while the page scrolls
 *  past them, the second lighting up word by word - in colour and in weight,
 *  the promises in amber - holding a moment fully lit, then dissolving as
 *  the demo comes up under them; lit from the start, not pinned and never
 *  dissolving, when less motion is asked for. */
export function Statement() {
  const ref = useRef<HTMLElement>(null);
  const still = prefersLessMotion();
  const [p, setP] = useState(still ? 1 : 0);

  useEffect(() => {
    if (still) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const y = el.getBoundingClientRect().top / innerHeight;
        const { lit, fade, gone } = stages(el.offsetHeight / innerHeight);
        const along = (from: number, to: number) => Math.max(0, Math.min(1, (from - y) / (from - to)));
        setP(along(PINNED, lit));
        el.style.setProperty("--out", along(fade, gone).toFixed(3));
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
  }, [still]);

  const t = useT();
  const w2 = t(S2[0], S2[1]).split(" ");
  const lit = (i: number) => (i + 0.5) / w2.length <= p;

  return (
    <section className={still ? "statement still" : "statement"} aria-label={t("What appolino is for", "K čemu je appolino")} ref={ref}>
      <div className="pin">
        <div className="wrap">
          <p className="s1">{t(S1[0], S1[1])}</p>
          <p>
            {w2.map((w, i) => (
              <span key={i} className={`w${GOLD.has(w) ? " gold" : ""}${lit(i) ? " lit" : ""}`}>
                {w}{" "}
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}

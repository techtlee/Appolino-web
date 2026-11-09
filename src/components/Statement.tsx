import { Fragment, useEffect, useRef, useState } from "react";
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
/** The words that carry the promise, marked once coloured in - ink over a band of the mustard
 *  (index.css, .statement .w.gold) - in both languages. */
const GOLD = new Set(["Every", "automated", "flawless", "trustworthy,", "reliable", "Každý", "automatizovaný", "bezchybného", "důvěryhodných,", "spolehlivých"]);

/** Where the section's top is, in window heights, as the words colour in: from when the pin
 *  holds (PINNED, index.css .statement .pin's top) to four fifths of the way to where it lets
 *  go, so the sentence stands fully coloured a moment before it moves on. It stays coloured -
 *  no dissolve (owner, 2026-11-08: "z vyšednutí na to barvení", as productlasso.com does it).
 *  Measured from the section's own height, so a phone's shorter section keeps the rhythm. */
const PINNED = 0.25;
const litAt = (height: number) => PINNED + (0.75 - height - PINNED) * 0.8;

/** Two sentences pinned in the middle of the window while the page scrolls past them, the
 *  second colouring in word by word from a faint grey to ink, the promises in the app's navy,
 *  and staying so; coloured from the start, and not pinned, when less motion is asked for. */
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
        const lit = litAt(el.offsetHeight / innerHeight);
        setP(Math.max(0, Math.min(1, (PINNED - y) / (PINNED - lit))));
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
              <Fragment key={i}>
                <span className={`w${GOLD.has(w) ? " gold" : ""}${lit(i) ? " lit" : ""}`}>{w}</span>{" "}
              </Fragment>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { runField } from "./heroField";
import { prefersLessMotion } from "../motion";
import { useLang, useT } from "../i18n";

/** The headline, word by word - the owner's slogan (2026-11-01): "Where Simplicity Meets
 *  Precision.", its last word turning through what simplicity meets - precision, automation,
 *  validation, reliability, consistency, traceability, trust (owner: "let precision change to
 *  multiple words"; "put reliability, reproducibility, some nice professional words that
 *  describe the platform"; then a shorter word for it, twice - Repeatability, then Consistency,
 *  "to fit") - in the sun's colour, and under it the line that says what that means. In English and Czech; the Czech words are in the case "s" asks for. The sentence
 *  that says what appolino does is the first thing under the horizon (Statement, at the top
 *  of Showcase). */
const HEAD_EN = {
  first: ["Where", "Simplicity"],
  second: ["Meets"],
  turn: ["Precision.", "Automation.", "Validation.", "Reliability.", "Consistency.", "Traceability.", "Trust."],
};
const HEAD_CS = {
  first: ["Kde", "se", "jednoduchost"],
  second: ["potkává", "s"],
  turn: ["přesností.", "automatizací.", "kontrolou.", "spolehlivostí.", "konzistencí.", "dohledatelností.", "důvěrou."],
};

/** When the words come out, in seconds: after the sun has risen, slowly,
 *  one after another, as stars do at dusk. */
const FIRST_WORD = 1.6;
const PER_WORD = 0.24;
/** How long each turning word stands before the next takes its place: long enough to be read
 *  and to rest a moment (owner, 2026-11-01: "slower between the words"; it was 2.6 s). */
const TURN_MS = 3600;

/** The turning word: all of them stacked at one starting point (owner, 2026-11-01: "Meets in
 *  the second row, staying in place; the word changes from the same starting spot"). The whole
 *  word rolls up into place from below and the one before rolls on up and away (index.css,
 *  .turn-w; owner: "just it appears from the bottom, no crazy effects" - a letter-by-letter
 *  turn was tried and dropped the same day). The place is as wide as a typical
 *  word - the mean of them all - and never changes, so "Meets" never moves and nothing jumps;
 *  a longer word runs on past it to the right. It was as wide as the widest, which pushed the
 *  slogan left of the middle while a short word showed (owner: "fit always in the middle,
 *  Meets should not change, text should not jump"). */
function Turning({ words, delay }: { words: string[]; delay: number }) {
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState(-1);
  const [widths, setWidths] = useState<number[]>([]);
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  useLayoutEffect(() => {
    const measure = () => setWidths(refs.current.map((el) => el?.offsetWidth ?? 0));
    measure();
    document.fonts?.ready.then(measure);
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [words]);
  useEffect(() => {
    setI(0);
    setPrev(-1);
    if (prefersLessMotion()) return;
    let id = 0;
    const start = window.setTimeout(() => {
      id = window.setInterval(() => {
        setI((x) => {
          setPrev(x);
          return (x + 1) % words.length;
        });
      }, TURN_MS);
    }, delay * 1000 + 1400);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, [words, delay]);
  return (
    <span className="turn" style={widths.length ? { width: `${Math.round(widths.reduce((a, b) => a + b, 0) / widths.length)}px` } : undefined} aria-live="off">
      {words.map((w, k) => (
        <span key={w} ref={(el) => (refs.current[k] = el)} className={`turn-w grad-text${k === i ? " is-on" : k === prev ? " is-off" : ""}`} aria-hidden={k !== i}>
          {w}
        </span>
      ))}
    </span>
  );
}

export function Hero() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const t = useT();
  const lang = useLang();

  useEffect(() => {
    const cv = canvas.current;
    if (!cv?.parentElement) return;
    return runField(cv, cv.parentElement, prefersLessMotion());
  }, []);

  const head = lang === "cs" ? HEAD_CS : HEAD_EN;
  let k = 0;
  const word = (w: string, i: number, last: boolean, amber = false) => (
    <Fragment key={i}>
      <span className={amber ? "w grad-text" : "w"} style={{ animationDelay: `${FIRST_WORD + k++ * PER_WORD}s` }}>
        {w}
      </span>
      {!last ? " " : ""}
    </Fragment>
  );
  const turnDelay = FIRST_WORD + (head.first.length + head.second.length) * PER_WORD;
  return (
    <section className="hero" id="top">
      <canvas ref={canvas} aria-hidden />
      <div className="wrap">
        {/* The slogan's lines on one left edge, the rest centred (index.css, .hero-copy). */}
        <div className="hero-copy">
          {/* Read by a screen reader as the slogan itself, not as its turning words. */}
          <h1 aria-label={t("Where Simplicity Meets Precision.", "Kde se jednoduchost potkává s přesností.")}>
            <span className="line" aria-hidden>
              {head.first.map((w, i) => word(w, i, i === head.first.length - 1))}
            </span>
            <span className="line" aria-hidden>
              {/* "Meets" in the first line's white; only the turning word is in the sun's colour
                (owner, 2026-11-01). */}
            {head.second.map((w, i) => word(w, 10 + i, false))}
              <span className="w" style={{ animationDelay: `${turnDelay}s` }}>
                <Turning words={head.turn} delay={turnDelay} />
              </span>
            </span>
          </h1>
          <p className="lede">{t("Make work simpler, processes smarter and results reliable.", "Jednodušší práce, chytřejší procesy a spolehlivé výsledky.")}</p>
          <div className="ctas">
            <a className="btn" href="#contact">
              {t("Book a demo", "Domluvit ukázku")}
            </a>
            <a className="btn2" href="#try">
              {t("Try it", "Vyzkoušet")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

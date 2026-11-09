import { Fragment, useEffect, useState } from "react";
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

/** When the words come out, in seconds: at once, one after another - no sky to wait for now
 *  (owner, 2026-11-08: the hero is the slogan and the demo, as on productlasso.com). */
const FIRST_WORD = 0.1;
const PER_WORD = 0.12;
/** How long each turning word stands before the next takes its place: long enough to be read
 *  and to rest a moment (owner, 2026-11-01: "slower between the words"; it was 2.6 s). */
const TURN_MS = 3600;

/** The turning word, on a line of its own under "Where Simplicity Meets" and larger than it
 *  (owner, 2026-11-08). Every word sits in one cell of a grid, so the place is as wide as the
 *  widest and each word stands centred in it: nothing above or below moves as they turn. The
 *  whole word rolls up into place from below and the one before rolls on up and away
 *  (index.css, .turn-w; owner, 2026-11-01: "just it appears from the bottom, no crazy
 *  effects"). */
function Turning({ words, delay }: { words: string[]; delay: number }) {
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState(-1);
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
    }, delay * 1000 + 600);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, [words, delay]);
  return (
    <span className="turn" aria-live="off">
      {words.map((w, k) => (
        <span key={w} className={`turn-w${k === i ? " is-on" : k === prev ? " is-off" : ""}`} aria-hidden={k !== i}>
          {w}
        </span>
      ))}
    </span>
  );
}

export function Hero() {
  const t = useT();
  const lang = useLang();

  const head = lang === "cs" ? HEAD_CS : HEAD_EN;
  let k = 0;
  const word = (w: string, i: number, last: boolean) => (
    <Fragment key={i}>
      <span className="w" style={{ animationDelay: `${FIRST_WORD + k++ * PER_WORD}s` }}>
        {w}
      </span>
      {!last ? " " : ""}
    </Fragment>
  );
  const turnDelay = FIRST_WORD + (head.first.length + head.second.length) * PER_WORD;
  return (
    <section className="hero" id="top">
      <div className="wrap">
        {/* The slogan's lines on one left edge, the rest centred (index.css, .hero-copy). */}
        <div className="hero-copy">
          {/* Read by a screen reader as the slogan itself, not as its turning words. */}
          <h1 aria-label={t("Where Simplicity Meets Precision.", "Kde se jednoduchost potkává s přesností.")}>
            <span className="line" aria-hidden>
              {[...head.first, ...head.second].map((w, i, all) => word(w, i, i === all.length - 1))}
            </span>{" "}
            <span className="line line-turn" aria-hidden>
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

import { Fragment, useEffect, useRef } from "react";
import { runField } from "./heroField";
import { prefersLessMotion } from "../motion";

const WORDS = ["The", "operating", "system", "for", "your", "company's", "data."];

export function Hero() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv?.parentElement) return;
    return runField(cv, cv.parentElement, prefersLessMotion());
  }, []);

  return (
    <section className="hero" id="top">
      <canvas ref={canvas} aria-hidden />
      <div className="wrap">
        <h1>
          {WORDS.map((t, i) => (
            <Fragment key={t}>
              <span className={i === WORDS.length - 1 ? "w grad-text" : "w"} style={{ animationDelay: `${0.1 + i * 0.07}s` }}>
                {t}
              </span>
              {i < WORDS.length - 1 ? " " : ""}
            </Fragment>
          ))}
        </h1>
        <p className="lede">Appolino imports, checks and delivers your spreadsheets. Built for the teams that use them, not just IT.</p>
        <div className="ctas">
          <a className="btn" href="#contact">
            Book a demo
          </a>
          <a className="btn2" href="#try">
            Try it below
          </a>
        </div>
      </div>
    </section>
  );
}

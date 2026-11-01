import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { runSun } from "./sunField";
import { prefersLessMotion } from "../motion";
import { Statement } from "./Statement";
import { TablesScreen } from "../app/TablesScreen";
import { ImportScreen } from "../app/ImportScreen";
import { ValidateScreen } from "../app/ValidateScreen";
import { AskScreen } from "../app/AskScreen";
import { ReadScreen } from "../app/ReadScreen";
import { useLang, useT } from "../i18n";

type TabId = "tables" | "import" | "validate" | "deliver" | "ask";

/** Each tab presents one thing appolino does, on example data (src/app):
 *  only the table and the part of appolino that acts on it, not the whole
 *  app around them, named in English and Czech. In the order the work goes
 *  (owner, 2026-11-01): Extract first and open, then Transform - the table a
 *  team fills in and the steps that build on it, one tab - then Validate,
 *  Deliver and Ask. Every tab plays by itself until the visitor takes over. */
const TABS: { id: TabId; en: string; cs: string; screen: () => ReactNode }[] = [
  // Named Extract, as the step is in the trade's own words - extract, transform, validate,
  // deliver (owner, 2026-11-01: "replace Import with Extract"). Extract is the reading itself -
  // a file read where it lands; Deliver is the scheduled run that writes it into the table
  // through the quality gates, with its run log and alerts, which Extract showed before (owner,
  // 2026-11-01: "maybe Extract and Deliver should be switched"; Deliver "like that jobs log").
  { id: "import", en: "Extract", cs: "Extrakce", screen: () => <ReadScreen /> },
  { id: "tables", en: "Transform", cs: "Transformace", screen: () => <TablesScreen /> },
  { id: "validate", en: "Validate", cs: "Validace", screen: () => <ValidateScreen /> },
  { id: "deliver", en: "Deliver", cs: "Doručení", screen: () => <ImportScreen /> },
  { id: "ask", en: "✦ Ask", cs: "✦ Zeptat se", screen: () => <AskScreen /> },
];

/** How far `el` has come up into the window: 0 while its top is still at
 *  the bottom edge or below, 1 once it has risen `over` of the window's
 *  height. */
function risen(el: HTMLElement, over: number): number {
  return Math.min(1, Math.max(0, (innerHeight - el.getBoundingClientRect().top) / (innerHeight * over)));
}

/** The window comes up out of the day as it scrolls into view - leaning
 *  back at first, upright once its top is two fifths of the way up the
 *  screen, so it is square by the time anyone stops to look at it, on a
 *  short laptop screen as on a tall one: --p on the section, 0 to 1, which
 *  the stylesheet turns into the tilt. The words over it come up out of a
 *  blur a moment before, within the first three tenths of the screen:
 *  --intro. */
function riseWithScroll(section: HTMLElement, intro: HTMLElement, stage: HTMLElement): () => void {
  let raf = 0;
  const set = () => {
    raf = 0;
    section.style.setProperty("--intro", risen(intro, 0.3).toFixed(3));
    section.style.setProperty("--p", risen(stage, 0.4).toFixed(3));
  };
  const on = () => {
    if (!raf) raf = requestAnimationFrame(set);
  };
  set();
  addEventListener("scroll", on, { passive: true });
  addEventListener("resize", on);
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener("scroll", on);
    removeEventListener("resize", on);
  };
}

export function Showcase() {
  const [tab, setTab] = useState<TabId>("import");
  const lang = useLang();
  const tr = useT();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ left: 0, width: 0 });
  const sun = useRef<HTMLCanvasElement>(null);
  const section = useRef<HTMLElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sun.current) return runSun(sun.current, prefersLessMotion());
  }, []);

  useEffect(() => {
    const el = section.current;
    const words = intro.current;
    const st = stage.current;
    if (!el || !words || !st) return;
    if (prefersLessMotion()) return;
    return riseWithScroll(el, words, st);
  }, []);

  useLayoutEffect(() => {
    const place = () => {
      const b = tabsRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      if (b) setInd({ left: b.offsetLeft, width: b.offsetWidth });
    };
    place();
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, [tab, lang]);

  const t = TABS.find((x) => x.id === tab)!;

  return (
    <section className="showcase ground" ref={section}>
      {/* The sun stands on the horizon - this section's top edge - not on the window. */}
      <span className="dawn-glow" aria-hidden />
      <canvas className="dawn" ref={sun} aria-hidden />
      {/* The first thing the day shows: what appolino is for, pinned while it lights up;
          the demo comes after it, and "Try it" links land on the demo, not on this. */}
      <Statement />
      <div className="wrap" id="try">
        <div className="show-intro" ref={intro}>
          <p className="eyebrow">{tr("At first light", "Za úsvitu")}</p>
          <h2>{tr("Daylight on every number.", "Denní světlo na každém čísle.")}</h2>
          <p className="lede">
            {tr(
              "By sunrise, the work is done: processes simplified, information validated and every step documented and traceable.",
              "Než vyjde slunce, je hotovo: procesy zjednodušené, informace ověřené a každý krok zdokumentovaný a dohledatelný.",
            )}
          </p>
        </div>
        <div className="stage" ref={stage}>
          <div className="tabs" role="tablist" aria-label={tr("Screens of appolino", "Obrazovky appolina")} ref={tabsRef}>
            {TABS.map((x) => (
              <button key={x.id} role="tab" id={`tab-${x.id}`} aria-selected={tab === x.id} aria-controls="screen" onClick={() => setTab(x.id)}>
                {tr(x.en, x.cs)}
              </button>
            ))}
            <span className="tab-ind" style={ind} aria-hidden />
          </div>
          <div className="win-wrap app">
            {/* Keyed by the language too: a switch starts the screen afresh in the other
                language, its example data with it. */}
            <div className="win app" role="tabpanel" id="screen" aria-labelledby={`tab-${tab}`} key={`${tab}-${lang}`}>
              {t.screen()}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CycleCtx, ROUND_MS, type Cycle } from "../app/cycle";
import { prefersLessMotion } from "../motion";
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

/** Holds the line under the active tab full a moment once its round has ended, before the next
 *  tab opens. */
const HOLD_MS = 700;

/** The tour through the tabs (owner, 2026-11-08): it starts on Deliver, each tab plays its round
 *  while the line under it fills - how long until the next one opens - and when the round has
 *  played the next tab opens, round and round. A visitor who takes a screen over (presses or
 *  types in it) keeps it: the tour stops there, the line stands full, until a tab is chosen,
 *  which starts the tour again from that tab. The time counts only while the demo is on
 *  screen. With less motion asked for nothing plays, so nothing moves on. */
function useTour(tab: TabId, setTab: (t: TabId) => void, stage: React.RefObject<HTMLElement>, prog: React.RefObject<HTMLElement>) {
  const [auto, setAuto] = useState(() => !prefersLessMotion());
  const ended = useRef(false);
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const cycle = useMemo<Cycle>(
    () => ({
      roundEnd: () => {
        if (autoRef.current) ended.current = true;
      },
      takeover: () => setAuto(false),
    }),
    [],
  );

  useEffect(() => {
    const bar = prog.current;
    const el = stage.current;
    if (!bar || !el) return;
    ended.current = false;
    if (!auto) {
      bar.style.transform = "scaleX(1)";
      return;
    }
    const round = ROUND_MS[tab];
    const total = round.phone && matchMedia("(max-width:600px)").matches ? round.phone : round.wide;
    let inView = false;
    const io = new IntersectionObserver((es) => (inView = es[0].isIntersecting), { threshold: 0.25 });
    io.observe(el);
    let elapsed = 0;
    let last = performance.now();
    let doneAt = 0;
    let shown = 0;
    let raf = 0;
    const frame = (now: number) => {
      const dt = now - last;
      last = now;
      if (inView) elapsed += dt;
      // The round's time is up: move on even if the screen has not said so, so the tour never
      // hangs on a screen whose round runs long.
      if (elapsed >= total) ended.current = true;
      // Fills over the round's length - or runs full sooner if the screen says it is done -
      // then holds a moment.
      const goal = ended.current ? 1 : Math.min(0.96, elapsed / total);
      shown += (goal - shown) * Math.min(1, ended.current ? dt / 160 : 1);
      bar.style.transform = `scaleX(${shown.toFixed(4)})`;
      if (ended.current && !doneAt) doneAt = now;
      if (doneAt && now - doneAt > HOLD_MS) {
        const i = TABS.findIndex((x) => x.id === tab);
        setTab(TABS[(i + 1) % TABS.length].id);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    bar.style.transform = "scaleX(0)";
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [tab, auto, setTab, stage, prog]);

  return { cycle, choose: (t: TabId) => (setAuto(!prefersLessMotion()), setTab(t)) };
}

export function Showcase() {
  const [tab, setTab] = useState<TabId>("deliver");
  const stageRef = useRef<HTMLDivElement>(null);
  const progRef = useRef<HTMLSpanElement>(null);
  const { cycle, choose } = useTour(tab, setTab, stageRef, progRef);
  const lang = useLang();
  const tr = useT();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ left: 0, width: 0 });

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
    <section className="showcase" aria-label={tr("The platform", "Platforma")}>
      <div className="wrap" id="try">
        <div className="stage" ref={stageRef}>
          <div className="tabs" role="tablist" aria-label={tr("Screens of appolino", "Obrazovky appolina")} ref={tabsRef}>
            {TABS.map((x) => (
              <button key={x.id} role="tab" id={`tab-${x.id}`} aria-selected={tab === x.id} aria-controls="screen" onClick={() => choose(x.id)}>
                {tr(x.en, x.cs)}
              </button>
            ))}
            {/* The line under the active tab: how far its round has played until the next tab opens. */}
            <span className="tab-ind" style={ind} aria-hidden>
              <span className="tab-prog" ref={progRef} />
            </span>
          </div>
          <div className="win-wrap app">
            {/* Keyed by the language too: a switch starts the screen afresh in the other
                language, its example data with it. */}
            <div className="win app" role="tabpanel" id="screen" aria-labelledby={`tab-${tab}`} key={`${tab}-${lang}`}>
              <CycleCtx.Provider value={cycle}>{t.screen()}</CycleCtx.Provider>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

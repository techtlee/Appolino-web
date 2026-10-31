import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import mark from "../assets/appolino-mark.svg";
import { runSun } from "./sunField";
import { prefersLessMotion } from "../motion";
import { ImportPanel } from "./Import";
import { ValidatePanel } from "./Demo";
import { TransformPanel } from "./Transform";
import { ChecksPanel } from "./Checks";
import { AskPanel } from "./Ask";
import { PipelinePanel } from "./Flow";
import { JobsPanel } from "./Runs";
import { AccessPanel } from "./Access";

type TabId = "import" | "validate" | "checks" | "transform" | "ask" | "pipelines" | "jobs" | "access";

/** Each tab is a screen of the app: which rail item it lives under, its
 *  breadcrumb, and the live panel it shows. */
const TABS: { id: TabId; label: string; rail: string; crumbs: string[]; panel: (go: (t: TabId) => void) => ReactNode }[] = [
  { id: "import", label: "Import", rail: "Tables", crumbs: ["Tables", "Upload a file"], panel: (go) => <ImportPanel onNext={() => go("validate")} /> },
  { id: "validate", label: "Validate", rail: "Tables", crumbs: ["Tables", "Faktury", "Validate"], panel: () => <ValidatePanel /> },
  { id: "checks", label: "Checks", rail: "Checks", crumbs: ["Checks", "Faktury"], panel: () => <ChecksPanel /> },
  { id: "transform", label: "Transform", rail: "Results", crumbs: ["Results", "New result table", "from Faktury"], panel: () => <TransformPanel /> },
  { id: "ask", label: "\u2726 Ask", rail: "Tables", crumbs: ["Tables", "Faktury", "\u2726 Ask"], panel: () => <AskPanel /> },
  { id: "pipelines", label: "Pipelines", rail: "Pipelines", crumbs: ["Pipelines", "Monthly invoices"], panel: () => <PipelinePanel /> },
  { id: "jobs", label: "Jobs", rail: "Jobs", crumbs: ["Jobs"], panel: () => <JobsPanel /> },
  { id: "access", label: "Access", rail: "Tables", crumbs: ["Tables", "Faktury", "Who sees what"], panel: () => <AccessPanel /> },
];

/** Rail items that open a screen of the demo; the rest are shown, not live. */
const RAIL_TAB: Record<string, TabId> = { Tables: "import", Results: "transform", Checks: "checks", Pipelines: "pipelines", Jobs: "jobs" };

const RAIL: [string, string[]][] = [
  ["Workspace", ["Home", "Tables", "Results", "Checks"]],
  ["Automation", ["Pipelines", "Jobs", "Connections"]],
];

export function Showcase() {
  const [tab, setTab] = useState<TabId>("import");
  const tabsRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ left: 0, width: 0 });
  const sun = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (sun.current) return runSun(sun.current, prefersLessMotion());
  }, []);

  useLayoutEffect(() => {
    const place = () => {
      const b = tabsRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      if (b) setInd({ left: b.offsetLeft, width: b.offsetWidth });
    };
    place();
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, [tab]);

  const t = TABS.find((x) => x.id === tab)!;

  return (
    <section className="showcase" id="try">
      <div className="wrap">
        <span className="dawn-glow" aria-hidden />
        <canvas className="dawn" ref={sun} aria-hidden />
        <div className="tabs" role="tablist" aria-label="Screens of Appolino" ref={tabsRef}>
          {TABS.map((x) => (
            <button key={x.id} role="tab" id={`tab-${x.id}`} aria-selected={tab === x.id} aria-controls="screen" onClick={() => setTab(x.id)}>
              {x.label}
            </button>
          ))}
          <span className="tab-ind" style={ind} aria-hidden />
        </div>
        <div className="win-wrap">
          <div className="win" role="tabpanel" id="screen" aria-labelledby={`tab-${tab}`}>
            <aside className="win-side" aria-label="Appolino navigation">
              <div className="win-org" aria-hidden>
                <img src={mark} alt="" />
                Severka a.s.
                <span>▾</span>
              </div>
              {RAIL.map(([grp, items]) => (
                <div key={grp}>
                  <div className="grp" aria-hidden>
                    {grp}
                  </div>
                  {items.map((it) =>
                    RAIL_TAB[it] ? (
                      <button
                        key={it}
                        className={`it${it === t.rail ? " on" : ""}`}
                        aria-current={it === t.rail ? "page" : undefined}
                        onClick={() => it !== t.rail && setTab(RAIL_TAB[it])}
                      >
                        <i />
                        {it}
                      </button>
                    ) : (
                      <div key={it} className="it off" aria-hidden>
                        <i />
                        {it}
                      </div>
                    ),
                  )}
                </div>
              ))}
              <div className="win-user" aria-hidden>
                <b>JN</b>
                Jana Nováková
              </div>
            </aside>
            <div className="win-main">
              <div className="win-bar">
                {t.crumbs.map((c, i) => (
                  <span key={c} className={i === t.crumbs.length - 1 ? "" : "crumb"}>
                    {i === t.crumbs.length - 1 ? <b>{c}</b> : c}
                    {i < t.crumbs.length - 1 && <span className="crumb"> / </span>}
                  </span>
                ))}
              </div>
              <div className="win-body" key={tab}>
                {t.panel(setTab)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

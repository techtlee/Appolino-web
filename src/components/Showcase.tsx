import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import mark from "../assets/appolino-mark.svg";
import { ValidatePanel } from "./Demo";
import { AskPanel } from "./Ask";
import { PipelinePanel } from "./Flow";
import { JobsPanel } from "./Runs";
import { AccessPanel } from "./Access";

type TabId = "validate" | "ask" | "pipelines" | "jobs" | "access";

/** Each tab is a screen of the app: which rail item it lives under, its
 *  breadcrumb, and the live panel it shows. */
const TABS: { id: TabId; label: string; rail: string; crumbs: string[]; panel: () => ReactNode }[] = [
  { id: "validate", label: "Validate", rail: "Tables", crumbs: ["Tables", "invoices_october.xlsx", "Validate"], panel: () => <ValidatePanel /> },
  { id: "ask", label: "✦ Ask", rail: "Tables", crumbs: ["Tables", "invoices_october.xlsx", "✦ Ask"], panel: () => <AskPanel /> },
  { id: "pipelines", label: "Pipelines", rail: "Pipelines", crumbs: ["Pipelines", "Monthly invoices"], panel: () => <PipelinePanel /> },
  { id: "jobs", label: "Jobs", rail: "Jobs", crumbs: ["Jobs"], panel: () => <JobsPanel /> },
  { id: "access", label: "Access", rail: "Tables", crumbs: ["Tables", "Staff"], panel: () => <AccessPanel /> },
];

const RAIL: [string, string[]][] = [
  ["Workspace", ["Home", "Tables", "Results", "Checks"]],
  ["Automation", ["Pipelines", "Jobs", "Connections"]],
];

export function Showcase() {
  const [tab, setTab] = useState<TabId>("validate");
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
  }, [tab]);

  const t = TABS.find((x) => x.id === tab)!;

  return (
    <section className="showcase" id="try">
      <div className="wrap">
        <span className="dawn-glow" aria-hidden />
        <span className="dawn" aria-hidden />
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
            <aside className="win-side" aria-hidden>
              <div className="win-org">
                <img src={mark} alt="" />
                Northwind Ltd
                <span>▾</span>
              </div>
              {RAIL.map(([grp, items]) => (
                <div key={grp}>
                  <div className="grp">{grp}</div>
                  {items.map((it) => (
                    <div key={it} className={`it${it === t.rail ? " on" : ""}`}>
                      <i />
                      {it}
                    </div>
                  ))}
                </div>
              ))}
              <div className="win-user">
                <b>JM</b>
                Jane Miller
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
                {t.panel()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

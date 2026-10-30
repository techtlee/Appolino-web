import { useEffect, useState } from "react";

const THEMES = [
  {
    id: "import",
    nav: "Import & check",
    lead: ["Get every spreadsheet into one place.", "Upload Excel and CSV, pick files from SharePoint and OneDrive, or connect a database. Validate tells you what does not add up before anyone builds on it."],
    subs: [
      ["Large files build in the background", "A window shows rows written and time taken. Leaving the page does not stop it, and several uploads close together are all read."],
      ["Validate names what it noticed", "Inconsistent values, duplicates, odd date formats and amounts stored as text. Fix… repairs each in one step you can undo."],
    ],
    vis: <ImportVis />,
  },
  {
    id: "transform",
    nav: "Transform & Ask",
    lead: ["Turn tables into results without a ticket to IT.", "Lookup, Append, filters and formulas as steps; plain SQL when you want it. Ask writes the step for you, and you check it first."],
    subs: [
      ["Steps you can undo", "Every change is a step in the Steps panel. Take one out, keep it, or add another; the result recalculates itself."],
      ["✦ Ask proposes, you decide", "Say what you want in a sentence. Ask answers with a step and a preview. Nothing changes until you add it."],
    ],
    vis: <StepsVis />,
  },
  {
    id: "pipelines",
    nav: "Pipelines & Jobs",
    lead: ["Deliver on a schedule, with a gate in the middle.", "A pipeline imports, checks, transforms and writes back, hourly, daily or on weekdays only. When a check fails, the run is held as Blocked and says why."],
    subs: [
      ["A gate that holds bad data", "Your checks run before every write-back. A failed check stops the run before it sends wrong numbers on."],
      ["Jobs shows what ran", "Today's runs on one ruler, the last 14 days in figures, a live log for a run under way, and Retry now for a failed write-back."],
    ],
    vis: <LanesVis />,
  },
  {
    id: "access",
    nav: "Access & audit",
    lead: ["Know who can see what, and who did.", "Roles per project, personal columns restricted to admins, sign-in through Google or Microsoft, and an audit log for the whole organization."],
    subs: [
      ["Roles and restricted columns", "Viewer, editor, admin. Columns Appolino recognises as personal can be hidden from everyone but admins."],
      ["An audit log per organization", "Every sign-in, every member added or removed, every change, and every time someone looked at your data."],
    ],
    vis: <MatrixVis />,
  },
];

export function Platform() {
  const [on, setOn] = useState(THEMES[0].id);

  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setOn(e.target.id.replace("theme-", ""))),
      { rootMargin: "-35% 0px -55% 0px" },
    );
    THEMES.forEach((t) => {
      const el = document.getElementById(`theme-${t.id}`);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <section className="platform" id="platform">
      <div className="wrap">
        <nav className="pnav" aria-label="Platform themes">
          {THEMES.map((t) => (
            <a key={t.id} href={`#theme-${t.id}`} className={on === t.id ? "on" : ""}>
              {t.nav}
            </a>
          ))}
        </nav>
        <div className="themes">
          {THEMES.map((t) => (
            <article key={t.id} className="theme" id={`theme-${t.id}`}>
              <p className="lead">
                <b>{t.lead[0]}</b> {t.lead[1]}
              </p>
              <div className="vis">{t.vis}</div>
              <div className="subs">
                {t.subs.map(([h, d]) => (
                  <div key={h}>
                    <h3>{h}</h3>
                    <p>{d}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---- the drawings ---- */

function ImportVis() {
  return (
    <div className="mini-flow">
      <div className="files">
        <span className="chip"><span className="ext">XLSX</span>invoices_october.xlsx</span>
        <span className="chip"><span className="ext">CSV</span>customers.csv</span>
        <span className="chip"><span className="ext">SP</span>SharePoint › Finance › 2026</span>
        <span className="chip"><span className="ext">PG</span>erp.public.orders</span>
      </div>
      <div className="arrow" aria-hidden />
      <div className="mini-table">
        <div className="bar">
          invoices <span className="ok">✓ 1,284 rows checked</span>
        </div>
        <div className="grid-scroll">
          <table className="grid mini">
            <thead>
              <tr><th>customer</th><th>date</th><th className="num">amount</th></tr>
            </thead>
            <tbody>
              <tr><td>Northwind Timber Ltd.</td><td>2026-10-03</td><td className="num">12,840.00</td></tr>
              <tr><td>Mill Lane Bakery</td><td>2026-10-07</td><td className="num">5,699.00</td></tr>
              <tr><td>Green Yard plc</td><td>2026-10-07</td><td className="num">1,230.00</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StepsVis() {
  return (
    <div className="steps-card">
      <div className="hd">
        Steps · invoices_october <span>4 steps</span>
      </div>
      <div className="step-row"><span className="n">1</span><div><b>Lookup</b> <span>customers.vat → region</span></div><span className="act">Undo</span></div>
      <div className="step-row"><span className="n">2</span><div><b>Filter</b> <span>date in October 2026</span></div><span className="act">Undo</span></div>
      <div className="step-row"><span className="n">3</span><div><b>Formula</b> <span>status = overdue when due_date &lt; today</span></div><span className="act">Undo</span></div>
      <div className="step-row ask"><span className="n">✦</span><div><b>Ask</b> <span>“Total revenue by customer” → SQL result</span></div><span className="act"><b>Add step</b><span>Discard</span></span></div>
    </div>
  );
}

function LanesVis() {
  const lanes: [string, string, { at: number; k?: string }[]][] = [
    ["Nightly ERP sync", "hourly", [{ at: 4 }, { at: 16 }, { at: 28 }, { at: 40 }, { at: 52, k: "now" }, { at: 64, k: "due" }, { at: 76, k: "due" }, { at: 88, k: "due" }]],
    ["Sales report", "daily 07:00", [{ at: 22 }]],
    ["Invoice write-back", "weekdays 08:00", [{ at: 30, k: "held" }]],
    ["Stock levels to SharePoint", "daily 18:00", [{ at: 82, k: "due" }]],
  ];
  return (
    <div className="lanes">
      <div className="hours"><span /><div><span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div></div>
      {lanes.map(([n, s, marks]) => (
        <div className="lane" key={n}>
          <div className="nm">
            {n}
            <small>{s}</small>
          </div>
          <div className="ln">
            {marks.map((m, i) => (
              <span key={i} className={`mk ${m.k ?? ""}`} style={{ left: `${m.at}%` }} />
            ))}
          </div>
        </div>
      ))}
      <div className="legend">
        <span><i style={{ background: "var(--sun)" }} />Succeeded</span>
        <span><i style={{ background: "#FFF3DF" }} />Running</span>
        <span><i style={{ boxShadow: "inset 0 0 0 2px var(--sun)", opacity: 0.6 }} />Due later today</span>
        <span><i style={{ background: "var(--problem)" }} />Blocked by a check</span>
      </div>
    </div>
  );
}

function MatrixVis() {
  const cols = ["Read tables", "Edit & steps", "Pipelines", "Restricted columns", "Members"];
  const rows: [string, boolean[]][] = [
    ["Viewer", [true, false, false, false, false]],
    ["Editor", [true, true, true, false, false]],
    ["Admin", [true, true, true, true, true]],
  ];
  return (
    <div className="matrix-wrap">
      <table className="matrix">
        <thead>
          <tr>
            <th>Role</th>
            {cols.map((c) => <th key={c}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(([r, v]) => (
            <tr key={r}>
              <td>{r}</td>
              {v.map((x, i) => <td key={i} className={x ? "y" : "n"}>{x ? "✓" : "–"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

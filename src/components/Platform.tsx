import { useEffect, useRef, useState, type ReactNode } from "react";
import { prefersLessMotion, useSeen } from "../motion";

const THEMES: { id: string; nav: string; lead: [string, string]; subs: [string, string][]; vis: ReactNode }[] = [
  {
    id: "import",
    nav: "Import",
    lead: [
      "Get every spreadsheet into one place.",
      "Upload a file, or let a pipeline read SharePoint, OneDrive or Cloud Storage, including every new file that lands in a watched folder or mailbox. Appolino finds the header and reads the types itself.",
    ],
    subs: [
      ["16 file types, read by their content", "Excel, OpenDocument, CSV, tab-separated and fixed-width text, ISDOC e-invoices, and camt, MT940 and GPC bank statements. A file that is not what its name says is refused in a sentence."],
      ["Large files build in the background", "A window counts rows written and time taken. Leaving the page does not stop it, and each build is one transaction, so a table is never half-written."],
    ],
    vis: <ImportVis />,
  },
  {
    id: "transform",
    nav: "Transform",
    lead: [
      "Steps anyone can read, results that keep themselves current.",
      "Lookup, Append, Pivot, Unpivot, Split, Filter and calculated columns are steps with plain-language options. Saved as a result, the chain becomes a real table that rebuilds whenever a table it reads changes.",
    ],
    subs: [
      ["Lookup by date, not just by key", "Match an exchange rate or a price list valid on the row's date: on or before, after, or the period that contains it. If several match, keep the first, the latest, or a total."],
      ["Where this number comes from", "Click any value in a result to see its source table, row and the edits made to it since import. SQL is there for those who want it, guarded to one read-only SELECT."],
    ],
    vis: <TransformVis />,
  },
  {
    id: "pipelines",
    nav: "Schedule",
    lead: [
      "Runs while you sleep, and refuses to send bad data.",
      "Every 15 minutes, hourly, daily, weekly or monthly, in your time zone, weekdays only if you like. Five gates sit between the file and the destination; a blocked run delivers nothing and says why.",
    ],
    subs: [
      ["Folder and mailbox intake", "Each new file in a watched folder, or attached to a mail from an approved sender, is one run, oldest first. A file already loaded is recognised by its content and refused."],
      ["Told once, not flooded", "Email, Teams, Slack or a signed webhook: one message when a pipeline breaks, one when it recovers. Messages carry a name and a link, never data."],
    ],
    vis: <DayVis />,
  },
  {
    id: "deliver",
    nav: "Deliver",
    lead: [
      "Deliver exactly the way the destination needs it.",
      "Publish to the project's PostgreSQL schema that Power BI and other BI tools read, to BigQuery, or as Excel, CSV or JSON to SharePoint and Cloud Storage. Or write a table back into the Excel file it came from.",
    ],
    subs: [
      ["Four write modes", "Overwrite, Replace partition by period, Upsert on key columns, or Append. Duplicate keys in one load are refused before anything is written."],
      ["A receipt for every load", "Each delivered row is stamped with its run, and each successful run writes a load record: rows sent, periods, and checks passed and failed."],
    ],
    vis: <DeliverVis />,
  },
  {
    id: "access",
    nav: "Access & audit",
    lead: [
      "Know who can see what, and who did what.",
      "Roles per project, groups, row rules and restricted columns, sign-in through Google or Microsoft with optional MFA, and an audit log that keeps every change with the value before and after.",
    ],
    subs: [
      ["Restricted all the way down", "A column hidden from someone is hidden in results, SQL, pipelines and run logs too, and the same rules apply inside PostgreSQL for BI tools."],
      ["Audit-ready", "Every sign-in, change, export, and every time an Appolino operator opened your data. Kept 2 years by default, up to the 10 years Czech accounting rules ask for."],
    ],
    vis: <MatrixVis />,
  },
];

export function Platform() {
  const [on, setOn] = useState(THEMES[0].id);

  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setOn(e.target.id.replace("theme-", ""))), { rootMargin: "-35% 0px -55% 0px" });
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
              <Vis>{t.vis}</Vis>
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

/** A drawing's frame: it plays once a third of it is in view. */
function Vis({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.3);
  return (
    <div ref={ref} className={`vis${seen ? " on" : ""}`}>
      {children}
    </div>
  );
}

/* ---- Import: files flow in, types are read ---- */
function ImportVis() {
  const files: [string, string][] = [
    ["XLSX", "faktury_rijen_2026.xlsx"],
    ["CSV", "zakaznici.csv"],
    ["ISDOC", "FV2026101.isdoc"],
    ["GPC", "vypis_2026_10.gpc"],
    ["SP", "SharePoint › Finance › Faktury"],
    ["✉", "faktury@severka.cz · 2 new"],
  ];
  const cols: [string, string][] = [
    ["Datum", "Date"],
    ["Částka", "Decimal"],
    ["Zaplaceno", "Boolean"],
    ["IČO", "Text"],
    ["PSČ", "Text"],
  ];
  return (
    <div className="flowvis">
      <div className="files">
        {files.map(([e, n], i) => (
          <span key={n} className="chip" style={{ animationDelay: `${i * 0.12}s` }}>
            <span className="ext">{e}</span>
            {n}
          </span>
        ))}
      </div>
      <div className="pipe" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="mini-table">
        <div className="bar">
          Faktury <span className="ok">✓ 1 284 rows · header on row 4</span>
        </div>
        <div className="tcol" style={{ padding: "14px" }}>
          {cols.map(([c, t], i) => (
            <span key={c} style={{ display: "contents" }}>
              <span className="t">{c}</span>
              <span className={`type-tag t-${t.toLowerCase()}`} style={{ animationDelay: `${0.9 + i * 0.18}s`, justifySelf: "start" }}>
                Auto ({t})
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- Transform: steps, a cascade of rebuilds, and lineage ---- */
const EUR = [
  { no: "FV-2026-101", date: "2026-10-03", czk: "12 840,00", rate: "24,355", eur: "527,20", row: 5 },
  { no: "FV-2026-102", date: "2026-10-03", czk: "5 699,00", rate: "24,355", eur: "234,00", row: 6 },
  { no: "FV-2026-104", date: "2026-10-07", czk: "6 000,00", rate: "24,410", eur: "245,80", row: 7 },
];
function TransformVis() {
  const [phase, setPhase] = useState(0); // 0 idle, 1 edited, 2 eur rebuilding, 3 eur done, 4 monthly rebuilding, 5 done
  const [sel, setSel] = useState<number | null>(2);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const edit = () => {
    timers.current.forEach(clearTimeout);
    if (prefersLessMotion()) return setPhase(5);
    setPhase(1);
    [2, 3, 4, 5].forEach((p, i) => timers.current.push(window.setTimeout(() => setPhase(p), 500 + i * 650)));
  };
  const st = (building: number, done: number) => (phase === building ? "Rebuilding…" : phase >= done ? "Succeeded · just now" : "Succeeded · 3 h ago");

  return (
    <div className="lineage">
      <div className="lin-graph">
        <div className="lin-src">
          <div className={`lin-node${phase === 1 ? " edited" : ""}`}>
            <b>Faktury</b>
            <small>table · 1 284 rows</small>
            <span className="st">{phase >= 1 ? "Petr edited a cell" : "Imported Friday"}</span>
          </div>
          <div className="lin-node">
            <b>Kurzy ČNB</b>
            <small>table · daily rates</small>
          </div>
        </div>
        <div className={`lin-edge${phase === 2 ? " go" : ""}`} aria-hidden key={`e1${phase === 2}`} />
        <div className={`lin-node${phase === 2 || phase === 3 ? " hot" : ""}`}>
          <b>Faktury v EUR</b>
          <small>result</small>
          <span className="lin-steps">
            <span>Lookup by date</span>
            <span>Calculated column</span>
          </span>
          <span className="st">{st(2, 3)}</span>
        </div>
        <div className={`lin-edge${phase === 4 ? " go" : ""}`} aria-hidden key={`e2${phase === 4}`} />
        <div className={`lin-node${phase >= 4 ? " hot" : ""}`}>
          <b>Tržby po měsících</b>
          <small>result</small>
          <span className="lin-steps">
            <span>Pivot by month</span>
          </span>
          <span className="st">{st(4, 5)}</span>
        </div>
      </div>
      <div className="row" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn2 sm" onClick={edit}>
          Edit a cell in Faktury
        </button>
        <span className="note">Parents rebuild before children; results already current are skipped.</span>
      </div>
      <div className="lin-bottom">
        <div className="grid-scroll">
          <table className="grid mini lin-table">
            <thead>
              <tr>
                <th>Invoice no.</th>
                <th>Date</th>
                <th className="num">CZK</th>
                <th className="num">Rate</th>
                <th className="num">EUR</th>
              </tr>
            </thead>
            <tbody>
              {EUR.map((r, i) => (
                <tr key={r.no}>
                  <td>{r.no}</td>
                  <td>{r.date}</td>
                  <td className="num">{r.czk}</td>
                  <td className="num">{r.rate}</td>
                  <td className={`num click${sel === i ? " sel" : ""}`} onClick={() => setSel(i)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSel(i)}>
                    {r.eur}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 8 }}>
            Click a EUR value.
          </p>
        </div>
        {sel !== null && (
          <div className="lin-card" key={sel}>
            <h4>Where this number comes from</h4>
            <dl>
              <dt>Source</dt>
              <dd>Faktury · sheet Faktury · row {EUR[sel].row}</dd>
              <dt>Amount</dt>
              <dd>{EUR[sel].czk} CZK</dd>
              <dt>Rate</dt>
              <dd>Kurzy ČNB, valid on or before {EUR[sel].date}</dd>
            </dl>
            <p className="hist">{sel === 2 ? "Petr changed Amount: “6k” → 6 000,00 · 2 days ago" : "No edits since import."}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Schedule: a day on one ruler, the clock moving across it ---- */
const LANES: { n: string; s: string; at: number[]; held?: number }[] = [
  { n: "Bank statements", s: "every 6 hours", at: [2, 27, 52, 77] },
  { n: "Monthly invoices", s: "weekdays 06:00", at: [25], held: 25 },
  { n: "Sales report", s: "daily 07:30", at: [31] },
  { n: "Ceník write-back", s: "hourly at :15", at: [9, 30, 51, 72, 93] },
];
function DayVis() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.3);
  const [now, setNow] = useState(prefersLessMotion() ? 60 : 0);
  useEffect(() => {
    if (!seen || prefersLessMotion()) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      setNow(((t - start) / 90) % 100);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen]);
  return (
    <div className="lanes day" ref={ref}>
      <div className="hours">
        <span />
        <div>
          <span>0:00</span>
          <span>6:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>
      </div>
      <div className="lanes-box">
        {LANES.map((l) => (
          <div className="lane" key={l.n}>
            <div className="nm">
              {l.n}
              <small>{l.s}</small>
            </div>
            <div className="ln">
              {l.at.map((a) => {
                const k = a > now ? "due" : now - a < 4 ? "now just" : l.held === a ? "held" : "";
                return <span key={a} className={`mk ${k}`} style={{ left: `${a}%` }} />;
              })}
            </div>
          </div>
        ))}
        <div className="lane" aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", alignItems: "stretch" }}>
          <span />
          <div style={{ position: "relative" }}>
            <span className="now-line" style={{ left: `${now}%` }} />
          </div>
        </div>
      </div>
      <div className="legend">
        <span>
          <i style={{ background: "var(--sun)" }} />
          Succeeded
        </span>
        <span>
          <i style={{ background: "#FFF3DF" }} />
          Running
        </span>
        <span>
          <i style={{ boxShadow: "inset 0 0 0 2px var(--sun)", opacity: 0.6 }} />
          Due later today
        </span>
        <span>
          <i style={{ background: "var(--problem)" }} />
          Blocked by a gate
        </span>
      </div>
    </div>
  );
}

/* ---- Deliver: one load, four write modes ---- */
type WRow = { k: string; p: string; v: string; cls?: string };
const DEST: WRow[] = [
  { k: "FV-2026-090", p: "2026-09", v: "4 210,00" },
  { k: "FV-2026-095", p: "2026-09", v: "8 900,00" },
  { k: "FV-2026-101", p: "2026-10", v: "12 840,00" },
  { k: "FV-2026-102", p: "2026-10", v: "5 699,00" },
];
const LOAD: WRow[] = [
  { k: "FV-2026-101", p: "2026-10", v: "12 840,00" },
  { k: "FV-2026-102", p: "2026-10", v: "5 899,00" },
  { k: "FV-2026-104", p: "2026-10", v: "6 000,00" },
];
const MODES: { id: string; label: string; desc: string; out: () => WRow[] }[] = [
  { id: "overwrite", label: "Overwrite", desc: "Replaces the entire table on every run. September is gone.", out: () => [...DEST.map((r) => ({ ...r, cls: "w-gone" })), ...LOAD.map((r) => ({ ...r, cls: "w-new" }))] },
  {
    id: "partition",
    label: "Replace partition",
    desc: "Overwrites only the periods in the load, by Period; September is kept.",
    out: () => [...DEST.map((r) => (r.p === "2026-10" ? { ...r, cls: "w-gone" } : r)), ...LOAD.map((r) => ({ ...r, cls: "w-new" }))],
  },
  {
    id: "upsert",
    label: "Upsert",
    desc: "Updates rows matched on Invoice no. and inserts new ones. FV-2026-102 is updated, FV-2026-104 added.",
    out: () => [...DEST.map((r) => (r.k === "FV-2026-102" ? { ...r, v: "5 899,00", cls: "w-upd" } : r)), { ...LOAD[2], cls: "w-new" }],
  },
  { id: "append", label: "Append", desc: "Inserts all rows; nothing existing is modified. Two invoices are now there twice.", out: () => [...DEST, ...LOAD.map((r) => ({ ...r, cls: DEST.some((d) => d.k === r.k) ? "w-dup" : "w-new" }))] },
];
function DeliverVis() {
  const [m, setM] = useState("upsert");
  const M = MODES.find((x) => x.id === m)!;
  const table = (rows: WRow[], key: string) => (
    <table className="grid mini" key={key}>
      <thead>
        <tr>
          <th>invoice_no</th>
          <th>period</th>
          <th className="num">amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.k + i} className={r.cls ?? ""} style={{ animationDelay: `${i * 0.06}s` }}>
            <td>{r.k}</td>
            <td>{r.p}</td>
            <td className="num">{r.v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="wmodes">
      <div className="wm-top">
        <div className="seg sm" role="radiogroup" aria-label="Write mode">
          {MODES.map((x) => (
            <button key={x.id} role="radio" aria-checked={m === x.id} onClick={() => setM(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <span className="label">PostgreSQL · p_severka_p.invoices</span>
      </div>
      <p className="wm-desc" key={m + "d"}>
        {M.desc}
      </p>
      <div className="wm-cols">
        <div>
          <p className="label" style={{ marginBottom: 6 }}>
            This run's load
          </p>
          {table(LOAD, "load")}
        </div>
        <span className="arrow" aria-hidden />
        <div>
          <p className="label" style={{ marginBottom: 6 }}>
            invoices, after the run
          </p>
          {table(M.out(), m)}
        </div>
      </div>
    </div>
  );
}

/* ---- Access: the roles at a glance ---- */
function MatrixVis() {
  const cols = ["Read & chart", "Build & change", "Pipelines", "Restricted columns", "People & settings"];
  const rows: [string, (boolean | string)[]][] = [
    ["Viewer", [true, false, "read", "via group", false]],
    ["Editor", [true, true, true, "via group", false]],
    ["Admin", [true, true, true, true, true]],
  ];
  return (
    <div className="matrix-wrap">
      <table className="matrix">
        <thead>
          <tr>
            <th>Role</th>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([r, v]) => (
            <tr key={r}>
              <td>{r}</td>
              {v.map((x, i) => (
                <td key={i} className={x === true ? "y" : x === false ? "n" : ""}>
                  {x === true ? "✓" : x === false ? "–" : x}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

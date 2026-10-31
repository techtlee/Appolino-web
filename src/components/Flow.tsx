import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { prefersLessMotion, useSeen } from "../motion";

/**
 * A run of a pipeline with its quality gates, as Appolino runs one: Load,
 * Validate schema, Refresh results, Run quality checks, Deliver. Pick what the
 * month's file looks like and which gates are on; a gate that holds the run
 * delivers nothing, and the destination keeps its last good load.
 */

type Scenario = "clean" | "negative" | "shrink" | "drift";
type Gates = { checks: boolean; shrink: boolean; drift: "add" | "stop"; refresh: boolean };
type NodeState = "idle" | "run" | "ok" | "held" | "warn" | "skip";
type Ev = { at: number; stage: number; state: NodeState; log: [string, string][] };
type Outcome = { kind: "ok" | "held"; title: string; body: string; action?: string; notify: string };

const STAGES = ["Load", "Validate schema", "Refresh results", "Run quality checks", "Deliver"];
const SCENARIOS: { id: Scenario; label: string; hint: string }[] = [
  { id: "clean", label: "October file", hint: "1 284 rows, as expected" },
  { id: "negative", label: "A negative amount", hint: "FV-2026-107 · −1 230,00" },
  { id: "shrink", label: "Half the rows gone", hint: "616 rows instead of 1 284" },
  { id: "drift", label: "A new column", hint: "the file now has “Region”" },
];

function plan(sc: Scenario, g: Gates, accepted: boolean): { evs: Ev[]; out: Outcome } {
  const evs: Ev[] = [];
  let at = 300;
  const step = (stage: number, state: NodeState, log: [string, string][]) => {
    evs.push({ at, stage, state: "run", log: [] });
    evs.push({ at: at + 650, stage, state, log });
    at += 900;
  };
  const hold = (title: string, body: string, notify: string, action?: string): { evs: Ev[]; out: Outcome } => ({
    evs,
    out: { kind: "held", title, body: `${body} No data was delivered; invoices keeps the last successful load (Fri 06:02).`, action, notify },
  });

  evs.push({ at: 0, stage: -1, state: "idle", log: [["INFO", "Run started - pipeline “Monthly invoices”."]] });

  // Load: the file is read into the table; two gates look at it here.
  const rows = sc === "shrink" ? "616" : "1 284";
  const loadLog: [string, string][] = [["INFO", `Reading “faktury_rijen.xlsx” into table “Faktury” (upsert on Invoice no.). ${rows} rows.`]];
  if (sc === "shrink" && g.shrink) {
    step(0, "held", [...loadLog, ["ERROR", "This load would remove 52 % of the table's 1 284 rows - more than the 50 % the threshold allows."]]);
    return hold("Blocked by the row count threshold", "The file has half the rows it had last month.", "Pipeline Monthly invoices blocked · the row count threshold", "View logs");
  }
  if (sc === "shrink") loadLog.push(["WARN", "This load removes 52 % of the rows. The threshold is off, so the run goes on."]);
  if (sc === "drift" && g.drift === "stop" && !accepted) {
    step(0, "held", [...loadLog, ["ERROR", "The file's columns changed: a new column “Region”. This pipeline stops the load."]]);
    return hold("Blocked: the file's columns changed", "The file has a new column, “Region”.", "Pipeline Monthly invoices blocked · schema drift", "Accept and run again");
  }
  if (sc === "drift") loadLog.push(["INFO", "New column “Region” added at the end of “Faktury”."]);
  loadLog.push(["INFO", sc === "shrink" ? "Merged into the table: updated=616, inserted=0." : "Merged into the table: updated=1201, inserted=83."]);
  step(0, sc === "shrink" ? "warn" : "ok", loadLog);

  step(1, "ok", [["INFO", "Validating table “Faktury”… 5 rules, every value fits its column."]]);

  if (g.refresh) step(2, "ok", [["INFO", "Refreshing results: “Faktury v EUR”, then “Tržby po měsících”."]]);
  else step(2, "skip", [["INFO", "Refresh results is off; delivering the results as they are."]]);

  if (sc === "negative" && g.checks) {
    step(3, "held", [
      ["INFO", "Running the checks on “Faktury” and 2 results… 6 checks."],
      ["ERROR", "Not negative · Amount (CZK) · 1 row fails: FV-2026-107."],
    ]);
    return hold("Blocked by a failing check", "Not negative · Amount (CZK) found 1 row it does not allow.", "Pipeline Monthly invoices blocked · a failing check", "View check");
  }
  step(
    3,
    sc === "negative" ? "warn" : "ok",
    sc === "negative"
      ? [
          ["INFO", "Running the checks on “Faktury” and 2 results… 6 checks."],
          ["WARN", "1 failing check ignored - this pipeline does not hold."],
        ]
      : [["INFO", "Running the checks on “Faktury” and 2 results… 6 checks, all pass."]],
  );

  step(4, "ok", [
    ["INFO", "Delivering 3 items to postgresql (upsert on invoice_no)…"],
    ["INFO", `Delivered: invoices ${sc === "shrink" ? "616" : "1 284"} rows, faktury_eur, trzby_po_mesicich.`],
    ["INFO", "Load audit record written."],
    ["INFO", "Run finished in 41 s."],
  ]);
  const warn = sc === "negative" ? " A failing check was ignored because the gate is off." : sc === "shrink" ? " Half the rows were removed because the threshold is off." : "";
  return {
    evs,
    out: {
      kind: "ok",
      title: sc === "drift" ? "Succeeded · the last run added “Region” to “Faktury”" : "Succeeded",
      body: `Power BI reads the new numbers from the published schema.${warn}`,
      notify: "",
    },
  };
}

const clock = (ms: number) => {
  const s = 1 + Math.floor(ms / 120);
  return `06:00:${String(s).padStart(2, "0")}`;
};

function upcoming(n: number) {
  const out: string[] = [];
  const d = new Date();
  d.setHours(6, 0, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  while (out.length < n) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) out.push(d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " 06:00");
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function PipelinePanel() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.35);
  const [sc, setSc] = useState<Scenario>("negative");
  const [g, setG] = useState<Gates>({ checks: true, shrink: true, drift: "stop", refresh: true });
  const [accepted, setAccepted] = useState(false);
  const [t, setT] = useState(-1);
  const [recovered, setRecovered] = useState(false);
  const wasHeld = useRef(false);
  const raf = useRef(0);
  const logRef = useRef<HTMLOListElement>(null);

  const { evs, out } = useMemo(() => plan(sc, g, accepted), [sc, g, accepted]);
  const end = evs[evs.length - 1].at + 400;

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    if (prefersLessMotion()) return setT(1e6);
    const start = performance.now();
    const tick = (now: number) => {
      setT(now - start);
      if (now - start < 9000) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (seen) play();
    return () => cancelAnimationFrame(raf.current);
  }, [seen, play, sc, g, accepted]);

  const finished = t >= end;
  useEffect(() => {
    if (!finished) return;
    setRecovered(wasHeld.current && out.kind === "ok");
    wasHeld.current = out.kind === "held";
  }, [finished, out.kind]);

  const states: NodeState[] = STAGES.map(() => "idle");
  const log: { at: number; lv: string; msg: string }[] = [];
  evs.forEach((e) => {
    if (e.at > t) return;
    if (e.stage >= 0) states[e.stage] = e.state;
    e.log.forEach(([lv, msg]) => log.push({ at: e.at, lv, msg }));
  });
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  const reached = states.reduce((r, s, i) => (s !== "idle" ? i : r), -1);
  const running = t >= 0 && !finished;
  const pill = running ? "Running" : finished ? (out.kind === "held" ? "Blocked" : "Succeeded") : "Live";

  const setScenario = (s: Scenario) => {
    setAccepted(false);
    setSc(s);
  };
  const toggle = (k: keyof Gates, v: Gates[keyof Gates]) => {
    setAccepted(false);
    setG((x) => ({ ...x, [k]: v }));
  };

  return (
    <div ref={ref}>
      <p className="panel-hint">Pick what this month's file looks like and which gates are on. A blocked run delivers nothing, and the destination keeps its last good load.</p>

      <div className="pl-head card">
        <div>
          <p className="pl-name">
            Monthly invoices <span className={`pill p-${pill.toLowerCase()}`}>{pill}</span>
          </p>
          <p className="label">Daily at 06:00 · Europe/Prague · weekdays only · Upcoming: {upcoming(3).join(", ")}</p>
        </div>
        <button className="btn sm" onClick={play} disabled={running}>
          {running ? "Running" : "Run now"}
        </button>
      </div>

      <div className="scn" role="radiogroup" aria-label="This month's file">
        {SCENARIOS.map((s) => (
          <button key={s.id} role="radio" aria-checked={sc === s.id} className={sc === s.id ? "on" : ""} onClick={() => setScenario(s.id)}>
            <b>{s.label}</b>
            <small>{s.hint}</small>
          </button>
        ))}
      </div>

      <div className="pl-flow">
        <div className="pl-end">
          <span className="chip-ext">SP</span>
          <div>
            <b>SharePoint</b>
            <small>Finance › Faktury › faktury_rijen.xlsx</small>
          </div>
        </div>
        <div className="pl-stages">
          <span className="pl-rail" aria-hidden>
            <span style={{ width: `${reached < 0 ? 0 : (reached / (STAGES.length - 1)) * 100}%` }} className={out.kind === "held" && finished ? "held" : ""} />
          </span>
          {STAGES.map((s, i) => (
            <div key={s} className={`pl-node n-${states[i]}`}>
              <i>{states[i] === "ok" ? "✓" : states[i] === "held" ? "!" : states[i] === "warn" ? "~" : states[i] === "skip" ? "–" : i + 1}</i>
              <span>{s}</span>
              {(i === 1 || i === 3 || i === 0) && <small className="gate">{i === 0 ? "gates: rows, columns" : "gate"}</small>}
            </div>
          ))}
        </div>
        <div className={`pl-end dest${finished ? (out.kind === "held" ? " kept" : " fresh") : ""}`} key={finished ? out.kind : "w"}>
          <span className="chip-ext">PG</span>
          <div>
            <b>PostgreSQL · invoices</b>
            <small>{finished ? (out.kind === "held" ? "Keeps Friday's load" : "Updated just now") : "Upsert on invoice_no"}</small>
          </div>
        </div>
      </div>

      {finished && (
        <div className={`outcome o-${out.kind}`}>
          <div>
            <p className="ot">{out.title}</p>
            <p className="ob">{out.body}</p>
          </div>
          {out.action === "Accept and run again" ? (
            <button className="btn sm" onClick={() => setAccepted(true)}>
              Accept and run again
            </button>
          ) : out.action ? (
            <span className="label">{out.action}</span>
          ) : null}
        </div>
      )}
      {finished && (out.kind === "held" || recovered) && (
        <p className="toast" key={out.kind}>
          <b>Teams</b> {out.kind === "held" ? out.notify : "Pipeline Monthly invoices recovered"} · sent once, with a link and no data
        </p>
      )}
      <div className="pl-body">
        <div className="card gates">
          <p className="label">Data quality gates</p>
          <label className="gate-row">
            <input type="checkbox" checked disabled />
            <span>
              <b>Schema validation</b> <em>Always on</em>
              <small>Values that do not match their column type block the run instead of being delivered as nulls.</small>
            </span>
          </label>
          <label className="gate-row">
            <input type="checkbox" checked={g.checks} onChange={(e) => toggle("checks", e.target.checked)} />
            <span>
              <b>Block on failed checks</b>
              <small>Applies to the table and every delivered result. 6 checks, 4 with error severity.</small>
            </span>
          </label>
          <label className="gate-row">
            <input type="checkbox" checked={g.shrink} onChange={(e) => toggle("shrink", e.target.checked)} />
            <span>
              <b>Row count threshold</b>
              <small>Block if a load would remove more than 50 % of existing rows.</small>
            </span>
          </label>
          <div className="gate-row">
            <span className="gate-ico" aria-hidden>⇆</span>
            <span>
              <b>When the file's columns change</b>
              <span className="seg sm" role="radiogroup" aria-label="When the file's columns change">
                <button role="radio" aria-checked={g.drift === "add"} onClick={() => toggle("drift", "add")}>
                  Add at the end
                </button>
                <button role="radio" aria-checked={g.drift === "stop"} onClick={() => toggle("drift", "stop")}>
                  Stop the load
                </button>
              </span>
              <small>A missing or renamed column always holds the load.</small>
            </span>
          </div>
          <label className="gate-row">
            <input type="checkbox" checked={g.refresh} onChange={(e) => toggle("refresh", e.target.checked)} />
            <span>
              <b>Refresh results before delivery</b>
              <small>Rebuilds “Faktury v EUR” and “Tržby po měsících” first.</small>
            </span>
          </label>
        </div>

        <div className="card logbox">
          <div className="log-top">
            <span className="label">Log · {log.length} lines</span>
            <span className="label">Times on your clock</span>
          </div>
          <ol className="log" aria-live="polite" ref={logRef}>
            {log.map((l, i) => (
              <li key={i} className={`lv-${l.lv.toLowerCase()}`}>
                <span className="ts">{clock(l.at)}</span>
                <span className="lv">{l.lv}</span>
                <span>{l.msg}</span>
              </li>
            ))}
            {running && <li className="cursor" aria-hidden />}
          </ol>
        </div>
      </div>

    </div>
  );
}

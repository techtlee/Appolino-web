import { useEffect, useRef, useState } from "react";
import embed from "vega-embed";
import type { TopLevelSpec } from "vega-lite";

/** Jobs' "Last 14 days" and today's runs: example runs, not anyone's account. */
const OUTCOMES = ["Succeeded", "Blocked", "Failed"] as const;
const COLORS = ["#E9A23B", "#6E7FA3", "#C96A6A"];
const SUCCEEDED = [12, 14, 13, 4, 3, 15, 14, 13, 14, 15, 4, 3, 14, 13];
const BLOCKED = [0, 1, 0, 0, 0, 2, 0, 1, 0, 0, 0, 0, 1, 0];
const FAILED = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1];

const DAYS = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(2026, 9, 17 + i);
  return { iso: `2026-10-${String(17 + i).padStart(2, "0")}`, label: `${d.getDate()} Oct` };
});

const VALUES = DAYS.flatMap((d, i) =>
  [SUCCEEDED[i], BLOCKED[i], FAILED[i]].map((n, k) => ({ day: d.label, iso: d.iso, outcome: OUTCOMES[k], order: k, runs: n })),
);

const FONT = "Google Sans Flex, Inter, system-ui, sans-serif";
const AXIS = { labelColor: "#717C94", labelFontSize: 12, domain: false, ticks: false, titleColor: "#717C94", titleFontWeight: 400 as const };

const spec: TopLevelSpec = {
  $schema: "https://vega.github.io/schema/vega-lite/v6.json",
  width: "container",
  height: 220,
  background: null as unknown as string,
  autosize: { type: "fit-x", contains: "padding" },
  data: { values: VALUES },
  params: [{ name: "pick", select: { type: "point", fields: ["outcome"] }, bind: "legend" }],
  mark: { type: "bar", cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3, width: { band: 0.66 } },
  encoding: {
    x: { field: "day", type: "ordinal", sort: { field: "iso" }, title: null, axis: { ...AXIS, labelAngle: 0, labelOverlap: true } },
    y: { field: "runs", type: "quantitative", stack: true, title: "Runs per day", axis: { ...AXIS, tickCount: 4, gridColor: "rgba(226,232,228,0.07)" } },
    color: {
      field: "outcome",
      type: "nominal",
      scale: { domain: [...OUTCOMES], range: COLORS },
      legend: { orient: "top", direction: "horizontal", title: null, labelColor: "#BCC5D8", labelFontSize: 13, symbolType: "circle", offset: 12 },
    },
    order: { field: "order" },
    opacity: { condition: { param: "pick", value: 1 }, value: 0.18 },
    tooltip: [
      { field: "day", title: "Day" },
      { field: "outcome", title: "Outcome" },
      { field: "runs", title: "Runs" },
    ],
  },
  config: { font: FONT, view: { stroke: null }, axis: { labelFont: FONT }, legend: { labelFont: FONT } },
};

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

type Run = {
  id: string;
  state: "Running" | "Succeeded" | "Blocked" | "Failed";
  kind: string;
  name: string;
  when: string;
  took: string;
  cause?: "Data" | "Source" | "Destination" | "Platform";
  reached: string;
  todo: string;
  log: [string, string][];
};
const WHO = { Data: "the table's owner acts", Source: "the connection's owner acts", Destination: "its admin acts", Platform: "Appolino's operators act" };
const RUNS: Run[] = [
  {
    id: "r1",
    state: "Running",
    kind: "Pipeline run · folder intake",
    name: "Bank statements",
    when: "just now",
    took: "0:12",
    reached: "Load",
    todo: "Nothing yet. The log fills in while it runs.",
    log: [
      ["INFO", "Run started - pipeline “Bank statements”."],
      ["INFO", "Looking in Finance › Výpisy for new files: 1 new, vypis_2026_10.gpc."],
      ["INFO", "Reading “vypis_2026_10.gpc” into table “Výpisy” (append). 214 entries."],
    ],
  },
  {
    id: "r2",
    state: "Blocked",
    kind: "Pipeline run",
    name: "Monthly invoices",
    when: "06:00",
    took: "18 s",
    cause: "Data",
    reached: "Run quality checks",
    todo: "A check found values it does not allow: fix them in the source, or change the check, then run it again. The next run is on Monday at 06:00.",
    log: [
      ["INFO", "Run started - pipeline “Monthly invoices”."],
      ["INFO", "Merged into the table: updated=1201, inserted=83."],
      ["INFO", "Running the checks on “Faktury” and 2 results… 6 checks."],
      ["ERROR", "Not negative · Amount (CZK) · 1 row fails: FV-2026-107."],
    ],
  },
  {
    id: "r3",
    state: "Failed",
    kind: "Reverse ETL",
    name: "Ceník → ceník.xlsx",
    when: "05:40",
    took: "3 s",
    cause: "Destination",
    reached: "Deliver",
    todo: "The file is open in Excel on someone's computer. Appolino tries again by itself, or press Retry now once it is closed.",
    log: [
      ["INFO", "Writing “Ceník” back into SharePoint › Obchod › ceník.xlsx."],
      ["WARN", "The file is locked for editing (423). Trying again in 1, 2, 5, 15… minutes."],
      ["ERROR", "Still locked after 4 tries."],
    ],
  },
  {
    id: "r4",
    state: "Succeeded",
    kind: "Recompute",
    name: "Tržby po měsících",
    when: "05:31",
    took: "2 s",
    reached: "Done",
    todo: "Nothing to do. Rebuilt because “Faktury v EUR” changed.",
    log: [
      ["INFO", "Rebuilding “Tržby po měsících” after “Faktury v EUR” changed."],
      ["INFO", "36 rows. The checks after the build: 2 pass."],
    ],
  },
];

function RunList() {
  const [open, setOpen] = useState<string | null>("r2");
  const [only, setOnly] = useState(false);
  const [retry, setRetry] = useState<"no" | "going" | "done">("no");
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="card runlist">
      <p className="label">Today · every run, sync, recompute and failed write-back, newest first</p>
      <ul>
        {RUNS.map((r) => {
          const st = r.id === "r3" && retry === "done" ? "Succeeded" : r.state;
          const isOpen = open === r.id;
          return (
            <li key={r.id} className={isOpen ? "on" : ""}>
              <button className="run-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>
                <span className={`pill p-${st.toLowerCase()}`}>{st}</span>
                <span className="rn-name">
                  <b>{r.name}</b>
                  <small>{r.kind}</small>
                </span>
                <span className="rn-cause">{r.cause && st !== "Succeeded" ? `Cause: ${r.cause}` : ""}</span>
                <span className="label">
                  {r.when} · {r.took}
                </span>
              </button>
              {isOpen && (
                <div className="run-tray">
                  <div className="tray-cols">
                    <div>
                      <p className="label">What happened</p>
                      <p>
                        Reached {r.reached}.{r.cause && st !== "Succeeded" ? ` Cause: ${r.cause}, so ${WHO[r.cause]}.` : ""}
                      </p>
                    </div>
                    <div>
                      <p className="label">What to do</p>
                      <p>{r.id === "r3" && retry === "done" ? "Written. The file on SharePoint has the new prices." : r.todo}</p>
                    </div>
                  </div>
                  <div className="log-top">
                    <span className="label">Log</span>
                    <label className="label chk">
                      <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Problems only
                    </label>
                  </div>
                  <ol className="log">
                    {r.log
                      .filter(([lv]) => !only || lv !== "INFO")
                      .map(([lv, m], i) => (
                        <li key={`${lv}${i}`} className={`lv-${lv.toLowerCase()}`}>
                          <span className="lv">{lv}</span>
                          <span>{m}</span>
                        </li>
                      ))}
                    {r.id === "r3" && retry === "done" && (
                      <li className="lv-info">
                        <span className="lv">INFO</span>
                        <span>Retry now: written, 412 rows.</span>
                      </li>
                    )}
                    {r.state === "Running" && <li className="cursor" aria-hidden />}
                  </ol>
                  {r.id === "r3" && retry !== "done" && (
                    <button
                      className="btn sm"
                      disabled={retry === "going"}
                      onClick={() => {
                        setRetry("going");
                        timer.current = window.setTimeout(() => setRetry("done"), 1400);
                      }}
                    >
                      {retry === "going" ? "Retrying" : "Retry now"}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function JobsPanel() {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let finalize: (() => void) | undefined;
    embed(box.current!, spec, { actions: false, renderer: "svg", tooltip: { theme: "dark" } })
      .then((r) => {
        finalize = r.finalize;
        if (!alive) r.finalize();
      })
      .catch(() => setFailed(true));
    return () => {
      alive = false;
      finalize?.();
    };
  }, []);

  const total = sum(SUCCEEDED) + sum(BLOCKED) + sum(FAILED);
  const figures = [
    { n: String(sum(BLOCKED)), t: "blocked by a gate before they sent bad data", c: "#6E7FA3" },
    { n: String(sum(FAILED)), t: "failed; each one says whose move it is", c: "#C96A6A" },
    { n: "38 s", t: "median run; slowest was Bank statements at 2 min 5 s", c: "transparent" },
  ];

  return (
    <>
      <p className="panel-hint">The last 14 days, then today's runs. Click a legend item to highlight it, open a run for its log, and retry the failed write-back. Example data.</p>
      <div className="runs">
        <div className="card chart-card">
          <div className="chart-top">
            <div>
              <p className="label">Last 14 days</p>
              <p className="big">
                {Math.round((sum(SUCCEEDED) / total) * 100)} % of {total} runs succeeded
              </p>
            </div>
          </div>
          {failed ? <p className="empty">The chart did not load.</p> : <div className="chart" ref={box} />}
        </div>
        <div className="run-figs">
          {figures.map((f) => (
            <div key={f.t} className="run-fig">
              <span className="dot" style={{ background: f.c }} />
              <p className="n">{f.n}</p>
              <p>{f.t}</p>
            </div>
          ))}
        </div>
      </div>
      <RunList />
    </>
  );
}

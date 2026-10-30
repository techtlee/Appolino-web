import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { prefersLessMotion, useSeen } from "../motion";

const STEPS = [
  {
    n: "Import",
    d: "A file from SharePoint, OneDrive or a database is loaded into a table. A large file builds in the background.",
    do: ["Excel, CSV, SharePoint, OneDrive, databases", "A window shows rows written and time taken", "Update an existing table in one step"],
    out: "A table in the project's database, not an attachment in an email.",
  },
  {
    n: "Check",
    d: "Validate and your own checks. When they fail, the gate stops the run before it sends bad numbers on.",
    do: ["Inconsistent values, duplicates, formats", "Your own rules over columns", "A gate that holds the run as Blocked"],
    out: "A run that stops itself, instead of a report that gets corrected afterwards.",
  },
  {
    n: "Transform",
    d: "Lookup, Append, filters, formulas and SQL. The result table recalculates itself.",
    do: ["Steps you can undo", "✦ Ask proposes a step, you check it", "Plain SQL for the advanced"],
    out: "A result that always shows what it came from.",
  },
  {
    n: "Deliver",
    d: "Write-back to a database, an export or a report at the time you set. Every run has its log in Jobs.",
    do: ["Hourly, daily or weekdays only", "Write-back with Retry now", "A log of every run in Jobs"],
    out: "Data where people need it, at the same time every morning.",
  },
];

type Spark = { id: string; step: number; n: number };
type Play = { scan: number; flag: boolean; fixed: boolean; fill: number; packet: number; ok: boolean[]; sparks: Spark[] };

const IDLE: Play = { scan: -1, flag: false, fixed: false, fill: 0, packet: -1, ok: [false, false, false, false], sparks: [] };
const DONE: Play = { ...IDLE, fixed: true, fill: 100, ok: [true, true, true, true] };
const STOPS = [0, 100 / 3, 200 / 3, 100];

/**
 * A pipeline run, played the way the app's home hero plays its check: a band
 * scans the steps and the gate holds the run as Blocked; then the data runs
 * the rail, each stop turns blue, and the held check passes.
 */
export function PipelinePanel() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.4);
  const [sel, setSel] = useState(1);
  const [dir, setDir] = useState<"n" | "p">("n");
  const [p, setP] = useState<Play>(IDLE);
  const timers = useRef<number[]>([]);

  const play = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (prefersLessMotion()) return setP(DONE);
    const at = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
    setP(IDLE);
    [0, 1, 2, 3].forEach((i) => at(300 + i * 400, () => setP((s) => ({ ...s, scan: i, flag: s.flag || i === 1 }))));
    at(1900, () => setP((s) => ({ ...s, scan: -1 })));
    STOPS.forEach((x, i) =>
      at(2300 + i * 700, () =>
        setP((s) => {
          const ok = s.ok.slice();
          ok[i] = true;
          const spark = { id: `${Date.now()}-${i}`, step: i, n: i === 3 ? 10 : 5 };
          return { ...s, packet: x, fill: x, ok, fixed: s.fixed || i === 1, sparks: [...s.sparks, spark] };
        }),
      ),
    );
    at(2300 + 3 * 700 + 600, () => setP((s) => ({ ...s, packet: -1 })));
  }, []);

  useEffect(() => {
    if (seen) play();
  }, [seen, play]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const choose = (i: number) => {
    setDir(i >= sel ? "n" : "p");
    setSel(i);
  };
  const held = (i: number) => i === 1 && p.flag && !p.fixed;
  const status = (i: number) => (held(i) ? "Blocked" : p.ok[i] ? (i === 1 ? "Passed" : "Done") : "");
  const s = STEPS[sel];

  return (
    <div ref={ref}>
        <p className="panel-hint">A run of the Monthly invoices pipeline. The check in the middle is a gate: when data fails it, the run is held and says why.</p>

        <div className="track" role="tablist" aria-label="Pipeline steps">
          <div className="rail" aria-hidden>
            <span className="fill" style={{ width: `${p.fill}%`, transition: "width .7s var(--ease)" }} />
            <span
              className="packet"
              style={{
                left: `${p.packet < 0 ? 100 : p.packet}%`,
                opacity: p.packet < 0 ? 0 : 1,
                transition: "left .7s var(--ease), opacity .25s ease",
              }}
            />
          </div>
          <span className="scan" aria-hidden style={{ left: `${Math.max(0, p.scan) * 25}%`, opacity: p.scan < 0 ? 0 : 1 }} />
          {STEPS.map((x, i) => (
            <button
              key={x.n}
              id={`step-${i}`}
              role="tab"
              aria-selected={sel === i}
              onClick={() => choose(i)}
              className={`step${p.ok[i] ? " ok" : ""}${held(i) ? " flag" : ""}`}
            >
              <span className="node">
                {p.ok[i] ? "✓" : i === 1 && p.flag ? "!" : i + 1}
                {p.sparks
                  .filter((sp) => sp.step === i)
                  .flatMap((sp) =>
                    Array.from({ length: sp.n }, (_, k) => {
                      const a = (k / sp.n) * Math.PI * 2;
                      const r = 22 + ((k * 7) % 14);
                      return (
                        <i
                          key={`${sp.id}-${k}`}
                          className="spark"
                          style={{ "--dx": `${Math.cos(a) * r}px`, "--dy": `${Math.sin(a) * r}px` } as CSSProperties}
                        />
                      );
                    }),
                  )}
              </span>
              <span className="nm">{x.n}</span>
              <span className="st">{status(i)}</span>
            </button>
          ))}
        </div>

        <div className="card detail" role="tabpanel" aria-labelledby={`step-${sel}`}>
          <div key={`a${sel}`} className={`in-${dir}`} style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <p className="label">Step {sel + 1} of 4</p>
            <h3 style={{ fontSize: 24 }}>{s.n}</h3>
            <p style={{ color: "var(--fg-3)" }}>{s.d}</p>
          </div>
          <div key={`b${sel}`} className={`in-${dir}`} style={{ display: "grid", gap: 16, animationDelay: ".04s" }}>
            <ul>
              {s.do.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="out">
              <p className="label">Outcome</p>
              <p style={{ color: "var(--fg)" }}>{s.out}</p>
            </div>
          </div>
        </div>

        <div className="proc-foot">
          <p className="note">Click a step to see what Appolino does in it.</p>
          <button className="ghost" onClick={play}>
            Run again <span className="ar">↻</span>
          </button>
        </div>
    </div>
  );
}

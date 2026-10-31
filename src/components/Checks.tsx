import { useEffect, useRef, useState } from "react";
import { czk, icoOk, plural } from "../czech";
import { prefersLessMotion } from "../motion";

/**
 * Checks as built: the project's own business rules, kept in an ordinary
 * project table called Checks. While a table has few checks, Appolino suggests
 * what the values already keep. Run checks runs them one at a time, shows how
 * many rows each found with up to three samples, and an error-level failure
 * holds the pipeline that delivers the table. The rows are invented.
 */

type Key = "no" | "customer" | "ico" | "date" | "czk" | "status";
type Row = Record<Key, string | number>;
type Kind = "notEmpty" | "unique" | "notNegative" | "oneOf" | "ico" | "minRows";
type Sev = "Error" | "Warning";
type Check = { id: string; col: Key | "*"; kind: Kind; value?: string; sev: Sev; msg: string; by: string };
type Result = { state: "running" | "pass" | "fail"; n: number; samples: Row[] };

const ROWS: Row[] = [
  { no: "FV-2026-101", customer: "Pekárna U Mlýna s.r.o.", ico: "27082440", date: "2026-10-03", czk: 12840, status: "Paid" },
  { no: "FV-2026-102", customer: "Zahradnictví Hájek", ico: "25596641", date: "2026-10-03", czk: 5699, status: "Open" },
  { no: "FV-2026-104", customer: "Truhlářství Novák", ico: "12345678", date: "2026-10-07", czk: 6000, status: "Open" },
  { no: "FV-2026-105", customer: "Kavárna Na Rohu", ico: "04512341", date: "2026-10-09", czk: 845, status: "Overdue" },
  { no: "FV-2026-106", customer: "Elektro Svoboda a.s.", ico: "27936520", date: "2026-10-12", czk: 3120.5, status: "Paid" },
  { no: "FV-2026-107", customer: "Pekárna U Mlýna s.r.o.", ico: "27082440", date: "2026-10-14", czk: -1230, status: "Open" },
];
const COLNAME: Record<Key | "*", string> = { no: "Invoice no.", customer: "Customer", ico: "IČO", date: "Date", czk: "Amount (CZK)", status: "Status", "*": "Whole table" };
const KINDS: Record<Kind, string> = {
  notEmpty: "Not empty",
  unique: "Unique",
  notNegative: "Not negative",
  oneOf: "One of",
  ico: "Matches pattern · IČO",
  minRows: "At least N rows",
};
/** Which kinds make sense for which column, as the drawer offers them. */
const FOR: Record<Key | "*", Kind[]> = {
  no: ["notEmpty", "unique"],
  customer: ["notEmpty"],
  ico: ["notEmpty", "ico"],
  date: ["notEmpty"],
  czk: ["notNegative", "notEmpty"],
  status: ["oneOf", "notEmpty"],
  "*": ["minRows"],
};

const START: Check[] = [{ id: "c0", col: "no", kind: "notEmpty", sev: "Error", msg: "Every invoice has a number", by: "Petr" }];
const SUGGESTED: (Check & { why: string })[] = [
  { id: "s1", col: "no", kind: "unique", sev: "Error", msg: "One row per invoice", by: "Suggested", why: "all values distinct" },
  { id: "s2", col: "status", kind: "oneOf", value: "Paid | Open | Overdue", sev: "Error", msg: "A known status", by: "Suggested", why: "3 values that want to be a Single select" },
  { id: "s3", col: "ico", kind: "ico", sev: "Warning", msg: "A real IČO", by: "Suggested", why: "values that look like an IČO" },
];

function evaluate(c: Check): Result {
  const bad = (r: Row): boolean => {
    const v = c.col === "*" ? "" : r[c.col];
    switch (c.kind) {
      case "notEmpty":
        return String(v).trim() === "";
      case "notNegative":
        return Number(v) < 0;
      case "oneOf":
        return !(c.value ?? "").split("|").map((x) => x.trim()).includes(String(v));
      case "ico":
        return !icoOk(String(v));
      case "unique":
        return ROWS.filter((x) => x[c.col as Key] === v).length > 1;
      default:
        return false;
    }
  };
  if (c.kind === "minRows") {
    const n = Number(c.value ?? 1);
    return { state: ROWS.length >= n ? "pass" : "fail", n: ROWS.length >= n ? 0 : 1, samples: [] };
  }
  const found = ROWS.filter(bad);
  return { state: found.length ? "fail" : "pass", n: found.length, samples: found.slice(0, 3) };
}

const rule = (c: Check) => `${KINDS[c.kind]}${c.value ? ` · ${c.value}` : ""}`;

export function ChecksPanel() {
  const [checks, setChecks] = useState<Check[]>(START);
  const [res, setRes] = useState<Record<string, Result>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<{ col: Key | "*"; kind: Kind; sev: Sev }>({ col: "czk", kind: "notNegative", sev: "Error" });
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const suggestions = SUGGESTED.filter((s) => !checks.some((c) => c.col === s.col && c.kind === s.kind));
  const ranAll = checks.length > 0 && checks.every((c) => res[c.id] && res[c.id].state !== "running");
  const failing = checks.filter((c) => res[c.id]?.state === "fail");
  const held = failing.some((c) => c.sev === "Error");
  const running = Object.values(res).some((r) => r.state === "running");

  /** Checks run one at a time per project. */
  const runAll = (list = checks) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const gap = prefersLessMotion() ? 0 : 420;
    setRes(Object.fromEntries(list.map((c) => [c.id, { state: "running", n: 0, samples: [] } as Result])));
    list.forEach((c, i) => timers.current.push(window.setTimeout(() => setRes((r) => ({ ...r, [c.id]: evaluate(c) })), gap * (i + 1))));
  };
  /** Adding a check writes it to the Checks table and runs it. */
  const add = (c: Check) => {
    const next = [...checks, c];
    setChecks(next);
    setRes((r) => ({ ...r, [c.id]: evaluate(c) }));
  };
  const flip = (id: string) => setChecks((cs) => cs.map((c) => (c.id === id ? { ...c, sev: c.sev === "Error" ? "Warning" : "Error" } : c)));
  const drop = (id: string) => {
    setChecks((cs) => cs.filter((c) => c.id !== id));
    if (open === id) setOpen(null);
  };

  const formKinds = FOR[form.col];
  const newCheck = (): Check => ({
    id: `n${Date.now()}`,
    col: form.col,
    kind: form.kind,
    value: form.kind === "minRows" ? "1" : undefined,
    sev: form.sev,
    msg: form.kind === "notNegative" ? "A fee is never negative" : `${COLNAME[form.col]}: ${KINDS[form.kind].toLowerCase()}`,
    by: "Jana",
  });
  const dupForm = checks.some((c) => c.col === form.col && c.kind === form.kind);

  return (
    <>
      <p className="panel-hint">The project's own rules, kept in a table called Checks. Add a suggestion or write a rule, run them, and switch a failing one between Error and Warning to see what the pipeline does.</p>
      <div className="chk-wrap">
        <div className="card grid-card">
          <div className="grid-bar">
            <span className="grid-name">Checks · Faktury</span>
            <button className="btn sm" disabled={running || !checks.length} onClick={() => runAll()}>
              {running ? "Running…" : "Run checks"}
            </button>
          </div>
          <div className="grid-scroll">
            <table className="grid chk-grid">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Check</th>
                  <th>Severity</th>
                  <th>Message</th>
                  <th className="num">Found</th>
                  <th aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => {
                  const r = res[c.id];
                  return (
                    <tr key={c.id} className={`row-in${open === c.id ? " sel" : ""}`}>
                      <td>{COLNAME[c.col]}</td>
                      <td>{rule(c)}</td>
                      <td>
                        <button
                          className={`sev-btn sev sev-${c.sev === "Error" ? "e" : "w"}`}
                          onClick={() => flip(c.id)}
                          title={c.sev === "Error" ? "Error: stops delivery. Click for Warning." : "Warning: report only. Click for Error."}
                        >
                          {c.sev} ⇄
                        </button>
                      </td>
                      <td className="txt trunc">{c.msg}</td>
                      <td className="num">
                        {!r ? (
                          <em>Not run</em>
                        ) : r.state === "running" ? (
                          <span className="chk-run">Running…</span>
                        ) : r.state === "pass" ? (
                          <span className="chk-ok">✓ Passed</span>
                        ) : (
                          <button className="chk-bad" onClick={() => setOpen(open === c.id ? null : c.id)}>
                            {c.kind === "minRows" ? "Failed" : `${r.n} ${plural(r.n, "row", "rows")}`} ▾
                          </button>
                        )}
                      </td>
                      <td>
                        <button className="ghost sm" aria-label={`Remove check ${rule(c)}`} onClick={() => drop(c.id)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="chk-legend note">
            <span className="sev sev-e">Error</span> stops delivery · <span className="sev sev-w">Warning</span> reports only. Click one to switch it.
          </p>
          {open && res[open]?.state === "fail" && (
            <div className="chk-samples" key={open}>
              <p className="label">
                {(() => {
                  const c = checks.find((x) => x.id === open)!;
                  return `${COLNAME[c.col]} · ${rule(c)} · ${res[open].n} ${plural(res[open].n, "row", "rows")} found, up to three shown`;
                })()}
              </p>
              <table className="grid mini">
                <tbody>
                  {res[open].samples.map((r) => (
                    <tr key={String(r.no)}>
                      <td>{r.no}</td>
                      <td className="trunc">{r.customer}</td>
                      <td>{r.ico}</td>
                      <td className={`num${Number(r.czk) < 0 ? " neg" : ""}`}>{czk(Number(r.czk))}</td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="chk-add">
            <p className="label">Add a check</p>
            <div className="chk-form">
              <select
                value={form.col}
                aria-label="Column"
                onChange={(e) => {
                  const col = e.target.value as Key | "*";
                  setForm({ ...form, col, kind: FOR[col][0] });
                }}
              >
                {(Object.keys(FOR) as (Key | "*")[]).map((k) => (
                  <option key={k} value={k}>
                    {COLNAME[k]}
                  </option>
                ))}
              </select>
              <select value={form.kind} aria-label="Check" onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>
                {formKinds.map((k) => (
                  <option key={k} value={k}>
                    {KINDS[k]}
                  </option>
                ))}
              </select>
              <div className="seg sm" role="radiogroup" aria-label="Severity">
                {(["Error", "Warning"] as const).map((s) => (
                  <button key={s} role="radio" aria-checked={form.sev === s} onClick={() => setForm({ ...form, sev: s })}>
                    {s}
                  </button>
                ))}
              </div>
              <button className="btn2 sm" disabled={dupForm} onClick={() => add(newCheck())}>
                {dupForm ? "Already a check" : "Add"}
              </button>
            </div>
            <p className="note">Also: At least, At most, Between, Matches IBAN, ISIN, e-mail or a regular expression, row counts, and Custom SQL that returns the offending rows.</p>
          </div>
        </div>

        <div className="chk-side">
          {suggestions.length > 0 && (
            <div className="glass chk-sugg">
              <p className="label">Suggested from what the values already keep</p>
              <ul>
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <div>
                      <b>{COLNAME[s.col]}</b>
                      <small>{s.why}</small>
                    </div>
                    <button className="btn2 sm" onClick={() => add({ ...s, id: s.id + Date.now() })}>
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={`glass chk-gate ${!ranAll ? "" : held ? "g-held" : "g-ok"}`} key={`${ranAll}-${held}-${failing.length}`}>
            <p className="label">Pipeline · Monthly invoices · weekdays 06:00</p>
            {!ranAll ? (
              <>
                <h3>Run the checks to see</h3>
                <p className="note">Checks also run after every result build, after a scheduled sync, on Validate and inside every pipeline run.</p>
              </>
            ) : held ? (
              <>
                <h3>Would be held</h3>
                <p>
                  {failing.filter((c) => c.sev === "Error").length} error-level {plural(failing.filter((c) => c.sev === "Error").length, "check fails", "checks fail")}. Nothing is delivered until the checks pass; invoices keeps its last good load.
                </p>
                <p className="note">Switch a failing check to Warning to deliver anyway and say what failed.</p>
              </>
            ) : failing.length ? (
              <>
                <h3>Would deliver, and say what failed</h3>
                <p>
                  {failing.length} {plural(failing.length, "warning", "warnings")} in the run log and one message to Teams, with a link and no data.
                </p>
              </>
            ) : (
              <>
                <h3>Would deliver</h3>
                <p>Every check passes. The load audit record lists them as passed.</p>
              </>
            )}
          </div>
          <p className="note chk-limits">Each check runs read-only and stops after 15 seconds. A check that cannot run counts as a failing error, so nothing unchecked is delivered.</p>
        </div>
      </div>
    </>
  );
}

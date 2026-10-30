import { useMemo, useState } from "react";

/**
 * Validate and Fix… on a small table, as Appolino does it: Validate names what
 * it noticed, a hover shows the cells, and each Fix is one step that can be
 * undone. The companies are invented.
 */

type Row = { id: number; customer: string; vat: string; date: string; amount: string | number };
type Col = "customer" | "vat" | "date" | "amount";
type Finding = { kind: string; title: string; detail: string; cells: [number, Col][]; fix: ((rows: Row[]) => Row[]) | null };

const RAW: Row[] = [
  { id: 1, customer: "Northwind Timber Ltd.", vat: "GB271456228", date: "3 Oct 2026", amount: "12,840.00" },
  { id: 2, customer: "NORTHWIND TIMBER LTD", vat: "GB271456228", date: "03/10/2026", amount: "12840" },
  { id: 3, customer: "Mill Lane Bakery", vat: "GB065123781", date: "2026-10-07", amount: "5,699.00" },
  { id: 4, customer: "Green Yard plc", vat: "", date: "7 Oct 2026", amount: "1,230.00 GBP" },
  { id: 5, customer: "Green Yard PLC", vat: "GB284511904", date: "2026-10-09", amount: "845.00" },
  { id: 6, customer: "Hillside Nursery", vat: "GB077332159", date: "2026-10-12", amount: 3120 },
];

const nameKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/(ltd|plc|inc)$/, "");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function toIso(s: string): string {
  if (ISO.test(s)) return s;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/);
  if (m) return `${m[3]}-${String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s;
}
const toNum = (v: string | number) => (typeof v === "number" ? v : Number(v.replace(/[^\d.]/g, "")));
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function validate(rows: Row[]): Finding[] {
  const out: Finding[] = [];

  const groups = new Map<string, Row[]>();
  rows.forEach((r) => groups.set(nameKey(r.customer), [...(groups.get(nameKey(r.customer)) ?? []), r]));
  const mixed = [...groups.values()].filter((g) => new Set(g.map((r) => r.customer)).size > 1);
  if (mixed.length)
    out.push({
      kind: "name",
      title: `${mixed.length} ${plural(mixed.length, "customer", "customers")} spelled differently`,
      detail: mixed.map((g) => [...new Set(g.map((r) => `“${r.customer}”`))].join(" and ")).join(", "),
      cells: mixed.flat().map((r) => [r.id, "customer"]),
      fix: (rs) => rs.map((r) => ({ ...r, customer: groups.get(nameKey(r.customer))![0].customer })),
    });

  const seen = new Set<string>();
  const dups: Row[] = [];
  rows.forEach((r) => {
    const k = [r.vat, toIso(r.date), toNum(r.amount)].join("|");
    if (seen.has(k)) dups.push(r);
    else seen.add(k);
  });
  if (dups.length)
    out.push({
      kind: "dup",
      title: `${dups.length} duplicate ${plural(dups.length, "row", "rows")}`,
      detail: "Same VAT number, date and amount. The first occurrence is kept.",
      cells: dups.flatMap((r) => (["customer", "vat", "date", "amount"] as Col[]).map((c): [number, Col] => [r.id, c])),
      fix: (rs) => rs.filter((r) => !dups.some((d) => d.id === r.id)),
    });

  const dates = rows.filter((r) => !ISO.test(r.date));
  if (dates.length)
    out.push({
      kind: "date",
      title: `${dates.length} ${plural(dates.length, "date", "dates")} in another format`,
      detail: `For example “${dates[0].date}”. Unified to YYYY-MM-DD.`,
      cells: dates.map((r) => [r.id, "date"]),
      fix: (rs) => rs.map((r) => ({ ...r, date: toIso(r.date) })),
    });

  const amounts = rows.filter((r) => typeof r.amount === "string");
  if (amounts.length)
    out.push({
      kind: "amount",
      title: `${amounts.length} ${plural(amounts.length, "amount", "amounts")} stored as text`,
      detail: "Commas and “GBP” stop them from adding up. Converted to numbers.",
      cells: amounts.map((r) => [r.id, "amount"]),
      fix: (rs) => rs.map((r) => ({ ...r, amount: toNum(r.amount) })),
    });

  const missing = rows.filter((r) => !r.vat);
  if (missing.length) {
    const from = (r: Row) => rows.find((o) => o.vat && nameKey(o.customer) === nameKey(r.customer))?.vat;
    const fillable = missing.some(from);
    out.push({
      kind: "missing",
      title: `VAT number missing on ${missing.length} ${plural(missing.length, "row", "rows")}`,
      detail: fillable ? "Filled in from another row of the same customer." : "No row in this table to fill it from.",
      cells: missing.map((r) => [r.id, "vat"]),
      fix: fillable ? (rs) => rs.map((r) => (r.vat ? r : { ...r, vat: from(r) ?? "" })) : null,
    });
  }
  return out;
}

const COLS: [Col, string][] = [
  ["customer", "Customer"],
  ["vat", "VAT no."],
  ["date", "Date"],
  ["amount", "Amount (GBP)"],
];

export function ValidatePanel() {
  const [history, setHistory] = useState<Row[][]>([RAW]);
  const [hover, setHover] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ cells: Set<string>; at: number }>({ cells: new Set(), at: 0 });
  const rows = history[history.length - 1];
  const findings = useMemo(() => validate(rows), [rows]);

  const flagged = new Map<string, string>();
  findings.forEach((f) => f.cells.forEach(([id, c]) => flagged.set(`${id}:${c}`, f.kind)));

  const apply = (fixes: ((rs: Row[]) => Row[])[]) => {
    const next = fixes.reduce((rs, fx) => fx(rs), rows);
    const changed = new Set<string>();
    next.forEach((r) => {
      const before = rows.find((o) => o.id === r.id)!;
      (Object.keys(r) as (keyof Row)[]).forEach((k) => before[k] !== r[k] && changed.add(`${r.id}:${k}`));
    });
    setHistory((h) => [...h, next]);
    setFlash({ cells: changed, at: Date.now() });
    setHover(null);
  };
  const reset = (h: Row[][]) => {
    setHistory(h);
    setFlash({ cells: new Set(), at: 0 });
  };
  const fixable = findings.filter((f) => f.fix);
  const steps = history.length - 1;

  return (
    <>
      <p className="panel-hint">An export someone sent in Excel. Hover a finding to see its cells; Fix turns it into a step you can undo.</p>
      <div className="demo">
          <div className="card grid-card">
            <div className="grid-bar">
              <span className="grid-name">invoices_october.xlsx</span>
              <span className="label">
                {rows.length} rows · {steps} {plural(steps, "step", "steps")}
              </span>
            </div>
            <div className="grid-scroll">
              <table className="grid">
                <thead>
                  <tr>
                    <th className="rn" aria-label="Row" />
                    {COLS.map(([c, t]) => (
                      <th key={c} className={c === "amount" ? "num" : ""}>
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="rn">{i + 1}</td>
                      {COLS.map(([c]) => {
                        const k = `${r.id}:${c}`;
                        const kind = flagged.get(k);
                        const v = r[c];
                        const cls = [
                          typeof v === "number" ? "num" : c === "amount" ? "txt" : "",
                          kind ? "bad" : "",
                          kind && hover === kind ? "hot" : "",
                          flash.cells.has(k) ? "fixed" : "",
                        ].join(" ");
                        return (
                          <td key={`${k}-${flash.cells.has(k) ? flash.at : 0}`} className={cls}>
                            {typeof v === "number" ? v.toLocaleString("en-GB", { minimumFractionDigits: 2 }) : v || <em>empty</em>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass findings" aria-live="polite">
            <div className="find-head">
              <div>
                <p className="label">Validate</p>
                <h3>{findings.length ? `${findings.length} ${plural(findings.length, "finding", "findings")}` : "All clean"}</h3>
              </div>
              {fixable.length > 1 && (
                <button className="btn sm" onClick={() => apply(fixable.map((f) => f.fix!))}>
                  Fix all
                </button>
              )}
            </div>
            {findings.length === 0 && (
              <p className="ok-line">
                <b>✓</b> The table is clean and ready for results and pipelines.
              </p>
            )}
            <ul className="find-list">
              {findings.map((f) => (
                <li
                  key={f.kind + f.title}
                  className={hover === f.kind ? "on" : ""}
                  onMouseEnter={() => setHover(f.kind)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div>
                    <p className="ft">{f.title}</p>
                    <p className="fd">{f.detail}</p>
                  </div>
                  {f.fix ? (
                    <button className="ghost sm" onFocus={() => setHover(f.kind)} onBlur={() => setHover(null)} onClick={() => apply([f.fix!])}>
                      Fix
                    </button>
                  ) : (
                    <span className="label">By hand</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="find-foot">
              <button className="ghost sm" disabled={!steps} onClick={() => reset(history.slice(0, -1))}>
                ↶ Undo
              </button>
              <button className="ghost sm" disabled={!steps} onClick={() => reset([RAW])}>
                Start over
              </button>
            </div>
          </div>
        </div>
    </>
  );
}

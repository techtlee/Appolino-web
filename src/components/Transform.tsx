import { useEffect, useRef, useState } from "react";
import { czk, int, plural } from "../czech";

/**
 * Transform as built: pick steps from the Transform menu (Lookup by date,
 * a calculated column from a template, Filter rows, Pivot), watch the grid
 * show the chain's output as a draft, see the SQL each step is written to,
 * take a step out, and save the chain as a result table that recalculates
 * itself. A tool that cannot be used yet stays in the menu with the reason
 * under its name. The figures are invented; the rates are example ČNB rates.
 */

type Val = string | number;
type Row = Record<string, Val>;
type Col = { key: string; name: string; num?: boolean; fresh?: boolean };
type Out = { cols: Col[]; rows: Row[] };
type StepId = "lookup" | "calc" | "filter" | "pivot";
type Step = { id: StepId; min?: number };

const FAKTURY: Row[] = [
  { no: "FV-2026-101", customer: "Pekárna U Mlýna s.r.o.", city: "Praha", date: "2026-10-03", czk: 12840, status: "Paid" },
  { no: "FV-2026-102", customer: "Zahradnictví Hájek", city: "Praha", date: "2026-10-03", czk: 5699, status: "Open" },
  { no: "FV-2026-104", customer: "Truhlářství Novák", city: "Brno", date: "2026-10-07", czk: 6000, status: "Open" },
  { no: "FV-2026-105", customer: "Kavárna Na Rohu", city: "Praha", date: "2026-10-09", czk: 845, status: "Overdue" },
  { no: "FV-2026-106", customer: "Elektro Svoboda a.s.", city: "Ostrava", date: "2026-10-12", czk: 3120.5, status: "Paid" },
];
const BASE_COLS: Col[] = [
  { key: "no", name: "Invoice no." },
  { key: "customer", name: "Customer" },
  { key: "city", name: "City" },
  { key: "date", name: "Date" },
  { key: "czk", name: "Amount (CZK)", num: true },
];

/** Kurzy ČNB: a rate is valid from its date until the next one. No rates at
 *  the weekend, so an invoice of Saturday 3 Oct takes Friday's rate. */
const RATES: [string, number][] = [
  ["2026-10-01", 24.33],
  ["2026-10-02", 24.355],
  ["2026-10-05", 24.39],
  ["2026-10-07", 24.41],
  ["2026-10-09", 24.385],
  ["2026-10-12", 24.42],
];
const rateOn = (d: string) => [...RATES].reverse().find(([rd]) => rd <= d)?.[1];

const MENU: { group: string; items: { id: StepId; name: string; sub: string }[] }[] = [
  { group: "Combine", items: [{ id: "lookup", name: "Lookup", sub: "Add Kurz from Kurzy ČNB, on or before Date" }] },
  { group: "Calculate", items: [{ id: "calc", name: "Add calculated column", sub: "Template · Divide: EUR = Amount ÷ Kurz" }] },
  {
    group: "Shape",
    items: [
      { id: "filter", name: "Filter rows", sub: "Keep rows where Amount is at least …" },
      { id: "pivot", name: "Pivot", sub: "Total by City: sum and count" },
    ],
  },
];
const TITLE: Record<StepId, string> = { lookup: "Lookup · Kurzy ČNB", calc: "Add calculated column · EUR", filter: "Filter rows", pivot: "Pivot · by City" };

function why(id: StepId, steps: Step[]): string | null {
  const has = (s: StepId) => steps.some((x) => x.id === s);
  if (has(id)) return "Already in the chain";
  if (has("pivot")) return "Pivot changes the table's shape; add steps before it";
  if (id === "calc" && !has("lookup")) return "Available once the table has a Kurz column: add the Lookup first";
  return null;
}

/** Runs the chain the way the server would: each step reads the output of the
 *  step before. The first step that breaks stops the chain and says why. */
function run(steps: Step[]): { out: Out; broken?: { at: number; msg: string } } {
  let out: Out = { cols: BASE_COLS, rows: FAKTURY };
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const last = i === steps.length - 1;
    const has = (k: string) => out.cols.some((c) => c.key === k);
    if (s.id === "lookup") {
      out = {
        cols: [...out.cols.map((c) => ({ ...c, fresh: false })), { key: "kurz", name: "Kurz", num: true, fresh: last }],
        rows: out.rows.map((r) => ({ ...r, kurz: rateOn(String(r.date)) ?? "" })),
      };
    } else if (s.id === "calc") {
      if (!has("kurz")) return { out, broken: { at: i, msg: "[Kurz] is not a column any more. Put the Lookup back, or remove this step." } };
      out = {
        cols: [...out.cols.map((c) => ({ ...c, fresh: false })), { key: "eur", name: "EUR", num: true, fresh: last }],
        rows: out.rows.map((r) => ({ ...r, eur: Math.round((Number(r.czk) / Number(r.kurz)) * 100) / 100 })),
      };
    } else if (s.id === "filter") {
      out = { cols: out.cols.map((c) => ({ ...c, fresh: false })), rows: out.rows.filter((r) => Number(r.czk) >= (s.min ?? 1000)) };
    } else if (s.id === "pivot") {
      const by = new Map<string, Row>();
      out.rows.forEach((r) => {
        const g = by.get(String(r.city)) ?? { city: r.city, n: 0, czk: 0, ...(has("eur") ? { eur: 0 } : {}) };
        g.n = Number(g.n) + 1;
        g.czk = Number(g.czk) + Number(r.czk);
        if (has("eur")) g.eur = Math.round((Number(g.eur) + Number(r.eur)) * 100) / 100;
        by.set(String(r.city), g);
      });
      out = {
        cols: [
          { key: "city", name: "City", fresh: last },
          { key: "n", name: "Invoices", num: true, fresh: last },
          { key: "czk", name: "Sum of Amount", num: true, fresh: last },
          ...(has("eur") ? [{ key: "eur", name: "Sum of EUR", num: true, fresh: last }] : []),
        ],
        rows: [...by.values()].sort((a, b) => Number(b.czk) - Number(a.czk)),
      };
    }
  }
  return { out };
}

/** The SQL each step is written to. Stored beside the steps, so the chain can
 *  be shown as steps and rebuilt from them. */
function sql(steps: Step[]): string {
  if (!steps.length) return 'select * from {{ dataset("Faktury") }}';
  const parts = steps.map((s, i) => {
    const prev = i === 0 ? '{{ dataset("Faktury") }}' : `s${i}`;
    const body =
      s.id === "lookup"
        ? `select t.*, k.kurz\n  from ${prev} t\n  left join lateral (\n    select kurz from {{ dataset("Kurzy ČNB") }} k\n    where k.datum <= t.date order by k.datum desc limit 1\n  ) k on true`
        : s.id === "calc"
          ? `select *, round(czk / nullif(kurz, 0), 2) as eur\n  from ${prev}`
          : s.id === "filter"
            ? `select * from ${prev}\n  where czk >= ${s.min ?? 1000}`
            : `select city, count(*) as invoices, sum(czk) as czk${steps.slice(0, i).some((x) => x.id === "calc") ? ", sum(eur) as eur" : ""}\n  from ${prev} group by city`;
    return `s${i + 1} as (\n  ${body}\n)`;
  });
  return `with ${parts.join(",\n")}\nselect * from s${steps.length}`;
}

const show = (c: Col, v: Val | undefined) =>
  v === undefined || v === "" ? "" : c.key === "kurz" ? Number(v).toFixed(3).replace(".", ",") : c.key === "n" ? int(Number(v)) : c.num ? czk(Number(v)) : String(v);

export function TransformPanel() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [menu, setMenu] = useState(false);
  const [view, setView] = useState<"steps" | "sql">("steps");
  const [original, setOriginal] = useState(false);
  const [saved, setSaved] = useState<{ name: string; steps: number; signed: boolean } | null>(null);
  const [name, setName] = useState("");
  const [undo, setUndo] = useState<{ steps: Step[]; msg: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenu(false);
    addEventListener("mousedown", close);
    return () => removeEventListener("mousedown", close);
  }, [menu]);

  const { out, broken } = run(original ? [] : steps);
  /** A column the last unsaved step added is marked as a draft. A pivot
   *  reshapes the whole table, so only its header is marked. */
  const reshaped = out.cols.every((c) => c.fresh);
  const draftCol = (c: Col) => !!c.fresh && !original && !saved && !reshaped;
  const add = (id: StepId) => {
    setSteps((s) => [...s, { id, min: id === "filter" ? 1000 : undefined }]);
    setMenu(false);
    setOriginal(false);
    setSaved(null);
    setUndo(null);
  };
  const remove = (i: number) => {
    setUndo({ steps, msg: `Took out “${TITLE[steps[i].id]}”; the rest were replayed.` });
    setSteps((s) => s.filter((_, j) => j !== i));
    setSaved(null);
  };
  const setMin = (i: number, min: number) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, min } : x)));
  const suggested = steps.some((s) => s.id === "pivot") ? "Tržby po městech" : steps.some((s) => s.id === "calc") ? "Faktury v EUR" : "Faktury · result";
  const save = () => {
    setSaved({ name: name.trim() || suggested, steps: steps.length, signed: false });
    setName("");
  };

  return (
    <>
      <p className="panel-hint">Open the Transform menu and add steps. Each one is written to SQL behind the scenes; save the chain as a result table that rebuilds itself when Faktury or Kurzy ČNB change.</p>
      <div className="tf">
        <div className="card grid-card">
          <div className="grid-bar tf-bar">
            <span className="grid-name">{saved ? saved.name : "Faktury"}</span>
            <div className="tf-tools">
              <div className="tf-menu-wrap" ref={menuRef}>
                <button className="btn2 sm" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                  Transform <span aria-hidden>▾</span>
                </button>
                {menu && (
                  <div className="tf-menu" role="menu">
                    {MENU.map((g) => (
                      <div key={g.group}>
                        <p className="label">{g.group}</p>
                        {g.items.map((it) => {
                          const no = why(it.id, steps);
                          return (
                            <button key={it.id} role="menuitem" disabled={!!no} onClick={() => add(it.id)}>
                              <b>{it.name}</b>
                              <small>{no ?? it.sub}</small>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <label className="chk label">
                <input type="checkbox" checked={original} disabled={!steps.length} onChange={(e) => setOriginal(e.target.checked)} />
                Show original
              </label>
            </div>
          </div>
          <div className="grid-scroll">
            <table className="grid tf-grid" key={`${steps.length}-${original}`}>
              <thead>
                <tr>
                  {out.cols.map((c) => (
                    <th key={c.key} className={`${c.num ? "num" : ""}${c.fresh && !saved ? " fresh" : ""}`}>
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {out.rows.map((r, i) => (
                  <tr key={String(r.no ?? r.city)} className="row-in" style={{ animationDelay: `${i * 0.04}s` }}>
                    {out.cols.map((c) => (
                      <td key={c.key} className={`${c.num ? "num" : ""}${c.key === "customer" ? " trunc" : ""}${draftCol(c) ? " draft" : ""}`}>
                        {show(c, r[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tf-foot">
            <span className="label">
              {out.rows.length} {plural(out.rows.length, "row", "rows")}
              {original ? " · the original, untouched" : steps.length && !saved ? " · read-only while steps are unsaved" : ""}
            </span>
            {broken && !original && <span className="tf-broken">Step {broken.at + 1} breaks: {broken.msg}</span>}
          </div>
        </div>

        <div className="glass tf-side" aria-live="polite">
          {saved ? (
            <div className="tf-saved" key={saved.name}>
              <p className="label">Result table</p>
              <h3>{saved.name}</h3>
              <p className="tf-status">
                <span className="pill p-succeeded">Succeeded · just now</span>
                {saved.signed && <span className="pill p-live">Signed off by Jana</span>}
              </p>
              <ul className="tf-facts">
                <li>
                  {saved.steps} {plural(saved.steps, "step", "steps")}, built as a real table in <code>p_severka_a</code>.
                </li>
                <li>Reads Faktury{steps.some((s) => s.id === "lookup") ? " and Kurzy ČNB" : ""}; rebuilds 8 seconds after either changes, parents before children.</li>
                <li>The project's checks run after every build. A failed run opens on the last good rows.</li>
              </ul>
              <div className="row tf-row">
                <button className="btn sm" disabled={saved.signed} onClick={() => setSaved({ ...saved, signed: true })}>
                  {saved.signed ? "Signed off" : "Sign off"}
                </button>
                <button className="ghost sm" onClick={() => setSaved(null)}>
                  Back to steps
                </button>
              </div>
              <p className="note">Changing its SQL removes the sign-off.</p>
            </div>
          ) : (
            <>
              <div className="tf-side-head">
                <p className="label">History · {steps.length ? `${steps.length} unsaved ${plural(steps.length, "step", "steps")}` : "no steps yet"}</p>
                <div className="seg sm" role="radiogroup" aria-label="Show">
                  {(["steps", "sql"] as const).map((v) => (
                    <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)}>
                      {v === "steps" ? "Steps" : "SQL"}
                    </button>
                  ))}
                </div>
              </div>

              {view === "sql" ? (
                <pre className="tf-sql" key={steps.length}>
                  {sql(steps)}
                </pre>
              ) : !steps.length ? (
                <div className="tf-empty">
                  <p>Nothing changed yet.</p>
                  <p className="note">
                    Open <b>Transform</b> above. A lookup of the day's rate, a calculated EUR column, a filter, a pivot: each is a step anyone can read.
                  </p>
                </div>
              ) : (
                <ol className="tf-steps">
                  {steps.map((s, i) => (
                    <li key={s.id} className={broken?.at === i ? "bad" : ""}>
                      <i aria-hidden>{i + 1}</i>
                      <div>
                        <b>{TITLE[s.id]}</b>
                        {s.id === "lookup" && <small>Match Date on or before Kurzy ČNB · Datum. If several match: Latest. Sat 3 Oct takes Friday's rate.</small>}
                        {s.id === "calc" && <small>[Amount (CZK)] / nullif([Kurz], 0), rounded to 2 · Decimal</small>}
                        {s.id === "pivot" && <small>Rows: City · Values: count, sum of Amount{steps.slice(0, i).some((x) => x.id === "calc") ? ", sum of EUR" : ""}</small>}
                        {s.id === "filter" && (
                          <span className="tf-filter">
                            <small>Amount (CZK) is at least</small>
                            <span className="seg sm" role="radiogroup" aria-label="At least">
                              {[1000, 5000].map((m) => (
                                <button key={m} role="radio" aria-checked={(s.min ?? 1000) === m} onClick={() => setMin(i, m)}>
                                  {int(m)}
                                </button>
                              ))}
                            </span>
                          </span>
                        )}
                      </div>
                      <button className="ghost sm" aria-label={`Remove ${TITLE[s.id]}`} onClick={() => remove(i)}>
                        ✕
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              {undo && (
                <p className="tf-undo">
                  {undo.msg}{" "}
                  <button
                    className="ghost sm"
                    onClick={() => {
                      setSteps(undo.steps);
                      setUndo(null);
                    }}
                  >
                    Undo
                  </button>
                </p>
              )}

              {steps.length > 0 && (
                <div className="tf-save">
                  <input className="tf-name" value={name} placeholder={suggested} onChange={(e) => setName(e.target.value)} aria-label="Result table name" />
                  <div className="row tf-row">
                    <button className="btn sm" disabled={!!broken} onClick={save}>
                      Save as result table
                    </button>
                    <button
                      className="ghost sm"
                      onClick={() => {
                        setSteps([]);
                        setUndo(null);
                      }}
                    >
                      Discard steps
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

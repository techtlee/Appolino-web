import { useMemo, useState, type ReactNode } from "react";
import { czk, fold, icoOk, mask, plural, readNumber } from "../czech";

/**
 * Validate, as Appolino runs it: the built-in rules (wrong type, not in the
 * list, duplicate key, empty row), the project's own checks (here an IČO
 * pattern) and what "could be cleaner", found without AI. Each Fix… opens the
 * window the app opens, applies to the table with the originals kept, and keeps
 * its rule for every future import. The companies are invented.
 */

type Row = { id: number; no: string; customer: string; ico: string; city: string; date: string; amount: string; status: string };
type Col = Exclude<keyof Row, "id">;

const CHOICES = ["Paid", "Open", "Overdue"];
const RAW: Row[] = [
  { id: 1, no: "FV-2026-101", customer: "Pekárna U Mlýna s.r.o.", ico: "27082440", city: "Praha", date: "2026-10-03", amount: "12 840,00", status: "Paid" },
  { id: 2, no: "FV-2026-102", customer: "Zahradnictví Hájek", ico: "25596641", city: "PRAHA", date: "2026-10-03", amount: "5 699,00", status: "Open" },
  { id: 3, no: "FV-2026-102", customer: "Zahradnictví Hájek", ico: "25596641", city: "Praha ", date: "2026-10-03", amount: "5 699,00", status: "" },
  { id: 4, no: "FV-2026-104", customer: "Truhlářství Novák", ico: "12345678", city: "Brno", date: "2026-10-07", amount: "6k", status: "Open" },
  { id: 5, no: "FV-2026-105", customer: "Kavárna Na Rohu", ico: "04512341", city: "praha", date: "2026-10-09", amount: "845,00", status: "Overdue" },
  { id: 6, no: "FV-2026-106", customer: "Elektro Svoboda a.s.", ico: "27936520", city: "Ostrava", date: "2026-10-12", amount: "3 120,50", status: "zaplaceno" },
  { id: 7, no: "", customer: "", ico: "", city: "", date: "", amount: "", status: "" },
];

const COLS: [Col, string][] = [
  ["no", "Invoice no."],
  ["customer", "Customer"],
  ["ico", "IČO"],
  ["city", "City"],
  ["amount", "Amount (CZK)"],
  ["status", "Status"],
];

type Kind = "type" | "choices" | "key" | "empty" | "check" | "cleaner";
type Finding = {
  kind: Kind;
  rule: string;
  col: string;
  sev: "Error" | "Warning" | "Could be cleaner";
  title: string;
  cells: [number, Col][];
  why: string;
  fix?: { name: string; lead: string; body: (o: FixOpts, set: (o: FixOpts) => void) => ReactNode; apply: (rows: Row[], o: FixOpts) => Row[]; keeps?: (o: FixOpts) => string };
};
type FixOpts = { map?: string; choice?: string; keep?: "first" | "latest" | "complete"; groups?: boolean };

const isEmpty = (r: Row) => COLS.every(([c]) => !r[c].trim()) && !r.date;
const checkDigit = (s: string) => {
  const d = s.split("").map(Number);
  let a = 0;
  for (let i = 0; i < 7; i++) a += d[i] * (8 - i);
  a %= 11;
  return a === 0 ? 1 : a === 1 ? 0 : 11 - a;
};

function validate(rows: Row[]): Finding[] {
  const out: Finding[] = [];
  const live = rows.filter((r) => !isEmpty(r));

  const badType = live.filter((r) => r.amount && readNumber(r.amount) === null);
  if (badType.length) {
    const v = badType[0].amount;
    out.push({
      kind: "type",
      rule: "Not a number",
      col: "Amount (CZK)",
      sev: "Error",
      title: `“${v}” is not an amount`,
      cells: badType.map((r) => [r.id, "amount"]),
      why: `The value's shape is ${mask(v)}: a number followed by a letter. Write it as a number, or tell Appolino what it means once, and it is read that way on every import.`,
      fix: {
        name: "Fix values · Amount (CZK)",
        lead: "Each value that doesn't fit, and what it becomes. Applies now and to future imports. The originals stay in History.",
        body: (o, set) => (
          <table className="grid mini">
            <thead>
              <tr>
                <th>Value</th>
                <th>Becomes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="txt">{v}</td>
                <td>
                  <input className="cell-in" value={o.map ?? "6 000"} onChange={(e) => set({ ...o, map: e.target.value })} aria-label={`Replace ${v} with`} />
                </td>
              </tr>
            </tbody>
          </table>
        ),
        apply: (rs, o) => rs.map((r) => (r.amount === v ? { ...r, amount: czk(readNumber(o.map ?? "6 000") ?? 0) } : r)),
        keeps: (o) => `Amount (CZK): “${v}” → ${o.map ?? "6 000"}`,
      },
    });
  }

  const offList = live.filter((r) => r.status && !CHOICES.includes(r.status));
  if (offList.length) {
    const v = offList[0].status;
    out.push({
      kind: "choices",
      rule: "Not in the list",
      col: "Status",
      sev: "Error",
      title: `“${v}” is not one of Paid, Open, Overdue`,
      cells: offList.map((r) => [r.id, "status"]),
      why: "Status is a Single select. A value typed in the grid is checked against its choices; one that arrives by import is kept and listed here.",
      fix: {
        name: "Edit allowed values · Status",
        lead: "Map the value onto one of the column's choices. Every future import maps it too.",
        body: (o, set) => (
          <div className="map-row">
            <span className="txt">“{v}”</span>
            <span aria-hidden>→</span>
            <div className="seg sm" role="radiogroup" aria-label="Choice">
              {CHOICES.map((c) => (
                <button key={c} role="radio" aria-checked={(o.choice ?? "Paid") === c} onClick={() => set({ ...o, choice: c })}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        ),
        apply: (rs, o) => rs.map((r) => (r.status === v ? { ...r, status: o.choice ?? "Paid" } : r)),
        keeps: (o) => `Status: “${v}” → ${o.choice ?? "Paid"}`,
      },
    });
  }

  const seen = new Map<string, Row>();
  const dups: Row[] = [];
  live.forEach((r) => (seen.has(r.no) ? dups.push(r) : seen.set(r.no, r)));
  if (dups.length) {
    const key = dups[0].no;
    const group = live.filter((r) => r.no === key);
    out.push({
      kind: "key",
      rule: "Duplicate or missing key",
      col: "Invoice no.",
      sev: "Error",
      title: `${key} appears ${group.length} times`,
      cells: group.flatMap((r) => COLS.map(([c]): [number, Col] => [r.id, c])),
      why: "Invoice no. is the table's business key, so every row needs one of its own. Upsert and Insert if new match on it.",
      fix: {
        name: "Remove duplicates · Invoice no.",
        lead: "Rows that share the key form a group. Keep one, remove the rest in one go; Undo brings them back.",
        body: (o, set) => (
          <div className="seg sm" role="radiogroup" aria-label="Keep">
            {(
              [
                ["complete", "Most complete"],
                ["first", "First"],
                ["latest", "Latest by Date"],
              ] as const
            ).map(([k, t]) => (
              <button key={k} role="radio" aria-checked={(o.keep ?? "complete") === k} onClick={() => set({ ...o, keep: k })}>
                {t}
              </button>
            ))}
          </div>
        ),
        apply: (rs, o) => {
          const filled = (r: Row) => COLS.filter(([c]) => r[c].trim()).length;
          const k = o.keep ?? "complete";
          const keep =
            k === "first" ? group[0] : k === "latest" ? [...group].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0] : [...group].sort((a, b) => filled(b) - filled(a))[0];
          return rs.filter((r) => r.no !== key || r.id === keep.id);
        },
      },
    });
  }

  const empty = rows.filter(isEmpty);
  if (empty.length)
    out.push({
      kind: "empty",
      rule: "Empty row",
      col: "Whole row",
      sev: "Warning",
      title: `${empty.length} ${plural(empty.length, "row", "rows")} with nothing in any cell`,
      cells: empty.flatMap((r) => COLS.map(([c]): [number, Col] => [r.id, c])),
      why: "Usually the last line of an export. In a pipeline, “Stop at the first empty row” ends the table there.",
      fix: { name: "Delete the row", lead: "The row goes; History keeps it.", body: () => null, apply: (rs) => rs.filter((r) => !isEmpty(r)) },
    });

  const badIco = live.filter((r) => r.ico && !icoOk(r.ico));
  if (badIco.length) {
    const v = badIco[0].ico;
    out.push({
      kind: "check",
      rule: "Matches pattern · IČO",
      col: "IČO",
      sev: "Error",
      title: `${v} fails the IČO check digit`,
      cells: badIco.map((r) => [r.id, "ico"]),
      why: `Shape ${mask(v)}: eight digits, as an IČO should be, but the last one should be ${checkDigit(v)} for the seven before it. Correct it in the source; an error-level check holds the pipeline until then.`,
    });
  }

  const groups = new Map<string, Set<string>>();
  live.forEach((r) => groups.set(fold(r.city), (groups.get(fold(r.city)) ?? new Set()).add(r.city)));
  const messy = [...groups.values()].filter((g) => g.size > 1);
  if (messy.length) {
    const g = [...messy[0]];
    const target = g.find((x) => x === x.trim() && /^\p{Lu}\p{Ll}/u.test(x)) ?? g[0];
    out.push({
      kind: "cleaner",
      rule: "Make values consistent",
      col: "City",
      sev: "Could be cleaner",
      title: `${g.length} spellings of “${target}”`,
      cells: live.filter((r) => fold(r.city) === fold(target)).map((r) => [r.id, "city"]),
      why: "Grouped after folding case, accents, extra spaces and a trailing dot, without AI: Prague and Praha would stay two values.",
      fix: {
        name: "Make values consistent · City",
        lead: "Untick a group to leave it. Kept, so the next import arrives spelled the same way.",
        body: (o, set) => (
          <label className="grp-row">
            <input type="checkbox" checked={o.groups ?? true} onChange={(e) => set({ ...o, groups: e.target.checked })} />
            <span>
              {g.filter((x) => x !== target).map((x) => (
                <code key={x}>“{x}”</code>
              ))}
              <span aria-hidden> → </span>
              <b>{target}</b>
            </span>
          </label>
        ),
        apply: (rs, o) => ((o.groups ?? true) ? rs.map((r) => (fold(r.city) === fold(target) ? { ...r, city: target } : r)) : rs),
        keeps: (o) => ((o.groups ?? true) ? `City: ${g.length - 1} spellings → ${target}` : ""),
      },
    });
  }
  return out;
}

export function ValidatePanel() {
  const [history, setHistory] = useState<Row[][]>([RAW]);
  const [kept, setKept] = useState<string[][]>([[]]);
  const [hover, setHover] = useState<Kind | null>(null);
  const [open, setOpen] = useState<{ kind: Kind; mode: "fix" | "why" } | null>(null);
  const [opts, setOpts] = useState<FixOpts>({});
  const [flash, setFlash] = useState<{ cells: Set<string>; at: number }>({ cells: new Set(), at: 0 });
  const [ran, setRan] = useState(false);
  const rows = history[history.length - 1];
  const rules = kept[kept.length - 1];
  const findings = useMemo(() => (ran ? validate(rows) : []), [rows, ran]);

  const flagged = new Map<string, Kind>();
  findings.forEach((f) => f.cells.forEach(([id, c]) => flagged.set(`${id}:${c}`, f.kind)));

  const apply = (fs: Finding[], o: FixOpts) => {
    const next = fs.reduce((rs, f) => (f.fix ? f.fix.apply(rs, o) : rs), rows);
    const changed = new Set<string>();
    next.forEach((r) => {
      const before = rows.find((x) => x.id === r.id)!;
      COLS.forEach(([c]) => before[c] !== r[c] && changed.add(`${r.id}:${c}`));
    });
    const newRules = fs.map((f) => f.fix?.keeps?.(o) ?? "").filter(Boolean);
    setHistory((h) => [...h, next]);
    setKept((k) => [...k, [...rules, ...newRules]]);
    setFlash({ cells: changed, at: Date.now() });
    setOpen(null);
    setOpts({});
    setHover(null);
  };
  const undo = () => {
    setHistory((h) => h.slice(0, -1));
    setKept((k) => k.slice(0, -1));
    setFlash({ cells: new Set(), at: 0 });
  };
  const restart = () => {
    setHistory([RAW]);
    setKept([[]]);
    setRan(false);
    setOpen(null);
  };

  const fixable = findings.filter((f) => f.fix);
  const errors = findings.filter((f) => f.sev === "Error").length;
  const steps = history.length - 1;
  const cur = open && findings.find((f) => f.kind === open.kind);

  return (
    <>
      <p className="panel-hint">An export from the accounting system. Press Validate: hover a finding to see its cells, open Fix… or Why?, and watch what Appolino keeps for next month.</p>
      <div className="demo">
        <div className="card grid-card">
          <div className="grid-bar">
            <span className="grid-name">Faktury · říjen 2026</span>
            <span className="label">
              {rows.length} rows · {steps} {plural(steps, "change", "changes")} in History
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
                      const n = c === "amount" ? readNumber(v) : null;
                      const cls = [
                        c === "customer" ? "trunc" : "",
                        c === "amount" ? (n === null ? "txt" : "num") : "",
                        kind ? (kind === "cleaner" ? "soft" : "bad") : "",
                        kind && hover === kind ? "hot" : "",
                        flash.cells.has(k) ? "fixed" : "",
                      ].join(" ");
                      return (
                        <td key={`${k}-${flash.cells.has(k) ? flash.at : 0}`} className={cls}>
                          {c === "status" && CHOICES.includes(v) ? (
                            <span className={`pill-s s-${v.toLowerCase()}`}>{v}</span>
                          ) : n !== null ? (
                            czk(n)
                          ) : v ? (
                            <span className={c === "customer" ? "tr" : ""}>{v.replace(/ $/, "␣")}</span>
                          ) : (
                            <em>·</em>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rules.length > 0 && (
            <div className="kept">
              <p className="label">Kept on the columns, for every future import and sync</p>
              <ul>
                {rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="glass findings" aria-live="polite">
          {!ran ? (
            <div className="val-start">
              <p className="label">Validate</p>
              <h3>Check values against types and checks</h3>
              <p className="note">Runs the built-in rules, the project's checks, and looks for what could be cleaner. No AI involved.</p>
              <button className="btn sm" onClick={() => setRan(true)}>
                Validate
              </button>
            </div>
          ) : cur ? (
            <div className="fixwin" key={open!.kind + open!.mode}>
              <p className="label">{open!.mode === "fix" ? "Fix…" : "Why?"}</p>
              <h3>{open!.mode === "fix" ? cur.fix!.name : cur.title}</h3>
              <p className="fd">{open!.mode === "fix" ? cur.fix!.lead : cur.why}</p>
              {open!.mode === "fix" && cur.fix!.body(opts, setOpts)}
              {open!.mode === "why" && (
                <p className="note">Explained from the value's shape only. The value itself never leaves Appolino.</p>
              )}
              <div className="row">
                {open!.mode === "fix" && (
                  <button className="btn sm" onClick={() => apply([cur], opts)}>
                    Apply
                  </button>
                )}
                <button className="ghost sm" onClick={() => setOpen(null)}>
                  {open!.mode === "fix" ? "Cancel" : "Back"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="find-head">
                <div>
                  <p className="label">
                    Validate · 5 rules · 1 check
                  </p>
                  <h3>{findings.length ? `${findings.length} ${plural(findings.length, "finding", "findings")}` : "Nothing to fix"}</h3>
                  {findings.length > 0 && (
                    <p className="note">
                      {errors} {plural(errors, "error", "errors")}
                      {findings.length > errors ? ` · ${findings.length - errors} more to look at` : ""}
                    </p>
                  )}
                </div>
                {fixable.length > 1 && (
                  <button className="btn sm" onClick={() => apply(fixable, {})}>
                    Fix all
                  </button>
                )}
              </div>
              {findings.length === 0 && (
                <p className="ok-line">
                  <b>✓</b> Validated 5 rules and 1 check: nothing to fix. Ready for results and pipelines.
                </p>
              )}
              <ul className="find-list">
                {findings.map((f, i) => (
                  <li
                    key={f.kind}
                    style={{ animationDelay: `${i * 0.06}s` }}
                    className={hover === f.kind ? "on" : ""}
                    onMouseEnter={() => setHover(f.kind)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <div>
                      <p className="ft">
                        <span className={`sev sev-${f.sev === "Error" ? "e" : f.sev === "Warning" ? "w" : "c"}`}>{f.sev}</span>
                        {f.rule}
                      </p>
                      <p className="fd">
                        {f.col} · {f.title}
                      </p>
                    </div>
                    <div className="find-acts">
                      <button className="ghost sm" onClick={() => setOpen({ kind: f.kind, mode: "why" })}>
                        Why?
                      </button>
                      {f.fix ? (
                        <button className="btn2 sm" onFocus={() => setHover(f.kind)} onClick={() => setOpen({ kind: f.kind, mode: "fix" })}>
                          Fix…
                        </button>
                      ) : (
                        <span className="label">In the source</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {ran && (
            <div className="find-foot">
              <button className="ghost sm" disabled={!steps} onClick={undo}>
                ↶ Undo
              </button>
              <button className="ghost sm" onClick={restart}>
                Start over
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

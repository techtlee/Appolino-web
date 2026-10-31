import { useCallback, useEffect, useRef, useState } from "react";
import { prefersLessMotion, useSeen } from "../motion";
import { czk, int, readBool, readDate, readNumber } from "../czech";

/**
 * An upload, played the way Appolino reads one: it finds the header instead of
 * assuming it, reads Czech spellings into types, recognises known standards by
 * their content, and builds the table in the background with a window that
 * counts rows. The files are invented.
 */

type Source = "excel" | "isdoc" | "gpc";
type Stage = { key: string; label: string; at: number };

const SOURCES: { id: Source; label: string; file: string; ext: string; size: string }[] = [
  { id: "excel", label: "Excel export", file: "faktury_rijen_2026.xlsx", ext: "XLSX", size: "1 284 rows" },
  { id: "isdoc", label: "ISDOC e-invoice", file: "FV2026101.isdoc", ext: "ISDOC", size: "1 invoice, 3 lines" },
  { id: "gpc", label: "Bank statement", file: "vypis_2026_10.gpc", ext: "GPC", size: "214 entries" },
];

const PLAN: Record<Source, Stage[]> = {
  excel: [
    { key: "read", label: "Read the file", at: 500 },
    { key: "header", label: "Find the header", at: 1300 },
    { key: "types", label: "Read the types", at: 4600 },
    { key: "build", label: "Build the table", at: 7300 },
    { key: "done", label: "Ready", at: 9300 },
  ],
  isdoc: [
    { key: "read", label: "Read the file", at: 500 },
    { key: "sniff", label: "Recognise the format", at: 1300 },
    { key: "pages", label: "Fixed columns, no setup", at: 3000 },
    { key: "build", label: "Build the table", at: 5200 },
    { key: "done", label: "Ready", at: 6800 },
  ],
  gpc: [
    { key: "read", label: "Read the file", at: 500 },
    { key: "sniff", label: "Recognise the format", at: 1300 },
    { key: "pages", label: "Sign the amounts", at: 3000 },
    { key: "build", label: "Build the table", at: 5600 },
    { key: "done", label: "Ready", at: 7200 },
  ],
};

/* ---- the Excel export: three lines of title above the header ---- */
const SHEET = [
  ["Faktury vydané – říjen 2026", "", "", "", "", ""],
  ["Export z účetnictví 30. 10. 2026", "", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["Číslo faktury", "Odběratel", "Datum", "Částka", "Zaplaceno", "PSČ"],
  ["FV-2026-101", "Pekárna U Mlýna s.r.o.", "3. 10. 2026", "12 840,00", "ano", "110 00"],
  ["FV-2026-102", "Zahradnictví Hájek", "03.10.2026", "5 699,00", "ne", "602 00"],
  ["FV-2026-104", "Truhlářství Novák", "7. 10. 2026", "1.230,50", "ano", "702 00"],
  ["FV-2026-105", "Kavárna Na Rohu", "2026-10-09", "845", "ne", "110 00"],
];
const isWord = (v: string) => /\p{L}/u.test(v) && readDate(v) === null && readNumber(v) === null;
const score = (r: string[]) => r.filter(Boolean).length * 10 + r.filter(isWord).length;
const HEADER = SHEET.slice(0, 8).reduce((best, r, i) => (score(r) > score(SHEET[best]) ? i : best), 0);

type Read = { type: string; show: (v: string) => string; note?: string };
function guess(values: string[]): Read {
  if (values.every((v) => readDate(v))) return { type: "Date", show: (v) => readDate(v)!, note: `${new Set(values.map((v) => v.replace(/\d/g, "9"))).size} spellings, one date` };
  if (values.every((v) => readBool(v) !== null)) return { type: "Boolean", show: (v) => (readBool(v) ? "Yes" : "No"), note: "ano / ne" };
  if (values.every((v) => readNumber(v) !== null)) return { type: "Decimal", show: (v) => readNumber(v)!.toFixed(2), note: "Czech thousands and decimals" };
  return { type: "Text", show: (v) => v };
}
const COLUMNS = SHEET[HEADER].map((name, c) => {
  const vals = SHEET.slice(HEADER + 1).map((r) => r[c]);
  const g = guess(vals);
  return { name, sample: vals[0], ...g, note: name === "PSČ" ? "Not grouped in threes, so it stays text" : g.note };
});

/* ---- ISDOC and GPC ---- */
const ISDOC_INVOICE: [string, string][] = [
  ["Number", "FV-2026-101"],
  ["Issued", "2026-10-03"],
  ["Due", "2026-10-17"],
  ["Supplier IČO", "27082440"],
  ["Customer IČO", "25596641"],
  ["Variable symbol", "2026101"],
  ["Total incl. VAT", "12 840,00 CZK"],
];
const ISDOC_LINES = [
  ["Chléb kváskový", "120", "54,00", "12 %"],
  ["Rohlík", "800", "3,50", "12 %"],
  ["Rozvoz", "1", "1 395,00", "21 %"],
];
/** GPC holds amounts in haléře and the sign in the booking code. */
const GPC = [
  { date: "2026-10-03", who: "Pekárna U Mlýna", vs: "2026101", hal: 1284000, code: "2" },
  { date: "2026-10-05", who: "ČEZ Prodej, a.s.", vs: "8820114", hal: 245000, code: "1" },
  { date: "2026-10-07", who: "Zahradnictví Hájek", vs: "2026102", hal: 569900, code: "2" },
];

export function ImportPanel({ onNext }: { onNext?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.3);
  const [src, setSrc] = useState<Source>("excel");
  const [t, setT] = useState(-1); // ms since the play started; -1 = not started
  const raf = useRef(0);

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    if (prefersLessMotion()) return setT(1e6);
    const start = performance.now();
    const tick = (now: number) => {
      const el = now - start;
      setT(el);
      if (el < 12000) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (seen) play();
    return () => cancelAnimationFrame(raf.current);
  }, [seen, src, play]);

  const plan = PLAN[src];
  const stageIx = plan.reduce((ix, s, i) => (t >= s.at ? i : ix), -1);
  const stage = stageIx < 0 ? "drop" : plan[stageIx].key;
  const since = (key: string) => t - (plan.find((s) => s.key === key)?.at ?? 0);
  const S = SOURCES.find((s) => s.id === src)!;

  const pick = (s: Source) => {
    if (s === src) return play();
    setT(-1);
    setSrc(s);
  };

  return (
    <div ref={ref}>
      <p className="panel-hint">Pick a file. Appolino finds the header, reads Czech spellings into real types, and builds the table in the background.</p>
      <div className="imp">
        <div className="imp-side">
          <p className="label">The file</p>
          <div className="imp-srcs" role="radiogroup" aria-label="File to import">
            {SOURCES.map((s) => (
              <button key={s.id} role="radio" aria-checked={src === s.id} className={`imp-src${src === s.id ? " on" : ""}`} onClick={() => pick(s.id)}>
                <span className="chip-ext">{s.ext}</span>
                <span>
                  <b>{s.label}</b>
                  <small>{s.file}</small>
                </span>
              </button>
            ))}
          </div>
          <ol className="imp-steps">
            {plan.map((s, i) => (
              <li key={s.key} className={i < stageIx || stage === "done" ? "done" : i === stageIx ? "now" : ""}>
                <i aria-hidden>{i < stageIx || stage === "done" ? "✓" : i + 1}</i>
                {s.label}
              </li>
            ))}
          </ol>
          <button className="ghost sm" onClick={play}>
            Play again <span className="ar">↻</span>
          </button>
        </div>

        <div className="card imp-main" aria-live="polite">
          <div className="imp-head">
            <span className={`imp-file${stage === "drop" ? " flying" : ""}`} key={src}>
              <span className="chip-ext">{S.ext}</span>
              {S.file}
            </span>
            <span className="label">{S.size}</span>
          </div>

          {stage === "drop" && <div className="drop">Drag &amp; drop a file here, or click to browse</div>}

          {stage === "read" && (
            <div className="imp-read">
              <p>Reading {S.file}…</p>
              <span className="prog">
                <span style={{ width: `${Math.min(100, (since("read") / 800) * 100)}%` }} />
              </span>
              <p className="note">Checked first: is the file what its name says? A PDF renamed to .xlsx is refused in a sentence.</p>
            </div>
          )}

          {src === "excel" && stage === "header" && <HeaderScan t={since("header")} />}
          {src === "excel" && stage === "types" && <TypeRead t={since("types")} />}

          {src !== "excel" && stage === "sniff" && (
            <div className="sniff">
              <p className="label">Decided by the content, not the name</p>
              <pre>
                {src === "isdoc"
                  ? '<?xml version="1.0" encoding="UTF-8"?>\n<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.2">\n  <ID>FV-2026-101</ID>'
                  : "074000000192837465Pekárna U Mlýna  01102026000012345600+…\n0750000001928374650000000002460000012840002…"}
              </pre>
              {since("sniff") > 700 && (
                <p className="ok-line">
                  <b>✓</b> {src === "isdoc" ? "A Czech ISDOC e-invoice. Read with fixed columns, nothing to set up." : "A Czech GPC/ABO bank statement. Read into one Entries page."}
                </p>
              )}
            </div>
          )}

          {src === "isdoc" && stage === "pages" && (
            <div className="pages">
              <div>
                <p className="label">Page · Invoice · 17 columns</p>
                <dl className="kv">
                  {ISDOC_INVOICE.map(([k, v], i) => (
                    <div key={k} style={{ animationDelay: `${i * 0.12}s` }}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <p className="label">Page · Lines · 11 columns</p>
                <table className="grid mini">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="num">Qty</th>
                      <th className="num">Unit price</th>
                      <th className="num">VAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ISDOC_LINES.map((r, i) => (
                      <tr key={r[0]} className="row-in" style={{ animationDelay: `${0.4 + i * 0.15}s` }}>
                        <td>{r[0]}</td>
                        <td className="num">{r[1]}</td>
                        <td className="num">{r[2]}</td>
                        <td className="num">{r[3]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="note">Amounts are kept as exact decimals, never as floating point.</p>
              </div>
            </div>
          )}

          {src === "gpc" && stage === "pages" && (
            <div>
              <p className="label">Page · Entries · amounts arrive in haléře, the sign in the booking code</p>
              <table className="grid mini">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Counterparty</th>
                    <th>VS</th>
                    <th className="num">In the file</th>
                    <th className="num">Amount (CZK)</th>
                  </tr>
                </thead>
                <tbody>
                  {GPC.map((r, i) => {
                    const done = since("pages") > 500 + i * 550;
                    const amt = (r.code === "1" ? -1 : 1) * (r.hal / 100);
                    return (
                      <tr key={r.vs}>
                        <td>{r.date}</td>
                        <td>{r.who}</td>
                        <td>{r.vs}</td>
                        <td className="num txt">{String(r.hal).padStart(12, "0")}</td>
                        <td className={`num${done ? " fixed" : ""}`} key={done ? "d" : "w"}>
                          {done ? <span className={amt < 0 ? "neg" : ""}>{czk(amt)}</span> : <em>…</em>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="note">A debit (booking code 1) comes out negative, a credit positive. camt.053 and MT940 statements are read the same way.</p>
            </div>
          )}

          {stage === "build" && <Building t={since("build")} rows={src === "excel" ? 1284 : src === "isdoc" ? 4 : 214} file={S.file} />}

          {stage === "done" && (
            <div className="imp-done">
              <p className="ok-line">
                <b>✓</b> Built 1 table{src === "isdoc" ? " with two pages" : ""}: {src === "excel" ? "Faktury" : src === "isdoc" ? "Invoice FV-2026-101" : "Výpis říjen 2026"}
              </p>
              <ul className="imp-facts">
                {src === "excel" && (
                  <>
                    <li>Header found on row 4; the two title rows above it were skipped.</li>
                    <li>Four date spellings became one date. Czech amounts became numbers. The postcode stayed text.</li>
                    <li>Next month, the same file updates this table: Append, Upsert, Insert if new, or Full replace, with a preview of what changes first.</li>
                  </>
                )}
                {src === "isdoc" && (
                  <>
                    <li>No mapping, no template: ISDOC always reads into the same 17 + 11 columns.</li>
                    <li>A PDF that carries an ISDOC attachment is read the same way.</li>
                  </>
                )}
                {src === "gpc" && (
                  <>
                    <li>Amounts signed and converted from haléře; variable symbols kept as text, leading zeros intact.</li>
                    <li>Look up each payment's invoice by its variable symbol in a Lookup step.</li>
                  </>
                )}
              </ul>
              {onNext && (
                <button className="btn sm" onClick={onNext}>
                  Validate it <span aria-hidden>→</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeaderScan({ t }: { t: number }) {
  const at = Math.min(SHEET.length - 1, Math.floor(t / 360));
  const picked = t > SHEET.length * 360 + 200;
  const max = Math.max(...SHEET.map(score));
  return (
    <div>
      <p className="label">The header is found, not assumed: each row is scored by filled cells, then by words</p>
      <div className="grid-scroll">
        <table className="grid mini scan-grid">
          <tbody>
            {SHEET.map((r, i) => (
              <tr key={i} className={`${i === at && !picked ? "scanning" : ""}${picked && i === HEADER ? " is-head" : ""}${picked && i < HEADER ? " skipped" : ""}`}>
                <td className="rn">{i + 1}</td>
                {r.slice(0, 3).map((v, j) => (
                  <td key={j}>{v || <em>·</em>}</td>
                ))}
                <td className="score">
                  {i <= at && (
                    <span className="sbar">
                      <span style={{ width: `${(score(r) / max) * 100}%` }} />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {picked && (
        <p className="ok-line">
          <b>✓</b> Header on row {HEADER + 1}. Rows 1–3 are a title and a blank line, skipped.
        </p>
      )}
    </div>
  );
}

function TypeRead({ t }: { t: number }) {
  return (
    <div>
      <p className="label">Types detected from up to 100 sample values; 90 % must agree</p>
      <table className="grid mini types">
        <thead>
          <tr>
            <th>Column</th>
            <th>In the file</th>
            <th>Read as</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {COLUMNS.map((c, i) => {
            const on = t > 250 + i * 380;
            return (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td className="txt">{c.sample}</td>
                <td className={on ? "fixed" : ""} key={on ? "y" : "n"}>
                  {on ? c.show(c.sample) : <em>…</em>}
                  {on && c.note && <small>{c.note}</small>}
                </td>
                <td>{on ? <span className={`type-tag t-${c.type.toLowerCase()}`}>Auto ({c.type})</span> : <em>…</em>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Building({ t, rows, file }: { t: number; rows: number; file: string }) {
  const p = Math.min(1, Math.max(0, (t - 200) / 1400));
  const done = Math.round(p * rows);
  const secs = Math.max(0, Math.round((t / 1000) * 2));
  return (
    <div className="building">
      <h3>Building your table</h3>
      <p>Writing {file} into Faktury 2026.</p>
      <span className="prog big">
        <span style={{ width: `${p * 100}%` }} />
      </span>
      <p className="label">
        {int(done)} of {int(rows)} rows written · 0:{String(secs).padStart(2, "0")}
      </p>
      <p className="note">A large file takes a few minutes. Closing this page does not stop it; the table is in the project when it is done.</p>
    </div>
  );
}

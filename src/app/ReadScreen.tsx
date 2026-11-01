import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { num, useT } from "../i18n";
import { prefersLessMotion, useSeen } from "../motion";
import { Head, I, Side } from "./kit";

/**
 * Extract: a file read where it lands, the way appolino reads every file that arrives (owner,
 * 2026-11-01: "more impact on import - inferring types, skipping lines, values processed into
 * tables, validation, automatic every time"; "keep only one source"). A Czech accounting export
 * comes in as it is - a title over the table, a note, a blank line, dates and amounts three
 * ways, ANO and ne, a totals line under it - and the screen reads it in place: the header is
 * found, the lines above it skipped, each column's type inferred, every value read the Czech
 * way, the totals line dropped, a value that is not an amount kept as written and flagged, and
 * what is left closes up into the table. Beside it, what was done, in sentences.
 *
 * True to bdop's reader: the header is the fullest of the first rows, not the first
 * (import_engine.find_header); a type is guessed from the column
 * with a 10% tolerance, which is why the file has more rows than the screen shows (one bad
 * amount in five would not leave the column a number); the totals line goes by the source's
 * rule that a row needs its key ("require_column"), set once and kept for every run; a value
 * that does not fit stays in the record as written. The file is Czech in both languages, since
 * reading local exports as they are is the point - the text says "local formats" and never
 * names the country (owner, 2026-11-01). The companies are invented.
 */
type Two = [string, string];
type Ty = "text" | "date" | "decimal" | "bool";
type Line =
  | { k: "title"; text: string }
  | { k: "blank" }
  | { k: "head"; cells: string[] }
  | { k: "row"; cells: string[]; v: (string | number | boolean)[]; bad?: number }
  | { k: "more"; n: number }
  | { k: "drop"; cells: string[]; why: Two };
type Src = {
  file: string;
  from: Two;
  /** The file's columns: the name in its header, the type a read finds, its share of the width,
   *  and whether a phone lets it go (smHide): it keeps the key, the date and the amount, whose
   *  values are read anew, at a size that shows them whole. */
  cols: { name: string; ty: Ty; key?: boolean; fr?: number; smHide?: boolean }[];
  lines: Line[];
  log: { s: number; icon: string; tone?: "ok" | "warn"; text: Two }[];
};

const FILE: Src = {
    file: "faktury_rijen.xlsx",
    from: ["Arrived on SharePoint at 06:00", "Dorazil na SharePoint v 06:00"],
    cols: [
      { name: "Číslo faktury", ty: "text", key: true, fr: 1.15 },
      { name: "Odběratel", ty: "text", fr: 1.3, smHide: true },
      { name: "Vystaveno", ty: "date", fr: 1.1 },
      { name: "Částka", ty: "decimal" },
      { name: "Zaplaceno", ty: "bool", fr: 0.9, smHide: true },
    ],
    lines: [
      { k: "title", text: "Faktury vydané za říjen 2026" },
      { k: "title", text: "Export z účetnictví, 1. 11. 2026" },
      { k: "blank" },
      { k: "head", cells: ["Číslo faktury", "Odběratel", "Vystaveno", "Částka", "Zaplaceno"] },
      { k: "row", cells: ["FV-2026-101", "Pekárna U Mlýna s.r.o.", "15. 10. 2026", "12 840,50", "ANO"], v: ["FV-2026-101", "Pekárna U Mlýna s.r.o.", "2026-10-15", 12840.5, true] },
      { k: "row", cells: ["FV-2026-102", "Kavárna Na Rohu", "16.10.2026", "5 899", "NE"], v: ["FV-2026-102", "Kavárna Na Rohu", "2026-10-16", 5899, false] },
      { k: "row", cells: ["FV-2026-103", "Truhlářství Novák", "20. 10. 2026", "1.234,00", "ano"], v: ["FV-2026-103", "Truhlářství Novák", "2026-10-20", 1234, true] },
      { k: "row", cells: ["FV-2026-104", "Stavebniny Kladno a.s.", "2026-10-22", "hodně", "NE"], v: ["FV-2026-104", "Stavebniny Kladno a.s.", "2026-10-22", "hodně", false], bad: 3 },
      { k: "row", cells: ["FV-2026-105", "Autoservis Beneš", "31. 10. 2026", "3 120,00", "ano"], v: ["FV-2026-105", "Autoservis Beneš", "2026-10-31", 3120, true] },
      { k: "more", n: 19 },
      { k: "blank" },
      { k: "drop", cells: ["", "Celkem", "", "23 093,50", ""], why: ["Totals: dropped", "Součet: vynechán"] },
    ],
    log: [
      { s: 1, icon: "search", text: ["Header found on row 4 (the 3 lines above it skipped)", "Záhlaví nalezeno na řádku 4 (3 řádky nad ním přeskočeny)"] },
      { s: 2, icon: "sparkles", text: ["Types inferred: text, date, amount, yes/no", "Typy rozpoznány: text, datum, částka, ano/ne"] },
      { s: 3, icon: "wand", text: ["Local formats read: 1.234,00 → 1234.00 · 16.10.2026 → 2026-10-16 · ANO → Yes", "Místní zápis přečten: 1.234,00 → 1234.00 · 16.10.2026 → 2026-10-16 · ANO → Ano"] },
      { s: 4, icon: "row-remove", text: ["Totals line dropped: a row needs an invoice number", "Řádek Celkem vynechán: řádek potřebuje číslo faktury"] },
      { s: 5, icon: "alert-triangle", tone: "warn", text: ["\"hodně\" is not an amount; kept as written, flagged for Validate", "„hodně“ není částka; zůstává, jak byla zapsána, a čeká na validaci"] },
      { s: 6, icon: "circle-check", tone: "ok", text: ["24 rows into Invoices", "24 řádků do tabulky Faktury"] },
    ],
};

/** When each stage begins, in ms from the file's arrival: found, typed, read (a row at a
 *  time), dropped, flagged, closed up into the table. */
const AT = [0, 900, 2000, 3000, 5000, 6000, 7200];
const PER_ROW = 260;
const END = AT[6];
/** How long a finished read stands before the file is read again on its own. */
const REST = 4200;
const TYPE_ICON: Record<Ty, string> = { text: "letter-case", date: "calendar", decimal: "decimal", bool: "toggle-left" };
const LETTERS = "ABCDEFG";

const stageAt = (t: number) => AT.reduce((s, at, i) => (t >= at ? i : s), 0);

export function ReadScreen() {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);
  const seen = useSeen(root, 0.4);
  const [ms, setMs] = useState(prefersLessMotion() ? END : -1);
  const timer = useRef(0);
  const auto = useRef(true);

  /** The file arrives and is read: the clock runs from its arrival to the table, then stops. */
  const read = useCallback(() => {
    clearInterval(timer.current);
    if (prefersLessMotion()) return setMs(END);
    const t0 = performance.now();
    setMs(0);
    timer.current = window.setInterval(() => {
      const d = performance.now() - t0;
      setMs(Math.min(d, END));
      if (d >= END) clearInterval(timer.current);
    }, 90);
  }, []);
  useEffect(() => () => clearInterval(timer.current), []);

  // Plays by itself once in view, round and round, until the visitor presses or types anything
  // inside the window; then Read again is theirs to press.
  useEffect(() => {
    const el = root.current;
    if (!seen || !el) return;
    if (ms < 0) return read();
    if (ms < END || !auto.current) return;
    const id = window.setTimeout(() => auto.current && read(), REST);
    return () => clearTimeout(id);
  }, [seen, ms, read]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const stop = (e: Event) => {
      if (e.isTrusted) auto.current = false;
    };
    el.addEventListener("pointerdown", stop, true);
    el.addEventListener("keydown", stop, true);
    return () => {
      el.removeEventListener("pointerdown", stop, true);
      el.removeEventListener("keydown", stop, true);
    };
  }, []);

  const S = FILE;
  const stage = ms < 0 ? 0 : stageAt(ms);
  const rowsRead = ms < AT[3] ? 0 : Math.floor((ms - AT[3]) / PER_ROW) + 1;
  const done = stage >= 6;
  const busy = ms >= 0 && !done;

  return (
    <div className="tt" ref={root}>
      <Head icon="file-spreadsheet" title={S.file} sub={t(`${S.from[0]} · read by itself, no mapping, no clean-up by hand`, `${S.from[1]} · načte se sám, bez mapování a ručního čištění`)}>
        <button className={`tt-btn is-primary${busy ? " is-busy" : ""}`} onClick={read} disabled={busy}>
          {busy ? <I n="loader-2" className="tt-spin" /> : <I n="refresh" />}
          {busy ? t("Reading", "Načítá se") : t("Read again", "Načíst znovu")}
        </button>
      </Head>
      <div className="tt-main">
        <div className="tt-card">
          <div className="tt-gridbox">
            <Sheet S={S} stage={stage} rowsRead={rowsRead} />
          </div>
          <div className="tt-foot">
            {done ? (
              <span className="is-ok">
                <I n="circle-check" /> <b className="is-ok">{t("Read.", "Načteno.")}</b> {t(...S.log[S.log.length - 1].text)} · {t("0.6 s", "0,6 s")}
              </span>
            ) : (
              <span>
                <I n="loader-2" className="tt-spin" /> {t(`Reading ${S.file}…`, `Načítá se ${S.file}…`)}
              </span>
            )}
          </div>
        </div>
        <Side
          icon={<I n="wand" />}
          title={t("Read automatically", "Načteno automaticky")}
          sub={t("step by step", "krok za krokem")}
          foot={
            <span className="rd-every">
              <I n="refresh" />
              {t("Kept with the source: every file that arrives is read the same way. Next: Mon 06:00", "Uloženo se zdrojem: každý soubor, který dorazí, se načte stejně. Další: po 06:00")}
            </span>
          }
        >
          <ol className="rd-log">
            {S.log
              .filter((e) => stage >= e.s)
              .map((e) => (
                <li key={e.s} className={e.tone ? `is-${e.tone}` : ""}>
                  <I n={e.icon} />
                  <span>{t(...e.text)}</span>
                </li>
              ))}
          </ol>
        </Side>
      </div>
    </div>
  );
}

/** The file as it arrived, read in place: a margin on the right says what each line turned
 *  out to be, and when the read is done the lines that are not the table close up. */
function Sheet({ S, stage, rowsRead }: { S: Src; stage: number; rowsRead: number }) {
  const t = useT();
  const done = stage >= 6;
  let physical = 0;
  let data = 0;
  let readSoFar = 0;
  const track = (c: Src["cols"][number]) => `minmax(0,${c.fr ?? 1}fr)`;
  return (
    <div
      className={`rd-sheet${done ? " is-done" : ""}`}
      style={{ "--n": S.cols.length, "--cols": S.cols.map(track).join(" "), "--cols-sm": S.cols.filter((c) => !c.smHide).map(track).join(" ") } as CSSProperties}
    >
      <div className="rd-line rd-colbar">
        <span className="rd-rn" />
        {S.cols.map((c, i) => (
          <span key={c.name} className={`rd-c rd-ch${stage >= 2 ? " is-typed" : ""}${c.ty === "decimal" ? " is-num" : ""}${c.smHide ? " tt-sm-hide" : ""}`} style={{ "--i": i } as CSSProperties}>
            {stage >= 2 ? (
              <>
                <I n={TYPE_ICON[c.ty]} />
                {c.name}
                {c.key && <I n="key" className="tt-key" />}
              </>
            ) : (
              LETTERS[i]
            )}
          </span>
        ))}
        <span className="rd-why" />
      </div>
      {S.lines.map((ln, i) => {
        physical += ln.k === "more" ? ln.n : 1;
        if (ln.k === "row") data += 1;
        if (ln.k === "more") data += ln.n;
        const isRead = (ln.k === "row" || ln.k === "more") && ++readSoFar <= rowsRead;
        const rn = ln.k === "more" ? "⋮" : done && ln.k === "row" ? data : physical;
        return <SheetLine key={i} S={S} ln={ln} rn={rn} stage={stage} read={isRead} t={t} />;
      })}
    </div>
  );
}

function SheetLine({ S, ln, rn, stage, read, t }: { S: Src; ln: Line; rn: number | string; stage: number; read: boolean; t: (en: string, cs: string) => string }) {
  const skipped = (ln.k === "title" || ln.k === "blank") && stage >= 1;
  const dropped = ln.k === "drop" && stage >= 4;
  const flagged = ln.k === "row" && ln.bad !== undefined && stage >= 5;
  // The header line goes too once the read is done: its names are the columns' now.
  const gone = stage >= 6 && (skipped || dropped || ln.k === "head");
  const why: [Two, string] | null =
    ln.k === "head" && stage >= 1
      ? [["Header found", "Záhlaví nalezeno"], "is-found"]
      : ln.k === "title" && stage >= 1
        ? [["Title: skipped", "Nadpis: přeskočen"], "is-skip"]
        : ln.k === "blank" && stage >= 1
          ? [["Blank: skipped", "Prázdný: vynechán"], "is-skip"]
          : dropped && ln.k === "drop"
            ? [ln.why, "is-skip"]
            : flagged
              ? [["1 value flagged", "1 hodnota označena"], "is-warn"]
              : read
                ? [["Read", "Načteno"], "is-ok"]
                : null;
  const cls = [
    "rd-line",
    `is-${ln.k}`,
    skipped || dropped ? "is-skipped" : "",
    ln.k === "head" && stage >= 1 ? "is-found" : "",
    ln.k === "head" && stage >= 2 ? "is-lifted" : "",
    read ? "is-read" : "",
    gone ? "is-gone" : "",
  ];
  return (
    <div className={cls.filter(Boolean).join(" ")}>
      <span className="rd-rn">{rn}</span>
      {ln.k === "blank" ? (
        <span className="rd-c rd-span" />
      ) : ln.k === "title" ? (
        <span className="rd-c rd-span">{ln.text}</span>
      ) : ln.k === "more" ? (
        <span className="rd-c rd-span">
          {read ? t(`${ln.n} more rows, read the same way`, `dalších ${ln.n} řádků, načtených stejně`) : t(`${ln.n} more rows`, `dalších ${ln.n} řádků`)}
        </span>
      ) : (
        ln.cells.map((raw, j) => <Cell key={j} S={S} ln={ln} j={j} raw={raw} read={read} flagged={flagged} t={t} />)
      )}
      <span className={`rd-why${why ? ` ${why[1]}` : ""}`}>{why && t(...why[0])}</span>
    </div>
  );
}

function Cell({ S, ln, j, raw, read, flagged, t }: { S: Src; ln: Line; j: number; raw: string; read: boolean; flagged: boolean; t: (en: string, cs: string) => string }) {
  const lang = t("en", "cs") as "en" | "cs";
  const col = S.cols[j];
  const num0 = col.ty === "decimal";
  const rc = `rd-c${col.smHide ? " tt-sm-hide" : ""}`;
  if (ln.k !== "row" || !read) return <span className={`${rc}${num0 ? " is-num" : ""}`}>{raw}</span>;
  const v = ln.v[j];
  if (ln.bad === j) return <span className={`${rc} is-num${flagged ? " is-bad" : ""}`}>{raw}</span>;
  const shown = typeof v === "boolean" ? (v ? t("Yes", "Ano") : t("No", "Ne")) : typeof v === "number" ? num(lang, v, 2) : v;
  const changed = shown !== raw;
  return (
    <span className={`${rc}${num0 ? " is-num" : ""}${changed ? " is-conv" : ""}`}>
      {typeof v === "boolean" ? <span className={`rd-bool${v ? " is-yes" : ""}`}>{shown}</span> : shown}
    </span>
  );
}

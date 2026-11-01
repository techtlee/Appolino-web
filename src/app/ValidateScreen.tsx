import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import { fold, readNumber } from "../czech";
import { count, num, useLang, useT, type Lang } from "../i18n";
import { prefersLessMotion, useSeen } from "../motion";
import { EditCell, Head, I, Side, Status, Th } from "./kit";

/**
 * Validate with the table's rules beside it, in two kinds. Structure: the
 * input's columns against the table's (today's export brought a new one,
 * Region - Kraj in Czech), the row count against the last import, the key,
 * empty rows. Values: a number that is not one, a status the list does not
 * know, a city spelled four ways. The rules are listed before anything runs;
 * Validate passes a band of daylight down the rows and each rule answers in
 * turn - a tick, or how many break it, marked in the grid. Pointing at a rule
 * warms its cells; Fix (or Fix all) applies appolino's own fix, Accept takes
 * the new column in, and what a fix decided is kept for the next import. Any
 * cell can be edited by hand, and the rules read it again at once. Found
 * without AI. The companies are invented. Until the visitor presses or types
 * anything in it, the screen plays all of this itself, round after round.
 */

type Row = { id: number; no: string; customer: string; city: string; amount: string; status: string; region: string };
type Col = Exclude<keyof Row, "id">;

/** The example in each language. Czech mode keeps what a Czech export brings,
 *  written the Czech way; English mode has English values written the English
 *  way. Both carry the same faults in the same rows - FV-2026-102 twice, "6k",
 *  a status the list does not know, the capital spelled four ways, an empty
 *  last row - so every rule finds and fixes the same things in either
 *  language. A status the list knows stays its English key (Paid, Open,
 *  Overdue), because the pill is drawn from the key and words it itself; only
 *  the stray one is written in the export's own words. */
type Example = {
  table: string;
  /** The column today's input brings that the table does not have. */
  region: string;
  /** The capital as the table spells it; every other spelling is the fault. */
  city: string;
  /** The status the list does not know, which means Paid. */
  odd: string;
  /** "6k" as the fix writes it. */
  six: string;
  rows: Row[];
  /** A summary someone left under the data (owner, 2026-11-01: "under the table add another
   *  pivot table that is detected and removed"): a title line and a total for each city, in
   *  the table's City and Amount columns. None of its lines has an invoice number, so none is
   *  a row - the reader's own rule, a row needs its key - and a rule takes it out. */
  sum: { title: string; lines: [string, string][] };
};

const EXAMPLE: Record<Lang, Example> = {
  cs: {
    table: "Faktury",
    region: "Kraj",
    city: "Praha",
    odd: "zaplaceno",
    six: "6 000,00",
    rows: [
      { id: 1, no: "FV-2026-101", customer: "Pekárna U Mlýna s.r.o.", city: "Praha", amount: "12 840,00", status: "Paid", region: "Praha" },
      { id: 2, no: "FV-2026-102", customer: "Zahradnictví Hájek", city: "PRAHA", amount: "5 699,00", status: "Open", region: "Jihomoravský" },
      { id: 3, no: "FV-2026-102", customer: "Zahradnictví Hájek", city: "Praha ", amount: "5 699,00", status: "", region: "Jihomoravský" },
      { id: 4, no: "FV-2026-104", customer: "Truhlářství Novák", city: "Brno", amount: "6k", status: "Open", region: "Jihomoravský" },
      { id: 5, no: "fv 2026/105", customer: "Kavárna Na Rohu", city: "praha", amount: "845,00", status: "Overdue", region: "Praha" },
      { id: 6, no: "FV-2026-106", customer: "Elektro Svoboda a.s.", city: "Ostrava", amount: "3 120,50", status: "zaplaceno", region: "Moravskoslezský" },
      { id: 7, no: "FV-2026-107", customer: "Moravská vinotéka", city: "Brno", amount: "2 410,00", status: "Open", region: "Jihomoravský" },
      { id: 8, no: "", customer: "", city: "", amount: "", status: "", region: "" },
    ],
    sum: {
      title: "Součet podle města",
      lines: [
        ["Praha", "25 083,00"],
        ["Brno", "8 410,00"],
        ["Ostrava", "3 120,50"],
      ],
    },
  },
  en: {
    table: "Invoices",
    region: "Region",
    city: "Prague",
    odd: "PAID",
    six: "6,000.00",
    rows: [
      { id: 1, no: "FV-2026-101", customer: "Mill Lane Bakery Ltd", city: "Prague", amount: "12,840.00", status: "Paid", region: "Prague" },
      { id: 2, no: "FV-2026-102", customer: "Hajek Garden Centre", city: "PRAGUE", amount: "5,699.00", status: "Open", region: "South Moravia" },
      { id: 3, no: "FV-2026-102", customer: "Hajek Garden Centre", city: "Prague ", amount: "5,699.00", status: "", region: "South Moravia" },
      { id: 4, no: "FV-2026-104", customer: "Novak Joinery", city: "Brno", amount: "6k", status: "Open", region: "South Moravia" },
      { id: 5, no: "fv 2026/105", customer: "The Corner Café", city: "prague", amount: "845.00", status: "Overdue", region: "Prague" },
      { id: 6, no: "FV-2026-106", customer: "Svoboda Electric plc", city: "Ostrava", amount: "3,120.50", status: "PAID", region: "Moravia-Silesia" },
      { id: 7, no: "FV-2026-107", customer: "Moravian Wine Cellar", city: "Brno", amount: "2,410.00", status: "Open", region: "South Moravia" },
      { id: 8, no: "", customer: "", city: "", amount: "", status: "", region: "" },
    ],
    sum: {
      title: "Total by city",
      lines: [
        ["Prague", "25,083.00"],
        ["Brno", "8,410.00"],
        ["Ostrava", "3,120.50"],
      ],
    },
  },
};

/** The table's own columns, each named in English and Czech; Region is new in
 *  today's input and not yet one of them. */
const COLS: [Col, [string, string], string][] = [
  ["no", ["Invoice no.", "Číslo faktury"], "text"],
  ["customer", ["Customer", "Odběratel"], "text"],
  ["city", ["City", "Město"], "text"],
  ["amount", ["Amount (CZK)", "Částka (Kč)"], "decimal"],
  ["status", ["Status", "Stav"], "select"],
];
const CHOICES = ["Paid", "Open", "Overdue"];
const LAST_IMPORT = 8;

const blank = (r: Row) => COLS.every(([c]) => !r[c].trim());
const filled = (rows: Row[]) => rows.filter((r) => !blank(r));
const cellsOf = (rows: Row[], c: Col) => rows.map((r) => `${r.id}:${c}`);
const ruleCount = (lang: Lang, n: number) => count(lang, n, ["rule", "rules"], ["pravidlo", "pravidla", "pravidel"]);

/* ------------------------------------------------------------------- rules */

/** `summary`: the block under the data is still there. */
type T = { rows: Row[]; accepted: boolean; summary: boolean };
/** Every cell of the summary's lines, its title line first, as the grid keys them. */
const sumCells = (ex: Example) => Array.from({ length: ex.sum.lines.length + 1 }, (_, i) => COLS.map(([c]) => `sum:${i}:${c}`)).flat();
type Hit = { cells: string[]; n: number; detail: string };
type Group = "Structure" | "Values";
type Rule = {
  id: string;
  group: Group;
  icon: string;
  title: string;
  what: string;
  after: string;
  /** The fix button's word and what the rule says once it is done, when not Fix and Fixed. */
  fix?: string;
  done?: string;
  soft?: boolean;
  kept?: string;
  find: (t: T) => Hit | null;
  apply: (t: T) => T;
};

const GROUP: Record<Group, [string, string]> = { Structure: ["Structure", "Struktura"], Values: ["Values", "Hodnoty"] };

/** The rules in the page's language, over that language's example: their
 *  words change, what they find and fix does not. */
function rulesFor(lang: Lang, ex: Example): Rule[] {
  const t = <V,>(en: V, cs: V): V => (lang === "cs" ? cs : en);
  const q = (s: string) => t(`“${s}”`, `„${s}“`);
  const capital = (rows: Row[]) => filled(rows).filter((r) => fold(r.city) === fold(ex.city) && r.city !== ex.city);
  return [
    {
      id: "schema",
      group: "Structure",
      icon: "columns-3",
      title: t("Columns as expected", "Sloupce podle očekávání"),
      what: t("The input matches the table", "Vstup odpovídá tabulce"),
      after: t(`${ex.region} is a column of ${ex.table} now`, `${ex.region} je teď sloupec tabulky ${ex.table}`),
      fix: t("Accept", "Přijmout"),
      done: t("Accepted", "Přijato"),
      soft: true,
      kept: t(`${ex.region} joins ${ex.table} as Text, for every import from now on`, `${ex.region} se přidá do tabulky ${ex.table} jako Text, pro všechny další importy`),
      find: (x) =>
        x.accepted ? null : { cells: [...cellsOf(x.rows, "region"), "head:region"], n: 1, detail: t(`New in the input: ${ex.region}`, `Ve vstupu je nový sloupec ${ex.region}`) },
      apply: (x) => ({ ...x, accepted: true }),
    },
    {
      id: "count",
      group: "Structure",
      icon: "list-details",
      title: t("Row count as usual", "Počet řádků jako obvykle"),
      what: t("Within 30 % of the last import", "Odchylka od minulého importu nejvýš 30 %"),
      after: "",
      find: (x) => {
        const n = filled(x.rows).length;
        const rows = count(lang, n, ["row", "rows"], ["řádek", "řádky", "řádků"]);
        return Math.abs(n - LAST_IMPORT) / LAST_IMPORT > 0.3
          ? { cells: [], n: 1, detail: t(`${rows}, last import ${LAST_IMPORT}`, `${rows}, minulý import ${LAST_IMPORT}`) }
          : null;
      },
      apply: (x) => x,
    },
    {
      id: "unique",
      group: "Structure",
      icon: "key",
      title: t("Invoice no. is unique", "Číslo faktury je jedinečné"),
      what: t("One row per invoice", "Každá faktura na jednom řádku"),
      after: t("The copy is removed", "Duplicitní řádek je odstraněn"),
      find: ({ rows }) => {
        const live = filled(rows);
        const dup = live.filter((r) => live.filter((x) => x.no === r.no).length > 1);
        return dup.length ? { cells: cellsOf(dup, "no"), n: dup.length, detail: t(`${dup[0].no} is there twice`, `${dup[0].no} je tu dvakrát`) } : null;
      },
      // Of the rows that share a number, the one with the most filled in stays.
      apply: (x) => {
        const score = (r: Row) => COLS.filter(([c]) => r[c].trim()).length;
        const rows = x.rows.filter((r) => blank(r) || !x.rows.some((o) => o.id !== r.id && o.no === r.no && (score(o) > score(r) || (score(o) === score(r) && o.id < r.id))));
        return { ...x, rows };
      },
    },
    {
      id: "blank",
      group: "Structure",
      icon: "row-remove",
      title: t("No empty rows", "Žádné prázdné řádky"),
      what: t("Every row has values", "Každý řádek má vyplněné hodnoty"),
      after: t("The empty row is removed", "Prázdný řádek je odstraněn"),
      find: ({ rows }) => {
        const bad = rows.filter(blank);
        const at = rows.indexOf(bad[0]) + 1;
        return bad.length
          ? { cells: bad.flatMap((r) => COLS.map(([c]) => `${r.id}:${c}`)), n: bad.length, detail: t(`Row ${at} is empty`, `Řádek ${at} je prázdný`) }
          : null;
      },
      apply: (x) => ({ ...x, rows: x.rows.filter((r) => !blank(r)) }),
    },
    {
      // True to bdop's reader: the table is its rows, and a line without its key is not one.
      id: "summary",
      group: "Structure",
      icon: "sum",
      title: t("Only the table's rows", "Jen řádky tabulky"),
      what: t("A row needs its invoice number", "Řádek potřebuje číslo faktury"),
      after: t("The summary is removed", "Souhrn pod daty je odstraněn"),
      kept: t("A summary under the data is left out of every import", "Souhrn pod daty se při každém importu vynechá"),
      find: (x) => {
        if (!x.summary) return null;
        const n = ex.sum.lines.length + 1;
        const lines = count(lang, n, ["row", "rows"], ["řádek", "řádky", "řádků"]);
        return { cells: sumCells(ex), n, detail: t(`Summary under the data: ${lines}`, `Souhrn pod daty: ${lines}`) };
      },
      apply: (x) => ({ ...x, summary: false }),
    },
    {
      id: "number",
      group: "Values",
      icon: "decimal",
      title: t("Amount is a number", "Částka je číslo"),
      what: t("Every amount reads as CZK", "Každá částka je číslo v Kč"),
      after: t(`${q("6k")} now reads ${ex.six}`, `${q("6k")} se teď čte jako ${ex.six}`),
      kept: t(`${q("6k")} is read as ${ex.six}`, `${q("6k")} se čte jako ${ex.six}`),
      find: ({ rows }) => {
        const bad = filled(rows).filter((r) => r.amount && readNumber(r.amount) === null);
        return bad.length ? { cells: cellsOf(bad, "amount"), n: bad.length, detail: t(`${q(bad[0].amount)} is not a number`, `${q(bad[0].amount)} není číslo`) } : null;
      },
      apply: (x) => ({ ...x, rows: x.rows.map((r) => (r.amount === "6k" ? { ...r, amount: ex.six } : r)) }),
    },
    {
      id: "negative",
      group: "Values",
      icon: "math-function",
      title: t("Amount is never negative", "Částka nikdy není záporná"),
      what: t("No amount below zero", "Žádná částka pod nulou"),
      after: "",
      find: ({ rows }) => {
        const bad = filled(rows).filter((r) => (readNumber(r.amount) ?? 0) < 0);
        const n = count(lang, bad.length, ["below zero", "below zero"], ["částka pod nulou", "částky pod nulou", "částek pod nulou"]);
        return bad.length ? { cells: cellsOf(bad, "amount"), n: bad.length, detail: n } : null;
      },
      apply: (x) => x,
    },
    {
      id: "list",
      group: "Values",
      icon: "list-check",
      title: t("Status is in the list", "Stav je ze seznamu"),
      what: t("Paid, Open or Overdue", "Zaplaceno, Otevřeno nebo Po splatnosti"),
      after: t(`${q(ex.odd)} is now Paid`, `${q(ex.odd)} je teď Zaplaceno`),
      kept: t(`${q(ex.odd)} means Paid`, `${q(ex.odd)} znamená Zaplaceno`),
      find: ({ rows }) => {
        const bad = filled(rows).filter((r) => r.status && !CHOICES.includes(r.status));
        return bad.length
          ? { cells: cellsOf(bad, "status"), n: bad.length, detail: t(`${q(bad[0].status)} is not in the list`, `${q(bad[0].status)} v seznamu není`) }
          : null;
      },
      apply: (x) => ({ ...x, rows: x.rows.map((r) => (r.status === ex.odd ? { ...r, status: "Paid" } : r)) }),
    },
    {
      id: "city",
      group: "Values",
      icon: "text-spellcheck",
      title: t("City is written one way", "Město je zapsané jednotně"),
      what: t("One spelling per city", "Jeden zápis pro každé město"),
      after: t(`All spelled ${ex.city}`, `Všude je teď ${ex.city}`),
      soft: true,
      kept: t(
        `${ex.city.toUpperCase()}, ${ex.city.toLowerCase()} and ${q(`${ex.city} `)} become ${ex.city}`,
        `${ex.city.toUpperCase()}, ${ex.city.toLowerCase()} a ${q(`${ex.city} `)} se zapíší jako ${ex.city}`,
      ),
      find: ({ rows }) => {
        const bad = capital(rows);
        const ways = count(lang, bad.length + 1, ["spelling", "spellings"], ["zápis", "zápisy", "zápisů"]);
        // Czech names the city in the genitive, which the example's one Czech city has as Prahy.
        return bad.length ? { cells: cellsOf(bad, "city"), n: bad.length, detail: t(`${ways} of ${ex.city}`, `${ways} Prahy`) } : null;
      },
      apply: (x) => ({ ...x, rows: x.rows.map((r) => (fold(r.city) === fold(ex.city) ? { ...r, city: ex.city } : r)) }),
    },
  ];
}

/** A rule appolino suggests from what the values already keep - most invoice
 *  numbers look like FV-2026-101 - added with one click, and fixable at once. */
const PATTERN = /^FV-\d{4}-\d{3}$/;
const SUGGESTED_ID = "pattern";
function suggestedFor(lang: Lang): Rule {
  const t = <V,>(en: V, cs: V): V => (lang === "cs" ? cs : en);
  const q = (s: string) => t(`“${s}”`, `„${s}“`);
  return {
    id: SUGGESTED_ID,
    group: "Values",
    icon: "abc",
    title: t("Invoice no. looks like FV-2026-000", "Číslo faktury má tvar FV-2026-000"),
    what: t("A pattern the other numbers keep", "Tvar, který mají ostatní čísla"),
    after: t(`${q("fv 2026/105")} now reads FV-2026-105`, `${q("fv 2026/105")} je teď FV-2026-105`),
    kept: t(`${q("fv 2026/105")} is written FV-2026-105`, `${q("fv 2026/105")} se zapíše jako FV-2026-105`),
    find: ({ rows }) => {
      const bad = filled(rows).filter((r) => r.no && !PATTERN.test(r.no));
      return bad.length ? { cells: cellsOf(bad, "no"), n: bad.length, detail: t(`${q(bad[0].no)} does not match`, `${q(bad[0].no)} tvaru neodpovídá`) } : null;
    },
    apply: (x) => ({
      ...x,
      rows: x.rows.map((r) => {
        const m = r.no.match(/^fv\D*(\d{4})\D*(\d{3})$/i);
        return m && !PATTERN.test(r.no) ? { ...r, no: `FV-${m[1]}-${m[2]}` } : r;
      }),
    }),
  };
}

/** Each rule answers this long after Validate is pressed, while the light passes. */
const answerAt = (n: number) => Array.from({ length: n }, (_, i) => 300 + i * 190);

type Phase = "idle" | "running" | "done";

/* ------------------------------------------------------------------ screen */

/** The screen starts afresh in the other language: its rows, rules and what a
 *  fix kept are all written in the language they were made in, so a switch
 *  mid-way would leave Czech rows under English rules. */
export function ValidateScreen() {
  const lang = useLang();
  return <Screen key={lang} lang={lang} />;
}

function Screen({ lang }: { lang: Lang }) {
  const t = useT();
  const [{ ex, base, suggested }] = useState(() => ({ ex: EXAMPLE[lang], base: rulesFor(lang, EXAMPLE[lang]), suggested: suggestedFor(lang) }));
  const [rows, setRows] = useState<Row[]>(ex.rows);
  const [accepted, setAccepted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [answered, setAnswered] = useState(0);
  const [sweep, setSweep] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [fixed, setFixed] = useState<Set<string>>(new Set());
  const [kept, setKept] = useState<string[]>([]);
  const [flash, setFlash] = useState<{ cells: Set<string>; at: number }>({ cells: new Set(), at: 0 });
  const [leaving, setLeaving] = useState<Set<number>>(new Set());
  const [typed, setTyped] = useState<Record<string, number>>({});
  const [added, setAdded] = useState(false);
  const [summary, setSummary] = useState(true);
  /** The summary on its way out: struck through, then closing up, then gone. */
  const [sumGoing, setSumGoing] = useState<"" | "struck" | "closing">("");
  const [caption, setCaption] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const rules = added ? [...base, suggested] : base;
  const now: T = { rows, accepted, summary };
  const hits = rules.map((r, i) => (phase === "done" || (phase === "running" && i < answered) ? r.find(now) : undefined));
  const failing = rules.filter((_, i) => hits[i]);
  const passing = rules.length - failing.length;

  const flagged = new Map<string, "bad" | "soft">();
  rules.forEach((r, i) => hits[i]?.cells.forEach((k) => flagged.set(k, r.soft ? "soft" : "bad")));
  const hot = new Set(hover ? (hits[rules.findIndex((r) => r.id === hover)]?.cells ?? []) : []);

  const validate = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setHover(null);
    if (prefersLessMotion()) {
      setPhase("done");
      return;
    }
    setPhase("running");
    setAnswered(0);
    setSweep((s) => s + 1);
    const times = answerAt(rules.length);
    times.forEach((at, i) => later(at, () => setAnswered(i + 1)));
    later(times[times.length - 1] + 300, () => setPhase("done"));
  };

  /** Applies the fixes of the rules named, in order, each to what the one
   *  before left. Changed cells glow once; removed rows fade before they go. */
  const fix = (ids: string[]) => {
    let next = now;
    const note: string[] = [];
    ids.forEach((id) => {
      const r = rules.find((x) => x.id === id)!;
      if (!r.find(next) || !r.after) return;
      next = r.apply(next);
      if (r.kept) note.push(r.kept);
    });
    const changed = new Set<string>();
    next.rows.forEach((r) => {
      const before = rows.find((x) => x.id === r.id);
      if (before) COLS.forEach(([c]) => before[c] !== r[c] && changed.add(`${r.id}:${c}`));
    });
    if (next.accepted && !accepted) next.rows.forEach((r) => changed.add(`${r.id}:region`));
    const gone = rows.filter((r) => !next.rows.some((x) => x.id === r.id)).map((r) => r.id);
    setFixed((f) => new Set([...f, ...ids]));
    setKept((k) => [...k, ...note]);
    setFlash({ cells: changed, at: Date.now() });
    setHover(null);
    setAccepted(next.accepted);
    if (gone.length && !prefersLessMotion()) {
      setLeaving(new Set(gone));
      later(400, () => {
        setRows(next.rows);
        setLeaving(new Set());
      });
    } else setRows(next.rows);
    // The summary is struck through where it stands, then the table closes up over it.
    if (summary && !next.summary && !sumGoing) {
      if (prefersLessMotion()) setSummary(false);
      else {
        setSumGoing("struck");
        later(550, () => setSumGoing("closing"));
        later(950, () => {
          setSummary(false);
          setSumGoing("");
        });
      }
    }
  };

  /** A value typed into a cell: kept as typed, and the rules read it again at once. */
  const edit = (id: number, c: Col, v: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [c]: v } : r)));
    setTyped((x) => ({ ...x, [`${id}:${c}`]: Date.now() }));
  };

  const restart = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setTyped({});
    setRows(ex.rows);
    setAccepted(false);
    setSummary(true);
    setSumGoing("");
    setAdded(false);
    setPhase("idle");
    setAnswered(0);
    setFixed(new Set());
    setKept([]);
    setLeaving(new Set());
    setFlash({ cells: new Set(), at: 0 });
  };

  const live = useRef<Live | null>(null);
  live.current = {
    phase,
    fixable: failing.filter((r) => r.after).map((r) => r.id),
    settled: !leaving.size && !sumGoing,
    validate,
    fix,
    add: () => setAdded(true),
    restart,
    setHover,
  };
  useAutoplay(root, live, setCaption);

  const invoices = count(lang, filled(rows).length, ["invoice", "invoices"], ["faktura", "faktury", "faktur"]);
  const ruled = ruleCount(lang, rules.length);
  return (
    <div className="tt" ref={root}>
      <Head
        icon="table"
        title={ex.table}
        sub={t(`Today's import · ${invoices} from SharePoint · ${ruled}, run on every import`, `Dnešní import · ${invoices} ze SharePointu · ${ruled}, která běží při každém importu`)}
      >
        <button className={`tt-btn is-primary${phase === "idle" ? " is-nudge" : ""}${phase === "running" ? " is-busy" : ""}`} onClick={validate} disabled={phase === "running"}>
          {phase === "running" ? <I n="loader-2" className="tt-spin" /> : <I n="checks" />}
          {phase === "running" ? t("Validating", "Kontroluje se") : phase === "done" ? t("Validate again", "Zkontrolovat znovu") : t("Validate", "Zkontrolovat")}
        </button>
      </Head>
      <div className="tt-main">
        <div className="tt-card">
          <div className="tt-gridbox">
            <Grid rows={rows} region={ex.region} accepted={accepted} flagged={flagged} hot={hot} flash={flash} leaving={leaving} typed={typed} edit={edit} sum={summary ? ex.sum : null} sumGoing={sumGoing} />
            {phase === "running" && <span className="tt-sweep" key={sweep} aria-hidden />}
          </div>
          {/* Not a live region: a screen reader would announce it every few seconds for as long
              as the page is open, and what it names is on the screen already. */}
          {caption !== null && (
            <div className="tt-tour" key={caption}>
              <b>{t(`${SAID_AT[caption]} of ${STEPS}`, `${SAID_AT[caption]} z ${STEPS}`)}</b>
              {SAY[lang][caption]}
            </div>
          )}
          <div className="tt-foot">
            {phase === "done" && !failing.length ? (
              <span className="is-ok">
                <I n="circle-check" /> <b className="is-ok">{t("Clean.", "Bez chyb.")}</b>{" "}
                {t("Every value fits its rules. Ready for the pipeline.", "Každá hodnota splňuje svá pravidla. Připraveno pro pipeline.")}
              </span>
            ) : phase === "done" ? (
              <span>
                <I n="info-circle" />{" "}
                {t("Point at a rule to see its cells, or click a cell to correct it yourself.", "Najeďte na pravidlo a uvidíte jeho buňky, nebo klikněte do buňky a opravte ji sami.")}
              </span>
            ) : (
              <span>
                <I n="checks" />{" "}
                {t(
                  "Press Validate to check the structure and every value against the rules. No AI, the same answer every time.",
                  "Tlačítko Zkontrolovat porovná strukturu i každou hodnotu s pravidly. Bez AI, pokaždé se stejným výsledkem.",
                )}
              </span>
            )}
          </div>
        </div>
        <Rules
          rules={rules}
          hits={hits}
          phase={phase}
          answered={answered}
          passing={passing}
          failing={failing}
          fixed={fixed}
          kept={kept}
          hover={hover}
          setHover={setHover}
          fix={fix}
          restart={restart}
          suggested={suggested}
          add={added ? undefined : () => setAdded(true)}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- autoplay */

/** What the autoplay says at each beat, in the line over the grid. Accept-and-Fix and Fix all
 *  are the same step told two ways, because the rounds take turns at them. */
const SAY: Record<Lang, string[]> = {
  en: [
    "Each rule answers in turn: a tick, or how many values break it.",
    "Each failing rule marks its cells in the grid.",
    "Accept takes the new column in, Fix applies appolino's own fix.",
    "Fix all applies every fix at once.",
    "Clean. Every fix is remembered for the next import.",
    "A rule suggested from the values, added with one click, and fixed.",
  ],
  cs: [
    "Pravidla odpovídají postupně: fajfkou, nebo počtem hodnot, které je porušují.",
    "Každé porušené pravidlo vyznačí své buňky v tabulce.",
    "Přijmout přidá nový sloupec do tabulky, Opravit použije opravu, kterou navrhne appolino.",
    "Opravit vše použije všechny opravy naráz.",
    "Bez chyb. Každou opravu si appolino zapamatuje pro příští import.",
    "Pravidlo navržené z hodnot, přidané jedním kliknutím a hned opravené.",
  ],
};
/** Which of the five steps each line is. */
const SAID_AT = [1, 2, 3, 3, 4, 5];
const STEPS = 5;

/** The screen as the autoplay finds it, written afresh each render, so a press acts on the
 *  rows and rules as they are and not as they were when the round began. */
type Live = {
  phase: Phase;
  /** The failing rules a fix can mend, in the panel's order, so Accept comes first. */
  fixable: string[];
  /** No removed row is still fading out, so the rows are the ones the rules read. */
  settled: boolean;
  validate: () => void;
  fix: (ids: string[]) => void;
  add: () => void;
  restart: () => void;
  setHover: Dispatch<SetStateAction<string | null>>;
};

/** Validate plays itself, round after round, from the first time it is seen (owner,
 *  2026-11-01: "there should always be some kind of loop playing in all tabs"). It presses
 *  what a visitor would press - Validate, Accept and each Fix (or Fix all, every other round),
 *  the suggested rule, Start over - through the same functions the buttons call, so it can
 *  show nothing the screen would not do. Where the screen has a phase of its own it waits for
 *  that rather than for a clock, so a slower machine only plays slower. Before each Fix it
 *  points at the rule, as a pointer would, to warm its cells. The visitor's first press or
 *  key in the screen stops it where it is, for as long as the screen is mounted, even before
 *  it has begun; with less motion asked for it does not play at all. */
function useAutoplay(root: RefObject<HTMLElement>, live: MutableRefObject<Live | null>, say: (line: number | null) => void) {
  const seen = useSeen(root, 0.4);
  const taken = useRef(false);
  const halt = useRef(() => {});
  const waiting = useRef<(() => void) | null>(null);

  // Any render may be the one a wait is for: the phase turning done, a removed row gone.
  useEffect(() => {
    waiting.current?.();
  });

  // Listening from the start, so a visitor who acts before the screen counts as seen is never
  // overruled by a round starting under them. Synthetic events are not a visitor.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const take = (e: Event) => {
      if (!e.isTrusted) return;
      taken.current = true;
      halt.current();
      off();
    };
    const off = () => {
      el.removeEventListener("pointerdown", take, true);
      el.removeEventListener("keydown", take, true);
    };
    el.addEventListener("pointerdown", take, true);
    el.addEventListener("keydown", take, true);
    return off;
  }, [root]);

  useEffect(() => {
    if (!seen || taken.current || prefersLessMotion()) return;
    let on = true;
    let pointed: string | null = null;
    const timers: number[] = [];
    const now = () => live.current!;
    // Once stopped, neither a wait nor a timer resolves again, so the story halts mid-step.
    const wait = (ms: number) =>
      new Promise<void>((go) => {
        timers.push(window.setTimeout(() => on && go(), ms));
      });
    const until = (ready: (x: Live) => boolean) =>
      new Promise<void>((go) => {
        waiting.current = () => {
          if (!on || !ready(now())) return;
          waiting.current = null;
          go();
        };
        waiting.current();
      });
    const point = (id: string) => {
      pointed = id;
      now().setHover(id);
    };
    /** Points at the rule a beat, fixes it, and waits for a removed row to go before the next. */
    const fixOne = async (id: string) => {
      point(id);
      await wait(800);
      pointed = null;
      now().fix([id]);
      await wait(1000);
      await until((x) => x.settled);
    };
    const play = async () => {
      await wait(800);
      for (let round = 0; ; round++) {
        say(0);
        now().validate();
        await until((x) => x.phase === "done");
        say(1);
        await wait(2200);
        if (round % 2) {
          say(3);
          await wait(1000);
          now().fix(now().fixable);
          await wait(1000);
          await until((x) => x.settled);
        } else {
          say(2);
          // Bounded, so a rule whose fix ever stopped mending it cannot hold the round forever.
          for (let k = 0; k < 8 && now().fixable.length; k++) await fixOne(now().fixable[0]);
        }
        say(4);
        await wait(2400);
        say(5);
        now().add();
        await wait(1800);
        await fixOne(SUGGESTED_ID);
        await wait(2000);
        say(null);
        now().restart();
        await wait(1600);
      }
    };
    void play();
    halt.current = () => {
      on = false;
      timers.forEach(clearTimeout);
      waiting.current = null;
      say(null);
      // A rule the autoplay was pointing at is let go; one the visitor points at is theirs.
      const p = pointed;
      if (p) now().setHover((h) => (h === p ? null : h));
    };
    return () => {
      on = false;
      timers.forEach(clearTimeout);
      waiting.current = null;
      halt.current = () => {};
    };
  }, [seen, root, live, say]);
}

/* -------------------------------------------------------------------- grid */

function Grid({
  rows,
  region,
  accepted,
  flagged,
  hot,
  flash,
  leaving,
  typed,
  edit,
  sum,
  sumGoing,
}: {
  rows: Row[];
  region: string;
  accepted: boolean;
  flagged: Map<string, "bad" | "soft">;
  hot: Set<string>;
  flash: { cells: Set<string>; at: number };
  leaving: Set<number>;
  typed: Record<string, number>;
  edit: (id: number, c: Col, v: string) => void;
  sum: Example["sum"] | null;
  sumGoing: "" | "struck" | "closing";
}) {
  const t = useT();
  // Region is drawn apart until it is accepted: a column the input brought that the table does not have.
  // A phone keeps four short columns that fit in type that can be read (owner, 2026-11-01: "make
  // it smaller, make it make sense"): the customer goes, and Region, whose names are long, with it.
  const regionHead = `${accepted ? "" : "tt-newcol"}${flagged.has("head:region") ? " is-flag" : ""}${hot.has("head:region") ? " is-hot" : ""} tt-sm-hide`;
  return (
    <table className="tt-grid">
      <thead>
        <tr>
          <th className="tt-rn" aria-label={t("Row", "Řádek")} />
          {COLS.map(([c, name, type]) => (
            <Th key={c} type={type} name={t(name[0], name[1])} keyCol={c === "no"} className={c === "amount" ? "is-num" : c === "customer" ? "tt-sm-hide" : ""} />
          ))}
          <Th type="text" name={region} className={regionHead} />
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id} className={`${leaving.has(r.id) ? "is-leaving" : ""}${blank(r) ? " is-blank" : ""}`}>
            <td className={`tt-rn${blank(r) && flagged.has(`${r.id}:no`) ? " is-bad" : ""}`}>{i + 1}</td>
            {COLS.map(([c, name]) => {
              const k = `${r.id}:${c}`;
              const flag = flagged.get(k);
              const n = c === "amount" ? readNumber(r[c]) : null;
              const cls = [
                c === "amount" ? "is-num" : "",
                c === "customer" ? "tt-trunc tt-sm-hide" : "",
                c === "no" ? "tt-key-v" : "",
                flag ? `is-${flag}` : "",
                hot.has(k) ? "is-hot" : "",
                flash.cells.has(k) ? "is-fixed" : typed[k] ? "is-typed" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <EditCell
                  key={`${k}-${flash.cells.has(k) ? flash.at : 0}-${typed[k] ?? 0}`}
                  value={r[c]}
                  label={t(`${name[0]}, row ${i + 1}`, `${name[1]}, řádek ${i + 1}`)}
                  className={cls}
                  onCommit={(v) => edit(r.id, c, v)}
                >
                  <Value c={c} v={r[c]} n={n} />
                </EditCell>
              );
            })}
            <td
              key={`${r.id}:region-${flash.cells.has(`${r.id}:region`) ? flash.at : 0}`}
              className={[accepted ? "" : "tt-newcol", hot.has(`${r.id}:region`) ? "is-hot" : "", flash.cells.has(`${r.id}:region`) ? "is-fixed" : "", "tt-sm-hide"].filter(Boolean).join(" ")}
            >
              {r.region || <em>—</em>}
            </td>
          </tr>
        ))}
        {/* The summary under the data, in the sheet's own rows and columns: its title over the
            City and Amount columns, then a city and its total a line. Read-only, as nothing of
            it is a row to correct. */}
        {sum &&
          [null, ...sum.lines].map((line, i) => {
            const cls = (c: Col, more = "") => {
              const k = `sum:${i}:${c}`;
              return [more, flagged.has(k) ? "is-bad" : "", hot.has(k) ? "is-hot" : ""].filter(Boolean).join(" ");
            };
            return (
              <tr key={`sum-${i}`} className={`tt-sum${i === 0 ? " is-head" : ""}${sumGoing ? ` is-${sumGoing}` : ""}`}>
                <td className={cls("no", "tt-rn")}>{rows.length + i + 1}</td>
                <td className={cls("no")} />
                <td className={cls("customer", "tt-sm-hide")} />
                {line ? (
                  <>
                    <td className={cls("city")}>{line[0]}</td>
                    <td className={cls("amount", "is-num")}>{line[1]}</td>
                  </>
                ) : (
                  <td colSpan={2} className={cls("city")}>
                    {sum.title}
                  </td>
                )}
                <td className={cls("status")} />
                <td className={`${accepted ? "" : "tt-newcol "}tt-sm-hide`} />
              </tr>
            );
          })}
      </tbody>
    </table>
  );
}

/** A value as the grid shows it: an amount as the page's language writes it,
 *  a status as its pill, a trailing space made visible, an empty cell as a
 *  dash. */
function Value({ c, v, n }: { c: Col; v: string; n: number | null }) {
  const lang = useLang();
  if (!v.trim()) return <em className="tt-v">—</em>;
  if (c === "amount" && n !== null) return <span className="tt-v">{num(lang, n)}</span>;
  if (c === "status") return <Status v={v} />;
  return <span className="tt-v">{v.replace(/ $/, "␣")}</span>;
}

/* ------------------------------------------------------------------- rules */

function Rules({
  rules,
  hits,
  phase,
  answered,
  passing,
  failing,
  fixed,
  kept,
  hover,
  setHover,
  fix,
  restart,
  suggested,
  add,
}: {
  rules: Rule[];
  hits: (Hit | null | undefined)[];
  phase: Phase;
  answered: number;
  passing: number;
  failing: Rule[];
  fixed: Set<string>;
  kept: string[];
  hover: string | null;
  setHover: (id: string | null) => void;
  fix: (ids: string[]) => void;
  restart: () => void;
  suggested: Rule;
  add?: () => void;
}) {
  const lang = useLang();
  const t = useT();
  const right =
    phase === "idle" ? (
      <span className="tt-chip">{ruleCount(lang, rules.length)}</span>
    ) : phase === "running" ? (
      <span className="tt-chip is-sun">
        <I n="loader-2" className="tt-spin" /> {t(`${answered} of ${rules.length}`, `${answered} z ${rules.length}`)}
      </span>
    ) : (
      <span className={`tt-chip ${failing.length ? "is-err" : "is-ok"}`}>{t(`${passing} of ${rules.length} pass`, `${passing} z ${rules.length} v pořádku`)}</span>
    );
  const fixable = failing.filter((r) => r.after);
  const again = (
    <button className="tt-link" onClick={restart}>
      {t("Start over", "Začít znovu")}
    </button>
  );
  const foot =
    phase !== "done" ? (
      <span className="tt-note">
        {t("Rules you set here apply to every import, sync and pipeline run.", "Pravidla nastavená tady platí pro každý import, synchronizaci i běh pipeline.")}
      </span>
    ) : fixable.length ? (
      <>
        <button className="tt-btn is-primary" onClick={() => fix(fixable.map((r) => r.id))}>
          <I n="wand" /> {t("Fix all", "Opravit vše")}
        </button>
        {again}
      </>
    ) : (
      <>
        <span className="tt-chip is-ok">
          <I n="circle-check" /> {t("All rules pass", "Všechna pravidla v pořádku")}
        </span>
        {again}
      </>
    );

  return (
    <Side icon={<I n="shield-check" />} title={t("Rules", "Pravidla")} sub={t("keep every import consistent", "drží každý import v pořádku")} right={right} foot={foot}>
      <div>
        {rules.map((r, i) => {
          const h = hits[i];
          const state = h === undefined ? (phase === "running" ? "run" : "idle") : h === null ? "pass" : r.soft ? "soft" : "fail";
          return (
            <div key={r.id} className={r.id === SUGGESTED_ID ? "tt-rule-new" : undefined}>
              {(i === 0 || rules[i - 1].group !== r.group) && <span className="tt-label tt-rules-g">{t(...GROUP[r.group])}</span>}
              <div className={`tt-rule is-${state}${hover === r.id && h ? " is-hover" : ""}`} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)}>
                <span className="tt-rule-st">{state === "run" ? <I n="loader-2" className="tt-spin" /> : state === "pass" ? <I n="check" /> : h ? h.n : <I n={r.icon} />}</span>
                <span>
                  <b>{r.title}</b>
                  <small>
                    {h ? h.detail : state === "pass" ? (fixed.has(r.id) && r.after ? r.after : t("Passes", "V pořádku")) : state === "run" ? t("Checking…", "Kontroluje se…") : r.what}
                  </small>
                </span>
                {h && r.after ? (
                  <button className="tt-btn is-sm" onFocus={() => setHover(r.id)} onClick={() => fix([r.id])}>
                    {r.fix ?? t("Fix", "Opravit")}
                  </button>
                ) : state === "pass" && fixed.has(r.id) && r.after ? (
                  <span className="tt-done">
                    <I n="check" /> {r.done ?? t("Fixed", "Opraveno")}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {add && (
        <button className="tt-suggest" onClick={add}>
          <I n="plus" />
          <span>
            <b>
              {t("Add a rule", "Přidat pravidlo")}: {suggested.title}
            </b>
            <small>{t("Suggested from the values: most invoice numbers keep that pattern", "Navrženo z hodnot: tento tvar má většina čísel faktur")}</small>
          </span>
        </button>
      )}
      {kept.length > 0 && (
        <div className="tt-kept">
          <b>
            <I n="bookmark" /> {t("Remembered for the next import", "Zapamatováno pro příští import")}
          </b>
          {kept.map((k) => (
            <span key={k}>{k}</span>
          ))}
        </div>
      )}
    </Side>
  );
}

import { Fragment, useEffect, useState, type CSSProperties, type ReactNode, type RefObject, useRef } from "react";
import { prefersLessMotion, useSeen } from "../motion";
import { icoOk, readBool, readDate, readNumber } from "../czech";
import { day, num, whole, useLang, useT, type Lang } from "../i18n";
import { FLAGS } from "../flags";

/**
 * Solutions: what a team gets back, how appolino reads the files of the team's own country, how
 * it writes what it delivers, and how work goes in it. Several sections made one (owner,
 * 2026-11-01: "about is more like solutions section", "merge this to solutions also", and of
 * Deliver's notes, "this should somehow be in Solutions, incorporated"). Every part is a card in
 * one style - a picture on a warm light, then its title and text:
 *  - six cases a team gets back: About's six and Solutions' three, de-duplicated ("One number
 *    for every department" is "Numbers people agree on", "Clean data before it is reported" is
 *    "Problems before the board sees them"); the scheduling card out of the top row (owner: "put
 *    it back, however not on top");
 *  - the country-specific data as one row of three: a card that says it (owner: "delete this,
 *    maybe add it as a card"), then the kinds of value in two cards whose pictures loop (owner:
 *    "merge these into one card", "only the visual is changing in the card, an auto loop"), no
 *    country named, no tags;
 *  - "Every load is safe", a band under the cards as it stood in Trust (owner: "keep it under it
 *    like before"), where Deliver's write modes and load receipt stood (owner: "put this away
 *    totally"); Deliver's writeback is in the Excel card;
 * then About's four steps, named after the demo's tabs, put away behind FLAGS.road (owner,
 * 2026-11-01). Only what the platform does - no invented history or numbers; every figure is an
 * example.
 */

/** A card as every card here is drawn: its title and a line or two first, then its picture,
 *  filling the rest of the card (owner, 2026-11-01: "headlines on top of the card, not such big
 *  empty spaces"). The cards share the row's three rows (index.css, .ben), so titles, texts and
 *  pictures stand level and every card is one height. */
function Card({ vis, h, p }: { vis: ReactNode; h: string; p: string }) {
  return (
    <article className="ben">
      <h3>{h}</h3>
      <p>{p}</p>
      {vis}
    </article>
  );
}

/** The six branches whose spreadsheets a monthly report was copied together from, and each
 *  one's height in the report's little chart. */
const BRANCHES: [string, string, number][] = [
  ["Prague", "Praha", 92],
  ["Brno", "Brno", 64],
  ["Ostrava", "Ostrava", 48],
  ["Plzen", "Plzeň", 56],
  ["Liberec", "Liberec", 36],
  ["Olomouc", "Olomouc", 42],
];

/** Six branch files, each ticked as it is checked, gathered into one report that rebuilds itself. */
function MergeVis() {
  const t = useT();
  const lang = useLang();
  return (
    <div className="vis sol-merge" aria-hidden>
      <div className="sol-files">
        {BRANCHES.map(([en, cs], i) => (
          <span className="sol-file" key={en} style={{ "--i": i } as CSSProperties}>
            <i className="ti ti-file-spreadsheet" />
            <span>{t(en, cs)}.xlsx</span>
            <b>✓</b>
          </span>
        ))}
      </div>
      <svg className="sol-join" viewBox="0 0 200 20" preserveAspectRatio="none">
        <path d="M52 0C52 11 100 7 100 20M148 0C148 11 100 7 100 20" />
      </svg>
      <div className="sol-report">
        <span className="h">{t("Monthly report", "Měsíční report")}</span>
        <span className="m">{t("6 files checked, one table", "6 souborů zkontrolováno, jedna tabulka")}</span>
        <span className="bars">
          {BRANCHES.map(([en, , h]) => (
            <i key={en} style={{ height: `${h}%` }} />
          ))}
        </span>
        <span className="next">↻ {t(`Rebuilds itself on ${day(lang, "2026-12-01")}, 06:00`, `Sestaví se sám ${day(lang, "2026-12-01")} v 6:00`)}</span>
      </div>
    </div>
  );
}

/** An income statement as a finance team keeps one (owner, 2026-11-01: "more like in reality -
 *  balance sheet, revenue"): the lines of Sales' report and of Finance's, equal line by line
 *  because both read one result. Example figures, each language writing them its own way. */
const PL: { en: string; cs: string; n: number; kind?: "tot" | "pct" }[] = [
  { en: "Revenue", cs: "Tržby", n: 1284500 },
  { en: "Direct costs", cs: "Přímé náklady", n: -812300 },
  { en: "Gross margin", cs: "Hrubá marže", n: 472200, kind: "tot" },
  { en: "Margin", cs: "Marže", n: 36.8, kind: "pct" },
];

function AgreeVis() {
  const t = useT();
  const lang = useLang();
  const figure = (r: (typeof PL)[number]) =>
    r.kind === "pct" ? t(`${num(lang, r.n, 1)}%`, `${num(lang, r.n, 1)} %`) : `${r.n < 0 ? "−" : ""}${whole(lang, Math.abs(r.n))}`;
  return (
    <div className="vis agree" aria-hidden>
      <span className="src">
        {t("Income statement · Oct 2026", "Výsledovka · říjen 2026")} <small>{t("one table, CZK", "jedna tabulka, Kč")}</small>
      </span>
      <div className="pl">
        <span />
        <span className="hd">{t("Sales", "Obchod")}</span>
        <span />
        <span className="hd">{t("Finance", "Finance")}</span>
        {PL.map((r, i) => (
          <Fragment key={r.en}>
            <span className={`k ${r.kind ?? ""}`}>{t(r.en, r.cs)}</span>
            <span className={`v ${r.kind ?? ""}`}>{figure(r)}</span>
            <span className={`e ${r.kind ?? ""}`} style={{ "--i": i } as CSSProperties}>
              =
            </span>
            <span className={`v ${r.kind ?? ""}`}>{figure(r)}</span>
          </Fragment>
        ))}
      </div>
      <span className="ok">✓ {t("Same number, same source", "Stejné číslo, stejný zdroj")}</span>
    </div>
  );
}

/** A morning's runs on a rail from dawn into day, each with what started it - the three
 *  pipelines of the demo's Extract on their own schedules, and one run because a file arrived -
 *  the next run already listed (owner, 2026-11-01: "like for scheduling, more text"). No tag over
 *  it naming a day, a time zone or a city (owner: "don't put this tag in the card"). */
const RUNS: { t: string; en: string; cs: string; why: [string, string]; st: "ok" | "run" | "due" }[] = [
  { t: "06:00", en: "Invoices", cs: "Faktury", why: ["every weekday", "každý pracovní den"], st: "ok" },
  { t: "07:00", en: "Price list", cs: "Ceník", why: ["Mondays", "v pondělí"], st: "ok" },
  { t: "07:42", en: "Invoices", cs: "Faktury", why: ["a file arrived", "přišel soubor"], st: "ok" },
  { t: "08:00", en: "Bank statements", cs: "Bankovní výpisy", why: ["every hour, 7 to 19", "každou hodinu, 7 až 19"], st: "run" },
  { t: "09:00", en: "Bank statements", cs: "Bankovní výpisy", why: ["every hour, 7 to 19", "každou hodinu, 7 až 19"], st: "due" },
];

function RailVis() {
  const t = useT();
  return (
    <div className="vis rail-day" aria-hidden>
      <ol>
        {RUNS.map((r, i) => (
          <li key={i} className={r.st}>
            <span className="t">{r.t}</span>
            <span className="n">
              {t(r.en, r.cs)}
              <small>{t(...r.why)}</small>
            </span>
            <span className="s">{r.st === "ok" ? `✓ ${t("done", "hotovo")}` : r.st === "run" ? t("running", "běží") : t("next", "další")}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A plan a team kept by hand, moved in, as the demo's Tables shows it: typed columns, a region
 *  picked from its list, and the last edit as History names it. Figures as each language writes
 *  them. Five rows, so the open list falls over rows of the table rather than off its foot. */
function PlanVis() {
  const t = useT();
  const lang = useLang();
  const regions = [t("Prague", "Praha"), "Brno", "Ostrava"];
  const rows: [string, string, number][] = t(
    [
      ["Sourdough bread", "Prague", 120000],
      ["Bread rolls", "Brno", 88000],
      ["Kolache", "Prague", 42000],
      ["Baguettes", "Ostrava", 64250.5],
      ["Custom cakes", "Prague", 150000],
    ],
    [
      ["Chléb kváskový", "Praha", 120000],
      ["Rohlíky", "Brno", 88000],
      ["Koláče", "Praha", 42000],
      ["Bagety", "Ostrava", 64250.5],
      ["Dorty na zakázku", "Praha", 150000],
    ],
  );
  return (
    <div className="vis sol-plan" aria-hidden>
      <div className="sol-sheet">
        {/* The table's name alone, no tag beside it (owner, 2026-11-01). */}
        <div className="cap">
          <b>{t("Sales plan 2026", "Plán prodeje 2026")}</b>
        </div>
        <div className="r hd">
          <span>
            <i className="ti ti-letter-case" />
            {t("Product", "Produkt")}
          </span>
          <span>
            <i className="ti ti-letter-case" />
            Region
          </span>
          <span>
            <i className="ti ti-currency-euro" />
            {t("Plan (CZK)", "Plán (Kč)")}
          </span>
        </div>
        {rows.map(([p, r, n], i) => (
          <div className="r" key={p}>
            <span>{p}</span>
            {i === 1 ? (
              // The cell being picked, its list open over the rows under it.
              <span className="pick">
                <em>{r}</em>
                <i className="ti ti-chevron-down" />
                <span className="sol-menu">
                  {regions.map((g) => (
                    <span key={g} className={g === r ? "on" : undefined}>
                      {g}
                      {g === r && <i className="ti ti-check" />}
                    </span>
                  ))}
                </span>
              </span>
            ) : (
              <span>{r}</span>
            )}
            <span className={i === 1 ? "ed" : undefined}>{num(lang, n)}</span>
          </div>
        ))}
      </div>
      <div className="sol-hist">
        <span className="av">J</span>
        {/* Who, before and after; the lit cell says which one. */}
        <span className="w">
          Jana · {num(lang, 85500)} → {num(lang, 88000)}
        </span>
        <small>
          <i className="ti ti-history" />
          {t("History", "Historie")}
        </small>
      </div>
    </div>
  );
}

/** A bad load stopped at its gate. */
function GateVis() {
  const t = useT();
  return (
    <div className="vis gate" aria-hidden>
      <div className="flow">
        <span className="step ok">{t("Load", "Načtení")}</span>
        <span className="to">→</span>
        <span className="step ok">{t("Validate", "Validace")}</span>
        <span className="to">→</span>
        <span className="step held">{t("Rules · held", "Pravidla · zastaveno")}</span>
        <span className="to">→</span>
        <span className="step off">{t("Deliver", "Doručení")}</span>
      </div>
      <div className="log">
        <b>06:00:14</b> {t("Not negative: 1 row failed", "Nezáporná: 1 řádek neprošel")}
        <br />
        <b>06:00:14</b> {t("held before delivery", "zastaveno před doručením")}
        <br />
        <b>06:00:15</b> {t("Teams: admins told once", "Teams: správci upozorněni jednou")}
      </div>
      <span className="keep">{t("The report keeps its last good load", "Report si drží poslední dobrá data")}</span>
    </div>
  );
}

/** The workbook a team keeps, still open, and the routine round it done for them (owner,
 *  2026-11-01: "a simple tool to easily do the stuff you do"): files gathered, the same steps,
 *  the results written back into its cells - Deliver's writeback - each cell lighting as it is
 *  written. */
function BookVis() {
  const t = useT();
  const lang = useLang();
  const rows: [string, number, number][] = [
    [t("Prague", "Praha"), 120000, 118450],
    ["Brno", 85500, 86120],
    ["Ostrava", 64250, 61900],
  ];
  return (
    <div className="vis sol-xl" aria-hidden>
      <div className="sol-book">
        <div className="bar">
          <i className="ti ti-file-spreadsheet" />
          <b>{t("Sales_2026.xlsx", "Prodeje_2026.xlsx")}</b>
          <small>{t("open", "otevřený")}</small>
        </div>
        <div className="sol-cells">
          <span className="h" />
          <span className="h">A</span>
          <span className="h">B</span>
          <span className="h">C</span>
          <span className="h">1</span>
          <span className="k">Region</span>
          <span className="k n">{t("Plan", "Plán")}</span>
          <span className="k n">{t("Actual", "Skutečnost")}</span>
          {rows.map(([r, p, a], i) => (
            <Fragment key={r}>
              <span className="h">{i + 2}</span>
              <span>{r}</span>
              <span className="n">{whole(lang, p)}</span>
              <span className="n w" style={{ "--i": i } as CSSProperties}>
                {whole(lang, a)}
              </span>
            </Fragment>
          ))}
        </div>
      </div>
      <div className="sol-flow">
        <span className="ok">{t("Files in", "Načteno")}</span>
        <b>→</b>
        <span className="ok">{t("Same steps", "Stejné kroky")}</span>
        <b>→</b>
        <span className="on">{t("Written back", "Zapsáno zpět")}</span>
      </div>
      <div className="sol-run">
        <i className="ti ti-refresh" />
        <span>{t("Writeback (reverse ETL), weekdays at 06:00", "Zpětný zápis (reverse ETL), v pracovní dny v 6:00")}</span>
      </div>
    </div>
  );
}

type Case = { from: string; to: string; tone?: "bad" | "keep" };
/** A kind of value: its icon (the demo's own for the column type, where it has one), its short
 *  name - the heading over its cases in the picture - and its cases. */
type Kind = { icon: string; name: string; xs: Case[] };

/** Each kind of value a country writes its own way, every case worked out by the same readers
 *  the demo uses (src/czech.ts). What is read stays as a team writes it, in both languages - that
 *  is the point - and what it is read as is said in the page's language. No country is named
 *  (owner, 2026-11-01: "don't state the Czech Republic explicitly at all, nor in the text"), and
 *  the bank files are said in plain words, no format named (owner: "don't mention data types").
 *  What each kind's card used to say is in the texts of the two cards that hold them now. The
 *  last kind is About's bank statements and e-invoices and the old section's files from the
 *  country's own systems, which said the same thing twice. How long records are kept, that
 *  section's sixth card, is said under Trust ("retained 1 to 10 years"). */
function kinds(lang: Lang): Kind[] {
  const L = (en: string, cs: string) => (lang === "cs" ? cs : en);
  const asDate = (s: string): Case => {
    const d = readDate(s.replace(/ \d{1,2}:\d{2}$/, ""));
    const time = s.match(/ (\d{1,2}:\d{2})$/)?.[1];
    return d ? { from: s, to: time ? `${d} ${time}` : d } : { from: s, to: L("empty · no such day", "prázdné · neexistuje"), tone: "bad" };
  };
  const asNumber = (s: string): Case => {
    const n = readNumber(s);
    return n === null ? { from: s, to: L("stays text", "zůstane textem"), tone: "keep" } : { from: s, to: n.toFixed(2) };
  };
  const asBool = (s: string): Case => {
    const b = readBool(s);
    return b === null ? { from: s, to: L("not yes or no", "není ano ani ne"), tone: "keep" } : { from: s, to: b ? L("Yes", "Ano") : L("No", "Ne") };
  };
  const asIco = (s: string): Case =>
    icoOk(s) ? { from: s, to: L("✓ IČO check digit", "✓ kontrolní číslice IČO") } : { from: s, to: L("✗ check digit", "✗ kontrolní číslice"), tone: "bad" };
  return [
    {
      icon: "calendar",
      name: L("Dates", "Data"),
      xs: ["15. 1. 2026", "15.1.2026", "15.01.2026", "15. 1. 2026 14:30", "15/01/2026", "15 Jan 26", "2026-01-15", "31. 4. 2026"].map(asDate),
    },
    {
      icon: "decimal",
      name: L("Numbers", "Čísla"),
      xs: ["1 234,50", "1.234,50", "1,234.50", "12 840", "-1 230,00", "220,789,550", "110 00"].map(asNumber),
    },
    {
      icon: "toggle-left",
      name: L("Yes or no", "Ano a ne"),
      xs: ["ano", "NE", "pravda", "nepravda", "Yes", "nein", "oui", "1"].map(asBool),
    },
    // The registry numbers and the personal data were one list of nine; two lists keep every case
    // and keep the cards, which all take the tallest picture's height, from running long.
    {
      icon: "hash",
      name: L("IČO, IBAN and ISIN", "IČO, IBAN a ISIN"),
      xs: [
        asIco("27082440"),
        asIco("00006947"),
        asIco("12345678"),
        { from: "CZ65 0800 0000 1920 0014 5399", to: L("an IBAN · personal", "IBAN · osobní údaj") },
        { from: "CZ0008019106", to: L("an ISIN", "ISIN") },
      ],
    },
    {
      icon: "user-shield",
      name: L("Personal data and contacts", "Osobní a kontaktní údaje"),
      xs: [
        { from: "856201/1234", to: L("birth number · never to AI", "rodné číslo · nikdy do AI"), tone: "keep" },
        { from: "objednavky@pekarna.cz", to: L("an e-mail · personal", "e-mail · osobní údaj") },
        { from: "+420 777 123 456", to: L("a phone · personal", "telefon · osobní údaj") },
        { from: "110 00", to: L("a postcode", "PSČ") },
      ],
    },
    {
      icon: "receipt",
      name: L("Bank and invoices", "Banka a faktury"),
      xs: [
        { from: "+00001284000 (haléře)", to: L("12,840.00 CZK", "12 840,00 Kč") },
        // Short readings, so the list fits its picture's box in every card width.
        { from: "-00000245000 (haléře)", to: L("−2,450.00 CZK", "−2 450,00 Kč") },
        { from: L("e-invoice FV2026101", "e-faktura FV2026101"), to: L("invoice, lines, VAT", "faktura, řádky, DPH") },
        { from: L("October's statement", "výpis za říjen"), to: L("rows, debits signed", "řádky, debety záporně") },
        { from: L("another bank", "jiná banka"), to: L("read the same way", "čte se stejně") },
        { from: L("an old export", "starý export"), to: L("accents read right", "diakritika správně") },
      ],
    },
  ];
}

/** A count that goes up every 2.2 seconds once the element has been seen, for the pictures to
 *  step by; it stands still when less motion is asked for. */
function useTick(ref: RefObject<Element>) {
  const seen = useSeen(ref, 0.15);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!seen || prefersLessMotion()) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 2200);
    return () => clearInterval(id);
  }, [seen]);
  return tick;
}

/** A kind's cases as the three country cards all draw them (owner, 2026-11-01: "make these cards'
 *  text size better aligned"): the kind's name over a list headed "As written" and "Read as", one
 *  case to a row - the value as written in mono, an arrow in a column of its own, the reading -
 *  one row marked in turn. A value too long for its column wraps inside it, so the arrows stay in
 *  line and nothing is cut short. */
function Pairs({ kind, mark }: { kind: Kind; mark: number }) {
  const t = useT();
  return (
    <>
      <span className="sol-kind-hd">
        <span className="sol-ic" aria-hidden>
          <i className={`ti ti-${kind.icon}`} />
        </span>
        <b>{kind.name}</b>
      </span>
      <ul className="sol-list">
        <li className="hd" aria-hidden>
          <span>{t("As written", "Jak je napsáno")}</span>
          <span />
          <span>{t("Read as", "Přečteno jako")}</span>
        </li>
        {kind.xs.map((x, i) => (
          <li key={x.from} className={i === mark % kind.xs.length ? "on" : undefined}>
            <span className="from">{x.from}</span>
            <b aria-hidden>→</b>
            <span className={`to ${x.tone ?? ""}`}>{x.to}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The card that says it: one case of each kind, drawn as the two cards after it draw theirs, no
 *  tag over it (owner, 2026-11-01: "don't put any tags"). The bank case is shown without its
 *  "(haléře)" note, which its own list carries. */
function CountryVis({ list, tick }: { list: Kind[]; tick: number }) {
  const t = useT();
  const one: Kind = {
    icon: "file-spreadsheet",
    name: t("One of each", "Od každého jeden"),
    xs: list.map((k) => ({ ...k.xs[0], from: k.xs[0].from.replace(/ \(haléře\)$/, "") })),
  };
  return (
    <div className="vis sol-kind">
      <span className="sol-views">
        <span className="on">
          <Pairs kind={one} mark={tick} />
        </span>
      </span>
    </div>
  );
}

/** Several things laid in one place, the chosen one shown and the rest kept invisibly under it,
 *  so the picture is as tall as its tallest and nothing below it moves when the choice changes. */
function Stack({ items, on }: { items: ReactNode[]; on: number }) {
  return (
    <span className="sol-views">
      {items.map((s, i) => (
        <span key={i} className={i === on ? "on" : undefined}>
          {s}
        </span>
      ))}
    </span>
  );
}

/** Several kinds in one card whose picture loops through them by itself (owner, 2026-11-01:
 *  "merge these into one card", "only the visual is changing in the card, an auto loop"; no
 *  switch, no tags), every case of the kind on show listed at once (owner: "show more in
 *  general"). The card's title and text stay put and say what all its kinds come to, so nothing a
 *  reader is in the middle of changes under them; the picture moves on every fourth step, `lag`
 *  steps behind the tick so two such cards do not turn together, and stays on the first when less
 *  motion is asked for. */
function LoopCard({ list, tick, lag = 0, h, p }: { list: Kind[]; tick: number; lag?: number; h: string; p: string }) {
  const on = Math.floor(Math.max(0, tick - lag) / 4) % list.length;
  return (
    <Card
      vis={
        <div className="vis sol-kind">
          <Stack on={on} items={list.map((k) => <Pairs key={k.icon} kind={k} mark={tick} />)} />
        </div>
      }
      h={h}
      p={p}
    />
  );
}

/** What every load promises, in business words, never the trade's acronym for it - here alone
 *  now, out of Trust (owner, 2026-11-01), where the write modes and the load receipt stood (owner:
 *  "put this away totally"). The owner's words, as given, but for the dashes that broke a
 *  sentence: a colon, a comma or a full stop now (owner: "don't use - in texts"), as in every
 *  sentence of this file. */
const SAFE: { icon: string; h: [string, string]; p: [string, string] }[] = [
  {
    icon: "arrows-exchange",
    h: ["All or nothing", "Vše, nebo nic"],
    p: ["If a load fails, nothing changes: you never find half of the month in a report.", "Když načtení selže, nic se nezmění. V reportu nikdy nenajdete půlku měsíce."],
  },
  {
    icon: "shield-check",
    h: ["Always valid", "Vždy platná"],
    p: ["Data that breaks your rules is stopped at the door, so totals always add up.", "Data, která poruší vaše pravidla, se zastaví už u dveří, takže součty vždy sedí."],
  },
  {
    icon: "eye",
    h: ["No half-finished views", "Žádné rozpracované stavy"],
    p: ["A report run during a load sees the data before it or after it, never in between.", "Report spuštěný během načítání vidí data před ním, nebo po něm, nikdy mezi tím."],
  },
  {
    icon: "device-floppy",
    h: ["Saved for good", "Uloženo natrvalo"],
    p: ["Once appolino says saved, it is there, even after an outage.", "Co appolino ohlásí jako uložené, tam je, i po výpadku."],
  },
];

/** A band under the cards, as it stood in Trust (owner, 2026-11-01: "don't put this in that card,
 *  keep it under it like before"): its name in small amber capitals, then the four promises in a
 *  row, each an icon in a small amber seal, its name and its sentence. */
function SafeBand() {
  const t = useT();
  return (
    <div className="sol-safe">
      <span className="sol-safe-h">{t("Every load is safe", "Každé načtení je bezpečné")}</span>
      <div className="sol-safe-row">
        {SAFE.map((s) => (
          <p className="sol-safe-i" key={s.icon}>
            <i className={`ti ti-${s.icon}`} aria-hidden />
            <span>
              <b>{t(...s.h)}</b>
              {t(...s.p)}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

/** The cards in one row that scrolls sideways (owner, 2026-11-01: "these cards - like 3 visible
 *  with arrows beside them, that you can scroll, click, you know"): three to a view on a wide
 *  screen, two on a small laptop or a tablet, one and the edge of the next on a phone, each
 *  snapping to the row's start (index.css, .ben-grid). It moves by a trackpad, a finger, the
 *  wheel with shift, the arrow keys once the row has focus, or the two arrows, which step one card
 *  and grey out at either end; a thin bar under the row shows where in it the view is. Smooth
 *  steps, unless less motion is asked for. */
function Carousel({ label, children }: { label: string; children: ReactNode }) {
  const t = useT();
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState({ start: true, end: false, pos: 0, size: 1 });
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const look = () => {
      raf = 0;
      const max = el.scrollWidth - el.clientWidth;
      setAt({ start: el.scrollLeft < 4, end: el.scrollLeft > max - 4, pos: max > 0 ? el.scrollLeft / max : 0, size: el.clientWidth / el.scrollWidth });
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(look);
    };
    look();
    el.addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    // Asked again whenever the row or a card changes size - fonts arriving, pictures laying out -
    // since a first look taken before the cards had their widths left Next greyed out until a
    // swipe (the e2e carousel check, iPad Mini in WebKit, 2026-11-01).
    const ro = new ResizeObserver(on);
    ro.observe(el);
    for (const card of el.children) ro.observe(card);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("scroll", on);
      removeEventListener("resize", on);
    };
  }, []);
  const go = (dir: number) => {
    const el = track.current;
    const card = el?.querySelector<HTMLElement>(".ben");
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: prefersLessMotion() ? "auto" : "smooth" });
  };
  return (
    <div className="sol-car">
      <button type="button" className="sol-arrow prev" aria-label={t("Previous", "Předchozí")} onClick={() => go(-1)} disabled={at.start}>
        <i className="ti ti-chevron-left" aria-hidden />
      </button>
      <div className="ben-grid" ref={track} tabIndex={0} role="region" aria-label={label}>
        {children}
      </div>
      <button type="button" className="sol-arrow next" aria-label={t("Next", "Další")} onClick={() => go(1)} disabled={at.end}>
        <i className="ti ti-chevron-right" aria-hidden />
      </button>
      <span className="sol-progress" aria-hidden>
        <span style={{ width: `${at.size * 100}%`, left: `${at.pos * (1 - at.size) * 100}%` }} />
      </span>
    </div>
  );
}

/** How work goes, named after the demo's tabs (owner, 2026-11-01: extract, transform, validate,
 *  deliver). Deliver is no longer "to PostgreSQL and BigQuery": the data stays in appolino's own
 *  tables and goes out only when someone publishes it. */
const STEPS: { en: [string, string]; cs: [string, string] }[] = [
  {
    en: ["Extract", "Connect SharePoint, OneDrive, an inbox or a folder, or start a table by hand. Pipelines fetch on their schedule."],
    cs: ["Extrakce", "Připojte SharePoint, OneDrive, e-mailovou schránku nebo složku, nebo začněte tabulku ručně. Pipeliny stahují podle plánu."],
  },
  {
    en: ["Transform", "Join, calculate and filter in steps anyone can read, or in SQL when a step needs more."],
    cs: ["Transformace", "Spojujte, počítejte a filtrujte v krocích, kterým rozumí každý, nebo v SQL, když krok potřebuje víc."],
  },
  {
    en: ["Validate", "Rules run on every import: types, lists, duplicates, a changed file. Fix in one click; appolino remembers the fix."],
    cs: ["Validace", "Pravidla běží při každém importu: typy, seznamy, duplicity, změněný soubor. Oprava jedním klikem; appolino si ji zapamatuje."],
  },
  {
    en: ["Deliver", "The data stays in appolino's tables: written on schedule, always checked first, with a record of every run. Publish it to your reports or back into Excel only when you want to."],
    cs: ["Doručení", "Data zůstávají v tabulkách appolina: zapisují se podle plánu, vždy až po kontrole, a každý běh má svůj záznam. Do reportů nebo zpátky do Excelu je publikujete, jen když chcete."],
  },
];

/** The road from a file to a report, under the owner's line that used to head About; Ask under
 *  it. */
function Road() {
  const t = useT();
  return (
    <div className="sol-road">
      <div className="sol-road-head">
        <p className="sol-kicker">{t("How you work in appolino", "Jak se v appolinu pracuje")}</p>
        <h3>{t("Your road to digitalization starts here.", "Vaše cesta k digitalizaci začíná tady.")}</h3>
      </div>
      <ol className="sol-steps">
        {STEPS.map((s, i) => {
          const [h, p] = t(s.en, s.cs);
          return (
            <li key={i}>
              <span className="sol-n">{i + 1}</span>
              <h4>{h}</h4>
              <p>{p}</p>
            </li>
          );
        })}
      </ol>
      <p className="sol-ask">
        <span aria-hidden>✦</span>{" "}
        {t(
          "Along the way, Ask turns a sentence into a fix, a rule or a step. It is sent the shape of your data, never its values.",
          "Po cestě pomáhá Zeptat se: z věty udělá opravu, pravidlo nebo krok a dostane jen tvar vašich dat, nikdy jejich hodnoty.",
        )}
      </p>
    </div>
  );
}

/** Solutions, for the bar's "Solutions" (owner, 2026-11-01): two big lines and what appolino is,
 *  six cases a team gets back, the files of its own country, what every load promises, and - with
 *  FLAGS.road on - the road through the work. */
export function Benefits() {
  const t = useT();
  const lang = useLang();
  // The pictures step once the section is in view: a card further along the row is out of the
  // window sideways, so it is the section that is watched, not a card.
  const section = useRef<HTMLElement>(null);
  const tick = useTick(section);
  const KINDS = kinds(lang);
  return (
    <section className="why" id="why" ref={section}>
      <div className="wrap">
        <div className="sec-head">
          <p className="label">{t("Solutions", "Řešení")}</p>
          <h2>
            {t("Hours back every week.", "Hodiny navíc každý týden.")}
            <span>{t("An end to copying between spreadsheets.", "Konec kopírování mezi tabulkami.")}</span>
          </h2>
          <p className="intro">
            {t(
              "appolino gives management control and numbers everyone trusts: errors caught before they reach a report, every change on record for an audit, and hours of manual work handed back to the team.",
              "appolino dá vedení kontrolu a čísla, kterým věří všichni: chyby zachycené dřív, než se dostanou do reportu, každá změna zaznamenaná pro audit a hodiny ruční práce vrácené týmu.",
            )}
          </p>
        </div>
        <Carousel label={t("Solutions, card by card", "Řešení, karta po kartě")}>
          <Card
            vis={<MergeVis />}
            h={t("Monthly reporting", "Měsíční reporting")}
            p={t(
              "From six spreadsheets to one report: files gathered, checked and combined into one table that rebuilds itself on schedule.",
              "Ze šesti tabulek jeden report: soubory posbírané, zkontrolované a spojené do jedné tabulky, která se sama sestaví podle plánu.",
            )}
          />
          <Card
            vis={<AgreeVis />}
            h={t("Numbers people agree on", "Jedno číslo pro všechny")}
            p={t(
              "One table, one definition, one result. Sales and finance read the same figure, and either can click it to see the rows it came from.",
              "Jedna tabulka, jedna definice, jeden výsledek. Obchod i finance čtou stejné číslo a kdokoli si rozklikne řádky, ze kterých vzniklo.",
            )}
          />
          <Card
            vis={<PlanVis />}
            h={t("Plans, budgets and price lists", "Plány, rozpočty a ceníky")}
            p={t(
              "The tables a team keeps by hand move in: typed columns, lists to pick from, every edit in History and who may change what.",
              "Ruční tabulky týmu se přesunou dovnitř: sloupce s typy, výběr ze seznamu, každá změna v historii a jasno, kdo smí co měnit.",
            )}
          />
          <Card
            vis={<RailVis />}
            h={t("Runs while you sleep", "Běží, zatímco spíte")}
            p={t(
              "Pipelines run on their own schedule in your time zone, or when a file arrives. You see the next runs ahead; a failed rule stops one.",
              "Pipeliny běží podle plánu ve vašem časovém pásmu, nebo když přijde soubor. Další běhy vidíte dopředu; chybné pravidlo běh zastaví.",
            )}
          />
          <Card
            vis={<GateVis />}
            h={t("Errors caught early", "Chyby zachycené včas")}
            p={t(
              "A failed rule holds the run and names what to fix. The report keeps its last good load, so nobody corrects it after it is read.",
              "Pravidlo, které neprojde, běh zastaví a řekne, co opravit. Report si drží poslední dobrá data, takže ho nikdo neopravuje po přečtení.",
            )}
          />
          {/* Deliver's writeback, after the owner's "a simple tool to easily do the stuff you
              do", in three lines like every card's (owner: "no empty space"); the picture shows
              the files in, the same steps and the cells written back. */}
          <Card
            vis={<BookVis />}
            h={t("Keep working in Excel", "Dál pracovat v Excelu")}
            p={t(
              "A simple way to keep what you do: appolino writes the results back into your workbook on schedule, even while it is open.",
              "Jednoduše zůstanete u toho, co děláte: appolino podle plánu zapíše výsledky zpátky do sešitu, i když je otevřený.",
            )}
          />
          {/* The country's files, three cards: the one that says it, then dates, numbers and yes
              or no in one looping card, and IDs and the bank files in another. */}
          <Card
            vis={<CountryVis list={KINDS} tick={tick} />}
            h={t("Local formats, read right", "Čte místní formáty")}
            p={t(
              "Most tools were built for English spreadsheets. appolino reads each country's own dates, amounts, IDs and bank files as they are.",
              "Většina nástrojů vznikla pro anglické tabulky. appolino čte data, částky, identifikační čísla a bankovní soubory každé země tak, jak jsou.",
            )}
          />
          {/* Each kind's rules in one text of three lines that stays put while the picture loops
              (owner: "no empty space"); what the lists show for themselves - the ways of writing
              a date, the spellings, the languages, each check - is left to the lists. */}
          <LoopCard
            tick={tick}
            list={KINDS.slice(0, 3)}
            h={t("Read right, however it's written", "Vždy správně přečteno")}
            p={t(
              "Dates, numbers, yes and no as you write them: an impossible date stays empty, a postcode stays a postcode.",
              "Data, čísla, ano a ne, jak je píšete: nemožné datum zůstane prázdné, PSČ zůstane PSČ.",
            )}
          />
          <LoopCard
            tick={tick}
            lag={2}
            list={KINDS.slice(3)}
            h={t("IDs, bank files, e-invoices", "ID, výpisy a e-faktury")}
            p={t(
              "IČO, IBAN and ISIN checked, personal data spotted, bank statements and e-invoices read as they arrive, debits signed.",
              "IČO, IBAN a ISIN zkontrolované, osobní údaje rozpoznané, výpisy a e-faktury načtené, jak přijdou, debety se znaménkem.",
            )}
          />
        </Carousel>
        <SafeBand />
        {/* Put away behind a flag (owner, 2026-11-01), kept whole for when it comes back; off, the
            row of cards is the last thing in the section and its own padding closes it. */}
        {FLAGS.road && <Road />}
      </div>
    </section>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { count, day, num, useLang, useT, whole, type Lang } from "../i18n";
import { prefersLessMotion, useSeen } from "../motion";
import { Head, I, Side, Status, Th } from "./kit";

/**
 * Deliver: the scheduled run that writes into the table (owner, 2026-11-01: Deliver shows "the
 * writes, validations, quality - like that jobs log"; it was the Extract tab until the reading
 * itself took that tab, ReadScreen). The data stays in appolino's table; publishing elsewhere
 * is not this screen's subject.
 *
 * Import as a pipeline with quality gates and alerts - nobody uploads
 * anything. Every weekday at six it gathers what arrived (an Excel export on
 * SharePoint, e-invoices sent to an inbox, rows typed into appolino), reads
 * each one, and passes the lot through three gates before anything reaches
 * the table: the schema (a column added, missing or renamed), the row count
 * (a file that suddenly holds half the rows) and validation (the table's
 * rules). A gate that holds stops the run, and Faktury keeps yesterday's good
 * rows; a row a rule does not allow is held alone. Whatever a gate or a rule
 * holds goes to alerting, which tells the team in Teams - a link, never the
 * data. The run log says all of it as it happens. Pick what arrives today
 * and it runs: as usual, a new column, half the rows, a bad value. From the
 * moment the window comes into view the screen plays all of it by itself,
 * round and round, until the visitor takes over (useAutoplay). The companies
 * are invented.
 *
 * The example comes in the page's language: the Czech run reads Czech files
 * and writes its amounts and dates the Czech way, the English one the English
 * way. The companies stay Czech in both, since they are Czech businesses, and
 * the gates, the scenarios and what each one catches are the same in both.
 */

type Scn = "usual" | "drift" | "shrink" | "bad";
type Key = "src0" | "src1" | "src2" | "read" | "schema" | "count" | "dedup" | "rules" | "load" | "alert";
type St = "idle" | "run" | "ok" | "warn" | "hold" | "skip";
type Level = "info" | "ok" | "warn" | "error";
type Ev = { at: number; key: Key; st: St; detail?: string } | { at: number; log: [Level, string] } | { at: number; alert: string };
/** `fixed`: a bad value corrected by the person and delivered - the run then holds no row. */
type Plan = { evs: Ev[]; end: number; held: "schema" | "count" | null; loadAt: number; scn: Scn; region: boolean; pipe: Pipe; fixed?: boolean };
/** Whether the run held a row back: a bad value arrived and nobody has corrected it yet. */
const rowHeld = (p: Plan) => p.scn === "bad" && !p.fixed;
/** What the bad value should have been - the row's own value, as the page's language writes it. */
const fixedText = (pipe: Pipe, lang: Lang) => {
  const v = pipe.rows[pipe.bad.row].v[pipe.bad.col];
  return typeof v === "number" ? num(lang, v) : String(v);
};

/** The same choice as useT, outside a component: the plan and the example
 *  data are built for one language at a time. */
const pick =
  (lang: Lang) =>
  <V,>(en: V, cs: V): V =>
    lang === "cs" ? cs : en;

/** What arrives today, each with the icon and tone of what it brings (owner, 2026-11-01: "more
 *  visually appealing, like in the platform, a new colour scheme"): green for a usual morning,
 *  amber for a file that changed shape, red for a bad value. */
const SCENARIOS: [Scn, string, string, string, "ok" | "warn" | "err"][] = [
  ["usual", "As usual", "Jako obvykle", "circle-check", "ok"],
  ["drift", "New column", "Nový sloupec", "columns-3", "warn"],
  ["shrink", "Half the rows", "Polovina řádků", "row-remove", "warn"],
  ["bad", "Bad value", "Chybná hodnota", "alert-triangle", "err"],
];

type Source = { icon: string; name: string; what: string; tag: string };
type Col = { k: string; name: string; type: string; num?: boolean; trunc?: boolean; key?: boolean };
type Row = { src: number; v: Record<string, string | number> };
/** A pipeline of the project, with what its run says - its sources, the
 *  table it fills and its key, the file whose header and count it checks,
 *  and the example a gate or a rule catches in it. */
type Pipe = {
  id: string;
  name: string;
  when: string;
  status: "ok" | "run" | "held";
  table: string;
  key: string;
  sources: Source[];
  file: string;
  read: string;
  cols: number;
  before: string;
  after: string;
  added: number;
  shrunk: string;
  newCol: string;
  newVals: string[];
  dupe: string;
  bad: { row: number; col: string; value: string; why: string; id: string };
  heads: Col[];
  rows: Row[];
};

/** The project's three pipelines in one language. Ids, keys, amounts and
 *  which row goes bad are shared, so a scenario catches the same row in both;
 *  only what a visitor reads changes. */
function pipesIn(lang: Lang): Pipe[] {
  const tr = pick(lang);
  const pct = (n: number) => tr(`${n}%`, `${n} %`);
  const shrunk = (now: number, last: number, drop: number) =>
    tr(`${whole(lang, now)} rows, ${whole(lang, last)} last run (-${drop}%)`, `${whole(lang, now)} řádků, minule ${whole(lang, last)} (-${drop} %)`);
  const manual = tr("MANUAL", "RUČNĚ");
  return [
    {
      id: "inv",
      name: tr("Invoices", "Faktury"),
      when: tr("every weekday at 06:00", "každý pracovní den v 6:00"),
      status: "ok",
      table: tr("Invoices", "Faktury"),
      key: tr("Invoice no.", "Číslo faktury"),
      sources: [
        { icon: "file-spreadsheet", name: "SharePoint", what: tr("invoices_october.xlsx", "faktury_rijen.xlsx"), tag: "XLSX" },
        { icon: "mail", name: tr("E-mail inbox", "E-mailová schránka"), what: count(lang, 2, ["e-invoice", "e-invoices"], ["e-faktura", "e-faktury", "e-faktur"]), tag: "ISDOC" },
        { icon: "pencil", name: tr("Manual input", "Ruční zadání"), what: tr("Corrections · by Jana", "Opravy · zadala Jana"), tag: manual },
      ],
      file: tr("invoices_october.xlsx", "faktury_rijen.xlsx"),
      read: tr(
        "Read invoices_october.xlsx (header found on row 4), 2 ISDOC e-invoices and 2 rows typed in Corrections: 9 rows.",
        "Načten soubor faktury_rijen.xlsx (záhlaví nalezeno na řádku 4), 2 e-faktury ISDOC a 2 řádky zadané v Opravách: celkem 9 řádků.",
      ),
      cols: 7,
      before: whole(lang, 1284),
      after: whole(lang, 1292),
      added: 8,
      shrunk: shrunk(616, 1284, 52),
      newCol: tr("Region", "Kraj"),
      newVals: tr(
        ["Prague", "South Moravian", "Prague", "Moravian-Silesian", "South Moravian", "South Moravian", "Hradec Králové", "Prague"],
        ["Praha", "Jihomoravský", "Praha", "Moravskoslezský", "Jihomoravský", "Jihomoravský", "Královéhradecký", "Praha"],
      ),
      dupe: tr(
        "FV-2026-105 came twice, in invoices_october.xlsx and as an e-invoice. Kept once, matched on Invoice no.",
        "Faktura FV-2026-105 přišla dvakrát, v souboru faktury_rijen.xlsx a jako e-faktura. Ponechána jednou, spárováno podle sloupce Číslo faktury.",
      ),
      bad: { row: 6, col: "amount", value: "6k", why: tr("is not an amount", "není částka"), id: "FV-2026-107" },
      heads: [
        { k: "no", name: tr("Invoice no.", "Číslo faktury"), type: "text", key: true },
        { k: "who", name: tr("Customer", "Odběratel"), type: "text", trunc: true },
        { k: "amount", name: tr("Amount (CZK)", "Částka (Kč)"), type: "decimal", num: true },
        { k: "status", name: tr("Status", "Stav"), type: "select" },
      ],
      // The status stays the English key in both languages: kit's Status pill
      // builds its class from it (is-paid), and the word shown is its to choose.
      rows: [
        { src: 0, v: { no: "FV-2026-101", who: "Pekárna U Mlýna s.r.o.", amount: 12840, status: "Paid" } },
        { src: 0, v: { no: "FV-2026-102", who: "Zahradnictví Hájek", amount: 5699, status: "Open" } },
        { src: 0, v: { no: "FV-2026-103", who: "Kavárna Na Rohu", amount: 845, status: "Overdue" } },
        { src: 0, v: { no: "FV-2026-104", who: "Elektro Svoboda a.s.", amount: 3120.5, status: "Paid" } },
        { src: 1, v: { no: "FV-2026-105", who: "Truhlářství Novák", amount: 6000, status: "Open", merged: 1 } },
        { src: 1, v: { no: "FV-2026-106", who: "Moravská vinotéka", amount: 2410, status: "Open" } },
        { src: 2, v: { no: "FV-2026-107", who: "Pivovar Hradec", amount: 6000, status: "Open" } },
        { src: 2, v: { no: "FV-2026-108", who: "Květinářství Lilie", amount: 960, status: "Open" } },
      ],
    },
    {
      id: "bank",
      name: tr("Bank statements", "Výpisy"),
      when: tr("every hour, 7 to 19", "každou hodinu od 7 do 19"),
      status: "run",
      table: tr("Bank statements", "Výpisy"),
      key: tr("Transaction", "Transakce"),
      sources: [
        { icon: "file-description", name: tr("ČSOB statement", "Výpis ČSOB"), what: tr("statement_2026_11.gpc", "vypis_2026_11.gpc"), tag: "GPC" },
        { icon: "api", name: "ČSOB API", what: tr("3 new movements", "3 nové pohyby"), tag: "API" },
        { icon: "pencil", name: tr("Manual input", "Ruční zadání"), what: tr("Cash desk · by Petr", "Pokladna · zadal Petr"), tag: manual },
      ],
      file: tr("statement_2026_11.gpc", "vypis_2026_11.gpc"),
      read: tr(
        "Read statement_2026_11.gpc (GPC: amounts in haléře, the sign from the booking code), 3 movements from the bank's API and 2 rows typed in Cash desk: 9 rows.",
        "Načten soubor vypis_2026_11.gpc (GPC: částky v haléřích, znaménko podle kódu zaúčtování), 3 pohyby z API banky a 2 řádky zadané v Pokladně: celkem 9 řádků.",
      ),
      cols: 6,
      before: whole(lang, 3412),
      after: whole(lang, 3420),
      added: 8,
      shrunk: shrunk(1590, 3412, 53),
      newCol: tr("Category", "Kategorie"),
      newVals: tr(
        ["Sales", "Energy", "Sales", "Phone", "Sales", "Sales", "Cash desk", "Cash desk"],
        ["Tržby", "Energie", "Tržby", "Telefon", "Tržby", "Tržby", "Pokladna", "Pokladna"],
      ),
      dupe: tr(
        "TX 1103-118 came twice, in the morning's GPC file and again from the API. Kept once, matched on Transaction.",
        "Pohyb TX 1103-118 přišel dvakrát, v ranním souboru GPC a znovu z API. Ponechán jednou, spárováno podle sloupce Transakce.",
      ),
      bad: {
        row: 6,
        col: "amount",
        value: tr("1,230.5O", "1.230,5O"),
        // Short enough for the held banner's one line beside its button.
        why: tr("has a letter O for a 0", "má místo nuly písmeno O"),
        id: tr("Cash desk, row 7", "Pokladna, řádek 7"),
      },
      heads: [
        { k: "date", name: tr("Date", "Datum"), type: "date" },
        { k: "who", name: tr("Counterparty", "Protistrana"), type: "text", trunc: true },
        { k: "vs", name: "VS", type: "text" },
        { k: "amount", name: tr("Amount (CZK)", "Částka (Kč)"), type: "decimal", num: true },
      ],
      rows: [
        { src: 0, v: { date: day(lang, "2026-11-03"), who: "Pekárna U Mlýna s.r.o.", vs: "2026101", amount: 12840 } },
        { src: 0, v: { date: day(lang, "2026-11-03"), who: "ČEZ Prodej, a.s.", vs: "8820114", amount: -2450 } },
        { src: 0, v: { date: day(lang, "2026-11-04"), who: "Zahradnictví Hájek", vs: "2026102", amount: 5699 } },
        { src: 0, v: { date: day(lang, "2026-11-04"), who: "Telefonie Plus a.s.", vs: "77120044", amount: -1299 } },
        { src: 1, v: { date: day(lang, "2026-11-05"), who: "Truhlářství Novák", vs: "2026104", amount: 6000, merged: 1 } },
        { src: 1, v: { date: day(lang, "2026-11-05"), who: "Kavárna Na Rohu", vs: "2026105", amount: 845 } },
        { src: 2, v: { date: day(lang, "2026-11-05"), who: tr("Cash desk: small purchases", "Pokladna: drobné nákupy"), vs: "", amount: -1230.5 } },
        { src: 2, v: { date: day(lang, "2026-11-06"), who: tr("Cash desk: takings", "Pokladna: tržba"), vs: "", amount: 4380 } },
      ],
    },
    {
      id: "price",
      name: tr("Price list", "Ceník"),
      when: tr("Mondays at 07:00", "každé pondělí v 7:00"),
      status: "held",
      table: tr("Price list", "Ceník"),
      key: tr("Code", "Kód"),
      sources: [
        { icon: "api", name: "ERP", what: tr("5 changed prices", "5 změněných cen"), tag: "API" },
        { icon: "file-spreadsheet", name: "SharePoint", what: tr("promo_november.xlsx", "akce_listopad.xlsx"), tag: "XLSX" },
        { icon: "pencil", name: tr("Manual input", "Ruční zadání"), what: tr("Manual prices · by Eva", "Ruční ceny · zadala Eva"), tag: manual },
      ],
      file: tr("promo_november.xlsx", "akce_listopad.xlsx"),
      read: tr(
        "Read 5 changed prices from the ERP, promo_november.xlsx (header found on row 2) and 2 prices typed by Eva: 9 rows.",
        "Načteno 5 změněných cen z ERP, soubor akce_listopad.xlsx (záhlaví nalezeno na řádku 2) a 2 ceny zadané Evou: celkem 9 řádků.",
      ),
      cols: 6,
      before: whole(lang, 412),
      after: whole(lang, 416),
      added: 8,
      shrunk: shrunk(196, 412, 52),
      newCol: tr("Discount", "Sleva"),
      newVals: [pct(10), "", "", pct(15), "", "", "", ""],
      dupe: tr(
        "CHL-001 came twice, from the ERP and in promo_november.xlsx. Kept once, matched on Code.",
        "Položka CHL-001 přišla dvakrát, z ERP a v souboru akce_listopad.xlsx. Ponechána jednou, spárováno podle sloupce Kód.",
      ),
      bad: { row: 6, col: "price", value: tr("on request", "na dotaz"), why: tr("is not a price", "není cena"), id: "DRT-007" },
      heads: [
        { k: "code", name: tr("Code", "Kód"), type: "text", key: true },
        { k: "what", name: tr("Product", "Produkt"), type: "text", trunc: true },
        { k: "price", name: tr("Price (CZK)", "Cena (Kč)"), type: "decimal", num: true },
        { k: "vat", name: tr("VAT", "DPH"), type: "select" },
      ],
      rows: [
        { src: 0, v: { code: "CHL-001", what: tr("Sourdough bread", "Chléb kváskový"), price: 54, vat: pct(12), merged: 1 } },
        { src: 0, v: { code: "ROH-002", what: tr("Bread roll", "Rohlík"), price: 3.5, vat: pct(12) } },
        { src: 0, v: { code: "KOL-003", what: tr("Curd cheese kolach", "Koláč tvarohový"), price: 28, vat: pct(12) } },
        { src: 0, v: { code: "BAG-004", what: tr("Baguette", "Bageta"), price: 32, vat: pct(12) } },
        { src: 1, v: { code: "CRO-005", what: "Croissant", price: 29.9, vat: pct(12) } },
        { src: 1, v: { code: "ROZ-006", what: tr("Delivery", "Rozvoz"), price: 199, vat: pct(21) } },
        { src: 2, v: { code: "DRT-007", what: tr("Custom cake", "Dort na zakázku"), price: 890, vat: pct(12) } },
        { src: 2, v: { code: "KAV-008", what: tr("Coffee to go", "Káva s sebou"), price: 45, vat: pct(21) } },
      ],
    },
  ];
}

/** Built once per language and kept, so a pipeline is the same object for
 *  the whole visit: the list tells the open one by identity. */
const PIPES: Record<Lang, Pipe[]> = { en: pipesIn("en"), cs: pipesIn("cs") };

const GATES: { key: Key; icon: string; name: [string, string]; idle: (p: Pipe, lang: Lang) => string }[] = [
  { key: "schema", icon: "columns-3", name: ["Schema", "Schéma"], idle: (_, l) => pick(l)("Columns as expected", "Sloupce beze změny") },
  { key: "count", icon: "list-details", name: ["Row count", "Počet řádků"], idle: (_, l) => pick(l)("No sudden drop", "Bez náhlého propadu") },
  { key: "dedup", icon: "copy", name: ["Duplicates", "Duplicity"], idle: (p, l) => pick(l)(`On ${p.key}`, `Klíč: ${p.key}`) },
  { key: "rules", icon: "checks", name: ["Validation", "Validace"], idle: (_, l) => pick(l)("5 rules", "5 pravidel") },
];

/** The rows a run brings, its bad value in place when that is what arrived. */
const rowsFor = (p: Pipe, scn: Scn): (Row & { held?: boolean })[] =>
  p.rows.map((r, i) => (scn === "bad" && i === p.bad.row ? { ...r, v: { ...r.v, [p.bad.col]: p.bad.value }, held: true } : r));

/** The run, as a list of what happens when: each part starts, then ends in
 *  its state, and the log gains a line. A gate that holds stops the load;
 *  alerting runs either way. `accepted` is the person's answer to a hold -
 *  accept the new column, or let a short file through. Every line is written
 *  in the page's language as the plan is made, so the log reads as one. */
function plan(pipe: Pipe, scn: Scn, accepted: boolean, lang: Lang): Plan {
  const tr = pick(lang);
  const rows = (k: number) => count(lang, k, ["row", "rows"], ["řádek", "řádky", "řádků"]);
  const evs: Ev[] = [];
  let t = 250;
  const n = pipe.rows.length;
  const log = (lvl: Level, text: string) => evs.push({ at: t, log: [lvl, text] });
  const step = (key: Key, dur: number, st: St, detail: string) => {
    evs.push({ at: t, key, st: "run" });
    t += dur;
    evs.push({ at: t, key, st, detail });
  };
  const alert = (text: string) => {
    step("alert", 650, "warn", tr("Alert sent", "Upozornění odesláno"));
    evs.push({ at: t, alert: text });
    log("warn", tr("Alert sent to Teams #finance: a link to the run, never the data.", "Upozornění odesláno do Teams #finance: odkaz na běh, nikdy data."));
  };
  const hold = (gate: "schema" | "count", why: string, msg: string): Plan => {
    log("error", why);
    t += 200;
    (["count", "dedup", "rules", "load"] as Key[]).filter((k) => k !== gate).forEach((k) => evs.push({ at: t, key: k, st: "skip" }));
    log("warn", tr(`Held: nothing reached ${pipe.table}, which keeps the last good rows.`, `Zastaveno: do tabulky ${pipe.table} nedorazilo nic, ponechává si poslední dobré řádky.`));
    alert(msg);
    t += 150;
    return { evs, end: t + 100, held: gate, loadAt: Infinity, scn, region: false, pipe };
  };

  evs.push({ at: 0, log: ["info", tr(`Run started · ${pipe.name} pipeline`, `Běh spuštěn · pipeline ${pipe.name}`)] });
  [0, 1, 2].forEach((i) => evs.push({ at: 100 + i * 180, key: `src${i}` as Key, st: "run" }));
  step("read", 900, "ok", tr(`${rows(n + 1)} read`, `Načteno ${rows(n + 1)}`));
  [0, 1, 2].forEach((i) => evs.push({ at: t, key: `src${i}` as Key, st: "ok" }));
  log("info", pipe.read);

  if (scn === "drift" && !accepted) {
    step("schema", 700, "hold", tr(`New: ${pipe.newCol}`, `Nový: ${pipe.newCol}`));
    return hold(
      "schema",
      tr(
        `Schema drift: ${pipe.file} has a new column, “${pipe.newCol}”. This pipeline holds any change to the columns.`,
        `Změna schématu: ${pipe.file} má nový sloupec „${pipe.newCol}“. Tato pipeline zastaví každou změnu sloupců.`,
      ),
      tr(
        `${pipe.name} pipeline held at the schema gate: ${pipe.file} has a new column, “${pipe.newCol}”.`,
        `Pipeline ${pipe.name} zastavena na bráně schématu: ${pipe.file} má nový sloupec „${pipe.newCol}“.`,
      ),
    );
  }
  step("schema", 500, scn === "drift" ? "warn" : "ok", scn === "drift" ? tr(`${pipe.newCol} accepted`, `Přijato: ${pipe.newCol}`) : tr("Same columns", "Beze změny"));
  log(
    scn === "drift" ? "warn" : "ok",
    scn === "drift"
      ? tr(`Schema: “${pipe.newCol}” accepted and added to ${pipe.table} as Text.`, `Schéma: sloupec „${pipe.newCol}“ přijat a přidán do tabulky ${pipe.table} jako Text.`)
      : tr(`Schema: the same ${pipe.cols} columns as the last run.`, `Schéma: beze změny, ${count(lang, pipe.cols, ["column", "columns"], ["sloupec", "sloupce", "sloupců"])} jako při minulém běhu.`),
  );

  if (scn === "shrink" && !accepted) {
    step("count", 700, "hold", tr("-52% rows", "-52 % řádků"));
    return hold(
      "count",
      tr(`Row count: ${pipe.file} holds ${pipe.shrunk}. The limit is 30%.`, `Počet řádků: ${pipe.file} má ${pipe.shrunk}. Limit je 30 %.`),
      tr(
        `${pipe.name} pipeline held at the row count gate: ${pipe.file} came with about half its usual rows.`,
        `Pipeline ${pipe.name} zastavena na bráně počtu řádků: ${pipe.file} přišel jen se zhruba polovinou obvyklých řádků.`,
      ),
    );
  }
  step("count", 500, scn === "shrink" ? "warn" : "ok", scn === "shrink" ? tr("Let through", "Propuštěno") : `+${rows(pipe.added)}`);
  log(
    scn === "shrink" ? "warn" : "ok",
    scn === "shrink"
      ? tr("Row count: about half the rows, let through once.", "Počet řádků: zhruba polovina řádků, jednou propuštěno.")
      : tr(`Row count: ${pipe.before} rows before, ${pipe.after} after.`, `Počet řádků: předtím ${pipe.before}, nyní ${pipe.after}.`),
  );

  step("dedup", 550, "ok", tr("1 merged", "1 sloučen"));
  log("ok", tr(`Duplicates: ${pipe.dupe}`, `Duplicity: ${pipe.dupe}`));

  // A bad value the person corrected from the banner is delivered as corrected, and the fix is
  // kept for the next run, as Validate keeps one (owner, 2026-11-01: "accept fix or something").
  const fixed = scn === "bad" && accepted;
  const bad = scn === "bad" && !accepted;
  const went = bad ? n - 1 : n;
  step("rules", 700, bad ? "warn" : "ok", bad ? tr("1 row held", "1 řádek zadržen") : fixed ? tr("1 fixed, all pass", "1 opraven, vše prošlo") : tr("All pass", "Vše prošlo"));
  log(
    bad ? "warn" : "ok",
    bad
      ? tr(
          `Validation: ${pipe.bad.id} held because “${pipe.bad.value}” ${pipe.bad.why}. The other ${n - 1} go on.`,
          `Validace: zadržen 1 řádek (${pipe.bad.id}), protože „${pipe.bad.value}“ ${pipe.bad.why}. Zbylých ${rows(n - 1)} pokračuje.`,
        )
      : fixed
        ? tr(
            `Validation: ${pipe.bad.id} corrected from “${pipe.bad.value}” to ${fixedText(pipe, lang)}, and the fix is kept for next time. All ${n} rows pass.`,
            `Validace: ${pipe.bad.id} opraven z „${pipe.bad.value}“ na ${fixedText(pipe, lang)} a oprava zůstane i pro příště. Prošlo všech ${rows(n)}.`,
          )
        : tr(`Validation: 5 rules, all ${n} rows pass.`, `Validace: 5 pravidel, všech ${rows(n)} prošlo.`),
  );
  const loadAt = t;
  step("load", 1600, "ok", tr(`${rows(went)} in`, `Nahráno ${rows(went)}`));
  log("ok", tr(`Merged into ${pipe.table} on ${pipe.key}: ${rows(went)}.`, `Sloučeno do tabulky ${pipe.table} podle sloupce ${pipe.key}: ${rows(went)}.`));
  if (bad)
    alert(
      tr(
        `${pipe.name} pipeline: 1 row held by validation (${pipe.bad.id}) because “${pipe.bad.value}” ${pipe.bad.why}. ${rows(n - 1)} went in.`,
        `Pipeline ${pipe.name}: validace zadržela 1 řádek (${pipe.bad.id}), protože „${pipe.bad.value}“ ${pipe.bad.why}. Nahráno ${rows(n - 1)}.`,
      ),
    );
  else {
    step("alert", 500, "ok", tr("All clear", "Vše v pořádku"));
    log("ok", tr("Alerts: all clear, nothing to send.", "Upozornění: vše v pořádku, není co posílat."));
  }
  t += 150;
  log("ok", tr(`Succeeded in ${Math.round(t / 1000)} s.`, `Úspěšně dokončeno za ${Math.round(t / 1000)} s.`));
  return { evs, end: t + 100, held: null, loadAt, scn, region: scn === "drift", pipe, fixed };
}

const ROW_GAP = 180;
/** The weekdays before today: how long each run took (the bar's height) and
 *  whether a gate held it. */
const PAST: { h: number; held?: boolean }[] = [12, 14, 13, 16, 12, 15, 13, 12, 14, 13, 15].map((h, i) => ({ h, held: i === 4 || i === 8 }));

/** A run's clock: -1 before the first run, then milliseconds since it began,
 *  stopping at its end. It re-renders about twenty times a second, which is
 *  all the steps need; with less motion asked for, a run is over at once. */
function useClock() {
  const [t, setT] = useState(-1);
  const raf = useRef(0);
  const run = useCallback((end: number) => {
    cancelAnimationFrame(raf.current);
    if (prefersLessMotion()) return setT(end);
    const t0 = performance.now();
    let last = -Infinity;
    setT(0);
    const tick = (now: number) => {
      const v = Math.min(end, now - t0);
      if (v - last >= 50 || v === end) {
        last = v;
        setT(v);
      }
      if (v < end) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return { t, run };
}

/** Where a part of the pipeline stands at time t, and what it says. */
function at(p: Plan, t: number, key: Key): { st: St; detail?: string } {
  let cur: { st: St; detail?: string } = { st: "idle" };
  for (const e of p.evs) if ("key" in e && e.key === key && e.at <= t) cur = { st: e.st, detail: e.detail };
  return cur;
}

const clock = (ms: number) => `06:00:${String(Math.floor(ms / 1000)).padStart(2, "0")}`;

/* ---------------------------------------------------------------- autoplay */

type Start = (scn: Scn, accepted?: boolean, pipe?: Pipe) => void;

/** A beat of the story the screen tells by itself. Each is a press a visitor
 *  could make - a pipeline in the list (`pipe`), a scenario, or the banner's
 *  answer to a hold (`accept`) - with the line over the table that says what
 *  it shows. The line is written from the pipeline's own data, so it names
 *  the file, the column and the value the run itself does. */
type Beat = { scn: Scn; pipe?: number; accept?: boolean; say: (x: Pipe) => [string, string] };

/** Invoices on a usual morning, then what two of the gates are for - a new
 *  column held and accepted, a bad value held alone - then the other two
 *  pipelines, Bank statements with a file half its usual size let through
 *  once, and round again to the usual morning. */
const STORY: Beat[] = [
  {
    pipe: 0,
    scn: "usual",
    say: (x) => [
      `A usual morning: ${x.name} reads three sources, passes four quality gates and merges the rows in.`,
      `Běžné ráno: pipeline ${x.name} načte tři zdroje, projde čtyřmi branami kvality a řádky sloučí do tabulky.`,
    ],
  },
  {
    scn: "drift",
    say: (x) => [
      `Today ${x.file} has a new column, “${x.newCol}”: the schema gate holds the run and alerts the team.`,
      `Dnes má soubor ${x.file} nový sloupec „${x.newCol}“: brána schématu běh zastaví a upozorní tým.`,
    ],
  },
  {
    scn: "drift",
    accept: true,
    say: (x) => [
      `The team accepts “${x.newCol}” and runs it again; the column joins ${x.table}.`,
      `Tým sloupec „${x.newCol}“ přijme, spustí běh znovu a sloupec přibude v tabulce ${x.table}.`,
    ],
  },
  {
    scn: "bad",
    say: (x) => [
      `A row arrives with “${x.bad.value}”, which ${x.bad.why}. Validation holds that row alone; the rest go in.`,
      `Jeden řádek přinese hodnotu „${x.bad.value}“, která ${x.bad.why}. Validace zadrží jen tento řádek, ostatní projdou.`,
    ],
  },
  {
    pipe: 1,
    scn: "usual",
    say: (x) => [
      `${x.name} runs ${x.when}: a GPC file, the bank's API and the cash desk, into one table.`,
      `Pipeline ${x.name} běží ${x.when}: soubor GPC, API banky a pokladna do jedné tabulky.`,
    ],
  },
  {
    scn: "shrink",
    say: (x) => [
      `Today ${x.file} brings half its usual rows: the row count gate holds the run, and ${x.table} keeps the last good rows.`,
      `Dnes přinese soubor ${x.file} jen polovinu obvyklých řádků: brána počtu řádků běh zastaví a tabulka ${x.table} si ponechá poslední dobré řádky.`,
    ],
  },
  {
    scn: "shrink",
    accept: true,
    say: () => [
      "The team knows why the file is short and lets it through once. The next run is checked as before.",
      "Tým ví, proč je soubor kratší, a jednou ho propustí. Příští běh se kontroluje jako dřív.",
    ],
  },
  {
    pipe: 2,
    scn: "usual",
    say: (x) => [
      `${x.name} runs ${x.when}: the ERP, a promo file and prices typed in by hand.`,
      `Pipeline ${x.name} běží ${x.when}: ERP, akční soubor a ručně zadané ceny.`,
    ],
  },
];

/** A phone's width, as app.css draws the phone's own Deliver. Asked once, when
 *  the screen mounts. */
const isPhone = () => window.matchMedia("(max-width:600px)").matches;

/** On a phone the story is a usual morning of each pipeline and nothing else
 *  (owner, 2026-11-01: "in Deliver on mobile probably keep just As usual, so
 *  no switch, for a better look"): the chips that pick what arrives are not
 *  shown there, and a held run nobody chose would come out of nowhere. A
 *  wider window plays the whole story. */
const storyHere = (): Beat[] => (isPhone() ? STORY.filter((b) => b.scn === "usual") : STORY);

/** How long a finished run stays on screen before the next beat: time to
 *  read it, and longer when a banner says what was held. */
const REST = 3000;
const REST_HELD = 4500;

/** Whether any part of the window is on screen now. useSeen answers once and
 *  stops looking; the story asks before every beat, so it waits instead of
 *  playing to nobody, and a visitor back up at the hero does not scroll over
 *  a demo re-rendering out of sight. */
function useInView(ref: React.RefObject<Element>): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => setOn(es[es.length - 1].isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

/** The screen plays by itself until the visitor takes over (owner,
 *  2026-11-01: "there should always be some kind of loop playing in all
 *  tabs"). Every beat goes through the screen's own `start` with what the
 *  button it stands for passes, so what plays is exactly what a click gives.
 *  A beat waits for its run to end - the clock reaching the plan's own end,
 *  not a guess at how long it takes - rests on what the run shows, then plays
 *  the next, and after the last the first again. The first run starts a
 *  moment after the window is seen, as it always has; with less motion asked
 *  for, that run is over at once and nothing follows it. The first press or
 *  key inside the window - a person's, not a script's - hands the screen over
 *  for good on this visit: nothing waiting starts, the run on screen finishes
 *  where it was going, and the line over the table goes. Returns the beat on
 *  screen, or -1 when none is. */
function useAutoplay(root: React.RefObject<HTMLElement>, seen: boolean, done: boolean, rest: number, start: Start, lang: Lang, story: Beat[]): number {
  const inView = useInView(root);
  const [beat, setBeat] = useState(-1);
  // State rather than a ref: setting it re-runs both timing effects below,
  // and their cleanups are what clear whatever timer is waiting.
  const [mine, setMine] = useState(false);
  const began = useRef(false);

  const play = useCallback(
    (i: number) => {
      const b = story[i];
      if (!prefersLessMotion()) setBeat(i);
      start(b.scn, b.accept, b.pipe === undefined ? undefined : PIPES[lang][b.pipe]);
    },
    [start, lang, story],
  );

  useEffect(() => {
    if (!seen || began.current || mine) return;
    began.current = true;
    const id = window.setTimeout(() => play(0), 600);
    return () => clearTimeout(id);
  }, [seen, mine, play]);

  useEffect(() => {
    if (beat < 0 || !done || mine || !inView) return;
    const id = window.setTimeout(() => play((beat + 1) % story.length), rest);
    return () => clearTimeout(id);
  }, [beat, done, mine, inView, rest, play, story]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    // Capture, so the press is seen before the button it lands on starts a
    // run of the visitor's own; isTrusted, so only a person's press counts.
    const stop = (e: Event) => {
      if (!e.isTrusted) return;
      setMine(true);
      setBeat(-1);
      off();
    };
    const off = () => {
      el.removeEventListener("pointerdown", stop, true);
      el.removeEventListener("keydown", stop, true);
    };
    el.addEventListener("pointerdown", stop, true);
    el.addEventListener("keydown", stop, true);
    return off;
  }, [root]);

  return beat;
}

/* ------------------------------------------------------------------ screen */

export function ImportScreen() {
  const root = useRef<HTMLDivElement>(null);
  const seen = useSeen(root, 0.5);
  // The parent remounts the screen when the language changes, so the
  // language read here holds for this screen's whole life.
  const lang = useLang();
  const tr = useT();
  const [p, setP] = useState<Plan>(() => plan(PIPES[lang][0], "usual", false, lang));
  const { t, run } = useClock();
  const running = t >= 0 && t < p.end;
  const done = t >= p.end;

  const start = useCallback(
    (scn: Scn, accepted = false, pipe?: Pipe) => {
      const next = plan(pipe ?? p.pipe, scn, accepted, lang);
      setP(next);
      run(next.end);
    },
    [run, p.pipe, lang],
  );

  const [story] = useState(storyHere);
  const beat = useAutoplay(root, seen, done, p.held || rowHeld(p) ? REST_HELD : REST, start, lang, story);

  return (
    <div className="tt" ref={root}>
      <Head
        icon="timeline"
        title={tr(`${p.pipe.name} pipeline`, `Pipeline ${p.pipe.name}`)}
        sub={tr(
          `4 quality gates · written all or nothing · ${p.pipe.when}`,
          `4 brány kvality · zápis vše, nebo nic · ${p.pipe.when}`,
        )}
      >
        <span className="tt-seg tt-scn" role="radiogroup" aria-label={tr("What arrives today", "Co dnes dorazí")}>
          {SCENARIOS.map(([id, en, cs, icon, tone]) => (
            <button key={id} role="radio" aria-checked={p.scn === id} className={`is-${tone}`} disabled={running} onClick={() => start(id)}>
              <span className="tt-scn-ic">
                <I n={icon} />
              </span>
              {tr(en, cs)}
            </button>
          ))}
        </span>
        <button className={`tt-btn is-primary${t < 0 ? " is-nudge" : ""}${running ? " is-busy" : ""}`} onClick={() => start(p.scn)} disabled={running}>
          {running ? <I n="loader-2" className="tt-spin" /> : <I n={done ? "refresh" : "player-play"} />}
          {running ? tr("Running", "Běží") : done ? tr("Run again", "Spustit znovu") : tr("Run now", "Spustit teď")}
        </button>
      </Head>
      <div className="tt-main is-flow">
        <Flow p={p} t={t} start={start} running={running} />
        <div className="tt-card">
          <div className="tt-gridbox">
            <Landed p={p} t={t} />
          </div>
          {/* Where Tables puts its tour's line, over the grid's last rows: keyed by
              the beat, so each new line arrives rather than changes in place. */}
          {beat >= 0 && (
            <div className="tt-tour" role="status" key={beat}>
              <b>{tr(`${beat + 1} of ${story.length}`, `${beat + 1} z ${story.length}`)}</b>
              {tr(...story[beat].say(p.pipe))}
            </div>
          )}
          <div className="tt-foot">
            <Summary p={p} t={t} running={running} done={done} />
          </div>
        </div>
        <RunLog p={p} t={t} running={running} done={done} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- flow */

type Wire = "idle" | "live" | "done" | "cut" | "alert";
type Edge = { id: string; from: string; to: string; branch?: boolean };
/** The lines of the flow, between the parts named by data-part: each source
 *  into Read, then on through the gates into the table. Alerting is not the
 *  next stop after the table - nothing flows into it - but what a gate sets
 *  off: a dashed trigger line from the gates, marked as such (owner,
 *  2026-11-01: "no arrow between Faktury and Alerts, only a gate triggers
 *  alerts"). */
const EDGES: Edge[] = [
  { id: "s0", from: "src0", to: "read" },
  { id: "s1", from: "src1", to: "read" },
  { id: "s2", from: "src2", to: "read" },
  { id: "gates", from: "read", to: "gates" },
  { id: "load", from: "gates", to: "load" },
  { id: "branch", from: "gates", to: "alert", branch: true },
];

function wireOf(p: Plan, t: number, e: Edge): Wire {
  const st = (k: Key) => at(p, t, k).st;
  const gates = GATES.map((g) => st(g.key));
  const fin = (s: St) => s === "ok" || s === "warn" || s === "hold";
  switch (e.id) {
    case "s0":
    case "s1":
    case "s2":
      return st("read") === "run" ? "live" : fin(st("read")) ? "done" : "idle";
    case "gates":
      return gates.includes("run") ? "live" : gates.some(fin) ? "done" : "idle";
    case "load":
      return st("load") === "run" ? "live" : st("load") === "skip" ? "cut" : fin(st("load")) ? "done" : "idle";
    default: {
      const sent = p.held || rowHeld(p);
      if (!sent) return "idle";
      return st("alert") === "run" ? "live" : fin(st("alert")) ? "alert" : "idle";
    }
  }
}

/** Where a part sits inside the flow, by layout rather than by what is on
 *  screen: the window tilts and scales as it rises into view, and a box read
 *  from the screen mid-rise would put every line in the wrong place. */
function placeIn(box: HTMLElement, el: HTMLElement) {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = el; n && n !== box; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

/** Measures the parts and draws the lines between them as the app draws a
 *  pipeline: thin straight arrows, turning at right angles where the three
 *  sources meet Read, and where the gates' branch runs under the table to
 *  alerting. Redrawn when the window changes size. */
function useEdges(box: React.RefObject<HTMLDivElement>, which: string) {
  const [paths, setPaths] = useState<Record<string, string>>({});
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const part = (n: string) => {
        const p = el.querySelector<HTMLElement>(`[data-part="${n}"]`);
        return p ? placeIn(el, p) : null;
      };
      const next: Record<string, string> = {};
      for (const e of EDGES) {
        const a = part(e.from);
        const b = part(e.to);
        if (!a || !b || !a.w || !b.w) continue;
        // Each line stops short of its part by the arrowhead's length.
        if (e.branch) {
          // Under the table's node: out of the gates' foot, down, across, up into alerting's foot.
          const x1 = Math.round(a.x + a.w * 0.62) + 0.5;
          const x2 = Math.round(b.x + b.w * 0.5) + 0.5;
          // Low enough to clear the gates, with the flow's foot under it, so the trigger's
          // mark sits in the open, clear of the banner under the flow (owner, 2026-11-01).
          const dip = Math.round(Math.max(a.y + a.h, b.y + b.h) + 20) + 0.5;
          next[e.id] = `M${x1},${a.y + a.h} V${dip} H${x2} V${b.y + b.h + 7}`;
          // Where the trigger's mark sits: on the line's run under the table.
          next[`${e.id}@`] = `${Math.round((x1 + x2) / 2)},${Math.round(dip)}`;
        } else {
          const x1 = a.x + a.w;
          const y1 = Math.round(a.y + a.h / 2) + 0.5;
          const x2 = b.x - 7;
          const y2 = Math.round(b.y + b.h / 2) + 0.5;
          const mx = Math.round(x1 + Math.min(14, (x2 - x1) / 2)) + 0.5;
          next[e.id] = Math.abs(y1 - y2) < 1.5 ? `M${x1},${y1} H${x2}` : `M${x1},${y1} H${mx} V${y2} H${x2}`;
        }
      }
      setPaths(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [box, which]);
  return paths;
}

/** The arrowheads, one per state, filled in the colour of their line. */
const HEADS: Record<Wire, string> = { idle: "rgba(233,162,59,.45)", live: "#E9A23B", done: "#E9A23B", cut: "rgba(233,162,59,.4)", alert: "#E9A23B" };

/** What a finished run has to say under the flow, as the app says it on a
 *  pipeline: why it was held and the one thing that lets it on, or what a
 *  rule held back. */
function Banner({ p, start }: { p: Plan; start: (s: Scn, accepted?: boolean) => void }) {
  const tr = useT();
  const lang = useLang();
  const { pipe } = p;
  // Short enough for one line beside its button (owner, 2026-11-01: "this text in one line").
  const kept = tr(`${pipe.table} keeps its last good load.`, `Tabulka ${pipe.table} si nechává poslední dobrá data.`);
  if (p.held === "schema")
    return (
      <div className="tt-banner">
        <span>
          {tr(`Held at the schema gate: ${pipe.file} has a new column, “${pipe.newCol}”.`, `Zastaveno u brány schématu: ${pipe.file} má nový sloupec „${pipe.newCol}“.`)}{" "}
          {kept}
        </span>
        <button className="tt-btn is-sm" onClick={() => start(p.scn, true)}>
          {tr(`Accept ${pipe.newCol} and run again`, `Přijmout sloupec ${pipe.newCol} a spustit znovu`)}
        </button>
      </div>
    );
  if (p.held === "count")
    return (
      <div className="tt-banner">
        <span>
          {tr(`Held at the row count gate: ${pipe.shrunk}.`, `Zastaveno u brány počtu řádků: ${pipe.shrunk}.`)} {kept}
        </span>
        <button className="tt-btn is-sm" onClick={() => start(p.scn, true)}>
          {tr("Let it through once", "Jednou propustit")}
        </button>
      </div>
    );
  if (rowHeld(p)) {
    const rest = count(lang, pipe.rows.length - 1, ["row", "rows"], ["řádek", "řádky", "řádků"]);
    const to = fixedText(pipe, lang);
    return (
      <div className="tt-banner">
        <span>
          {tr(
            `1 row held by validation: ${pipe.bad.id}, “${pipe.bad.value}” ${pipe.bad.why}. The other ${pipe.rows.length - 1} went in; the team has an alert.`,
            `Validace zadržela 1 řádek: ${pipe.bad.id}, „${pipe.bad.value}“ ${pipe.bad.why}. Zbylých ${rest} je nahráno, tým má upozornění.`,
          )}
        </span>
        {/* The one thing that lets it on: the value it should have been, delivered and kept as
            a fix for the next run (owner, 2026-11-01: "there should be accept fix or similar"). */}
        <button className="tt-btn is-sm" onClick={() => start(p.scn, true)}>
          <I n="wand" /> {tr(`Correct to ${to} and deliver`, `Opravit na ${to} a doručit`)}
        </button>
      </div>
    );
  }
  if (p.fixed)
    return (
      <div className="tt-banner is-ok">
        <span>
          <I n="circle-check" />{" "}
          {tr(
            `${pipe.bad.id} corrected to ${fixedText(pipe, lang)} and delivered; the fix is kept for the next run.`,
            `${pipe.bad.id} opraven na ${fixedText(pipe, lang)} a doručen; oprava zůstane i pro další běh.`,
          )}
        </span>
      </div>
    );
  return null;
}

const DOT: Record<Pipe["status"], [string, string]> = { ok: ["Succeeded", "Úspěšně dokončeno"], run: ["Running", "Běží"], held: ["Held", "Zastaveno"] };

/** The project's pipelines, as the app lists them: each with how its last
 *  run went and when it runs; picking one shows its flow and runs it. */
function Pipelines({ p, running, pick }: { p: Plan; running: boolean; pick: (pipe: Pipe) => void }) {
  const lang = useLang();
  const tr = useT();
  return (
    <div className="tt-pipes" role="tablist" aria-label={tr("Pipelines", "Pipeline")}>
      <span className="tt-label">{tr("Pipelines", "Pipeline")}</span>
      {PIPES[lang].map((x) => (
        <button key={x.id} role="tab" aria-selected={x === p.pipe} disabled={running && x !== p.pipe} onClick={() => x !== p.pipe && pick(x)}>
          <i className={`tt-dot is-${x === p.pipe ? "on" : x.status}`} aria-label={tr(...DOT[x.status])} />
          <b>{x.name}</b>
          <small>{x.when}</small>
        </button>
      ))}
    </div>
  );
}

function Flow({ p, t, start, running }: { p: Plan; t: number; start: (s: Scn, accepted?: boolean, pipe?: Pipe) => void; running: boolean }) {
  const tr = useT();
  const lang = useLang();
  const box = useRef<HTMLDivElement>(null);
  const paths = useEdges(box, p.pipe.id);
  const gateStates = GATES.map((g) => at(p, t, g.key).st);
  const gatesSt = gateStates.includes("hold") ? "hold" : gateStates.includes("run") ? "run" : gateStates.every((s) => s === "ok" || s === "warn") ? "ok" : "idle";
  const { pipe } = p;
  const names = pipe.sources.map((s) => s.name).join(", ");
  // A phone draws the flow as a stepper down one rail (app.css), the three sources one step of
  // it, named by how many there are, with each source's tag beside the count (owner, 2026-11-01:
  // "the Deliver pipeline on smaller screens should be more stunning").
  const [phone] = useState(isPhone);
  return (
    <div className="tt-card tt-canvas">
      <Pipelines p={p} running={running} pick={(x) => start("usual", false, x)} />
      <div
        className="tt-flow"
        ref={box}
        role="img"
        aria-label={tr(
          `Three sources (${names}) read, passed through the schema, row count, duplicates and validation gates, merged into ${pipe.table}, with alerts to Teams for whatever is held`,
          `Tři zdroje (${names}) načtené, prověřené branami schématu, počtu řádků, duplicit a validace a sloučené do tabulky ${pipe.table}, s upozorněním do Teams na vše, co se zadrží`,
        )}
      >
        <svg className="tt-wires" aria-hidden>
          <defs>
            {(Object.keys(HEADS) as Wire[]).map((w) => (
              <marker key={w} id={`tt-ah-${w}`} viewBox="0 0 7 7" refX="0.5" refY="3.5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 z" fill={HEADS[w]} />
              </marker>
            ))}
          </defs>
          {EDGES.map((e) => {
            const d = paths[e.id];
            if (!d) return null;
            const w = wireOf(p, t, e);
            const [x, y] = d.slice(1).split(/[ ,HV]/).map(Number);
            return (
              <g key={e.id}>
                <path d={d} className={`tt-w is-${w}${e.branch ? " is-branch" : ""}`} markerEnd={`url(#tt-ah-${w})`} />
                {!e.branch && <circle cx={x} cy={y} r="3" className={`tt-port is-${w}`} />}
              </g>
            );
          })}
        </svg>
        <div className="tt-srcs">
          {phone && (
            <span className="tt-srcs-n">
              <span className="tt-node-ic">
                <I n="plug" />
              </span>
              <b>{count(lang, pipe.sources.length, ["source", "sources"], ["zdroj", "zdroje", "zdrojů"])}</b>
            </span>
          )}
          {pipe.sources.map((s, i) => (
            <div key={s.name} data-part={`src${i}`} className={`tt-src${at(p, t, `src${i}` as Key).st === "run" ? " is-on" : ""}`}>
              <span className="tt-src-ic">
                <I n={s.icon} />
              </span>
              <span className="tt-node-t">
                <b>{s.name}</b>
                <small>{s.what}</small>
              </span>
              <span className="tt-tag">{s.tag}</span>
            </div>
          ))}
        </div>
        <Node part="read" icon="file-description" name={tr("Read", "Načtení")} idle={tr("Header, types", "Záhlaví, typy")} {...at(p, t, "read")} />
        <div data-part="gates" className={`tt-gates is-${gatesSt}`}>
          <span className="tt-gates-h">
            <I n="shield-check" /> {tr("Quality gates", "Brány kvality")}
          </span>
          {GATES.map((g) => {
            const s = at(p, t, g.key);
            return (
              <div key={g.key} className={`tt-gate is-${s.st}`}>
                <span className="tt-gate-st">
                  {s.st === "run" ? (
                    <I n="loader-2" className="tt-spin" />
                  ) : s.st === "ok" ? (
                    <I n="check" />
                  ) : s.st === "warn" ? (
                    <I n="alert-triangle" />
                  ) : s.st === "hold" ? (
                    <I n="x" />
                  ) : (
                    <I n={g.icon} />
                  )}
                </span>
                <span className="tt-gate-t">
                  <b>{tr(...g.name)}</b>
                  <small>{s.detail ?? g.idle(pipe, lang)}</small>
                </span>
              </div>
            );
          })}
        </div>
        <Node part="load" icon="table" name={pipe.table} idle={tr("Upsert on key, in one go", "Upsert podle klíče, najednou")} {...at(p, t, "load")} />
        <Node part="alert" icon="bell" name={tr("Alerts", "Upozornění")} idle="Teams · e-mail" {...at(p, t, "alert")} alerting />
        {paths["branch@"] && (
          <span
            className={`tt-trigger is-${wireOf(p, t, EDGES[EDGES.length - 1])}`}
            style={{ left: `${paths["branch@"].split(",")[0]}px`, top: `${paths["branch@"].split(",")[1]}px` }}
            aria-hidden
          >
            <I n="bolt" /> {tr("Trigger: a gate holds", "Spouštěč: brána zastaví")}
          </span>
        )}
      </div>
      {t >= p.end && <Banner p={p} start={start} />}
    </div>
  );
}

/** A part of the pipeline as the app draws one: its icon, its name, a line
 *  of what it did, and a dot on its corner in the colour of how it went. */
function Node({ part, icon, name, idle, st, detail, alerting }: { part: string; icon: string; name: string; idle: string; st: St; detail?: string; alerting?: boolean }) {
  const tr = useT();
  const sent = alerting && st === "warn";
  return (
    <div data-part={part} className={`tt-node is-${sent ? "sent" : st === "ok" || st === "warn" ? "done" : st}`}>
      <span className="tt-node-ic">
        <I n={icon} />
      </span>
      <div className="tt-node-t">
        <b>{name}</b>
        <small>{st === "run" ? tr("Working…", "Pracuje…") : st === "skip" ? tr("Not reached", "Neproběhlo") : (detail ?? idle)}</small>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- the table */

/** An amount as the page's language writes it - display only, the row keeps
 *  its number. */
const cellOf = (lang: Lang, c: Col, v: string | number | undefined) => (typeof v === "number" && c.num ? num(lang, v) : (v ?? ""));

function Landed({ p, t }: { p: Plan; t: number }) {
  const lang = useLang();
  const tr = useT();
  const { pipe } = p;
  // A held run leaves the table as it was: the last good rows, nothing new.
  const kept = p.held !== null && t >= p.end;
  const rows = kept ? rowsFor(pipe, "usual").slice(0, 6) : rowsFor(pipe, p.fixed ? "usual" : p.scn);
  const n = kept ? rows.length : t < p.loadAt ? 0 : Math.min(rows.length, Math.floor((t - p.loadAt) / ROW_GAP) + 1);
  if (n === 0)
    return (
      <div className="tt-empty">
        <I n={t < 0 ? "clock" : "loader-2"} className={t < 0 ? "" : "tt-spin"} />
        {t < 0
          ? tr("The rows arrive here on the next run, from all three sources at once.", "Řádky sem dorazí při příštím běhu, ze všech tří zdrojů najednou.")
          : tr("Reading, then through the gates…", "Načítání, pak přes brány…")}
      </div>
    );
  return (
    <table className="tt-grid">
      <thead>
        <tr>
          <Th type="source" name={tr("Source", "Zdroj")} className="tt-sm-hide" />
          {pipe.heads.map((c) => (
            <Th key={c.k} type={c.type} name={c.name} keyCol={c.key} className={c.num ? "is-num" : c.trunc ? "tt-sm-hide" : ""} />
          ))}
          {p.region && <Th type="text" name={pipe.newCol} className="is-new" />}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, n).map((r, i) => {
          const src = pipe.sources[r.src];
          return (
            <tr key={`${pipe.id}-${i}`} className={`${kept ? "is-kept" : "is-in"}${r.held ? " is-held" : ""}`}>
              <td className="tt-sm-hide">
                <span className="tt-tag">
                  <I n={src.icon} />
                  {src.tag}
                </span>
              </td>
              {pipe.heads.map((c, j) => {
                const v = r.v[c.k];
                const bad = r.held && c.k === pipe.bad.col;
                const neg = typeof v === "number" && v < 0;
                return (
                  <td key={c.k} className={[c.num ? "is-num" : "", c.trunc ? "tt-trunc tt-sm-hide" : "", c.key ? "tt-key-v" : "", bad ? "is-bad" : ""].filter(Boolean).join(" ")}>
                    {c.type === "select" && pipe.id === "inv" && !bad ? <Status v={String(v)} /> : <span className={`tt-v${neg ? " tt-neg" : ""}`}>{cellOf(lang, c, v)}</span>}
                    {j === 0 && r.v.merged && !kept ? (
                      <span className="tt-merged" title={tr("Arrived twice and was kept once", "Přišlo dvakrát, ponecháno jednou")}>
                        <I n="copy" /> {tr("merged", "sloučeno")}
                      </span>
                    ) : null}
                  </td>
                );
              })}
              {p.region && <td className="is-new">{pipe.newVals[i]}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Summary({ p, t, running, done }: { p: Plan; t: number; running: boolean; done: boolean }) {
  const lang = useLang();
  const tr = useT();
  const n = p.pipe.rows.length;
  const rows = (k: number) => count(lang, k, ["row", "rows"], ["řádek", "řádky", "řádků"]);
  if (running)
    return (
      <span>
        <I n="loader-2" className="tt-spin" /> {tr("Running", "Běží")} · {Math.max(1, Math.ceil(t / 1000))} s
      </span>
    );
  if (!done)
    return (
      <span>
        <I n="clock" /> {tr(`Runs ${p.pipe.when}, or Run now`, `Spouští se ${p.pipe.when}, nebo Spustit teď`)}
      </span>
    );
  if (p.held)
    return (
      <span>
        <I n="shield-check" /> <b>{tr("Held by a gate.", "Zastaveno bránou.")}</b>{" "}
        {tr(`${p.pipe.table} keeps the last good rows; the team has an alert.`, `Tabulka ${p.pipe.table} si ponechává poslední dobré řádky; tým dostal upozornění.`)}
      </span>
    );
  return (
    <span className="is-ok">
      <I n="circle-check" /> <b className="is-ok">{tr("Succeeded.", "Hotovo.")}</b>{" "}
      {rowHeld(p)
        ? tr(`${rows(n - 1)} in · 1 held, and an alert sent`, `Nahráno ${rows(n - 1)} · 1 zadržen a odesláno upozornění`)
        : p.fixed
          ? tr(`${rows(n)} in · 1 corrected`, `Nahráno ${rows(n)} · 1 opraven`)
          : tr(`${rows(n)} in · all clear`, `Nahráno ${rows(n)} · vše v pořádku`)}
    </span>
  );
}

/* --------------------------------------------------------------- run log */

function RunLog({ p, t, running, done }: { p: Plan; t: number; running: boolean; done: boolean }) {
  const tr = useT();
  const lines = p.evs.filter((e): e is Extract<Ev, { log: [Level, string] }> => "log" in e && e.at <= t);
  const alert = p.evs.find((e): e is Extract<Ev, { alert: string }> => "alert" in e && e.at <= t);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current?.closest(".tt-side-b");
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: prefersLessMotion() ? "auto" : "smooth" });
  }, [lines.length, alert]);
  const chip = running ? (
    <span className="tt-chip is-sun">
      <I n="loader-2" className="tt-spin" /> {tr("Running", "Běží")}
    </span>
  ) : done ? (
    p.held ? (
      <span className="tt-chip is-err">{tr("Held", "Zastaveno")}</span>
    ) : (
      <span className="tt-chip is-ok">{tr("Succeeded", "Hotovo")}</span>
    )
  ) : (
    <span className="tt-chip">{tr("Waiting", "Čeká")}</span>
  );
  return (
    <Side
      icon={<I n="history" />}
      title={tr("Run log", "Protokol běhu")}
      sub={tr("today", "dnes")}
      right={chip}
      foot={
        <span className="tt-runs is-left" aria-label={tr("The last runs", "Poslední běhy")}>
          {tr("Last runs", "Poslední běhy")}
          <span className="tt-bars">
            {PAST.map((r, k) => (
              <i key={k} className={r.held ? "is-held" : ""} style={{ height: r.h }} />
            ))}
            {done && <i className={`is-new${p.held || (p.scn !== "usual" && !p.fixed) ? " is-held" : ""}`} style={{ height: p.held ? 8 : 14 }} />}
          </span>
        </span>
      }
    >
      <div ref={listRef}>
        {lines.length === 0 ? (
          <p className="tt-note tt-log-empty">
            {tr("Every run writes down what it did, step by step. Read it here as it happens.", "Každý běh krok za krokem zapisuje, co udělal. Tady to uvidíte živě.")}
          </p>
        ) : (
          <ol className="tt-log">
            {lines.map((e, i) => (
              <li key={i} className={`is-${e.log[0]}`}>
                <time>{clock(e.at)}</time>
                <I n={e.log[0] === "error" ? "circle-x" : e.log[0] === "warn" ? "alert-triangle" : e.log[0] === "ok" ? "circle-check" : "info-circle"} />
                <span>{e.log[1]}</span>
              </li>
            ))}
          </ol>
        )}
        {alert && (
          <div className="tt-alert">
            <span className="tt-alert-h">
              <I n="brand-teams" /> Teams · #finance <time>{clock(alert.at)}</time>
            </span>
            <p>
              <b>appolino</b> {alert.alert}
            </p>
            <span className="tt-alert-l">
              {tr("Open the run", "Otevřít běh")} <I n="arrow-right" />
            </span>
          </div>
        )}
      </div>
    </Side>
  );
}

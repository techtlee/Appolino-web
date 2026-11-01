import { Fragment, useState } from "react";
import { readBool, readDate, readNumber } from "../czech";
import { count, day, num, pageLang, useLang, useT, whole, type Lang } from "../i18n";
import { I, Side, Th } from "./kit";

/**
 * Transform, inside Tables (owner, 2026-11-01: Tables and Transform are one tab): the table
 * being filled in is the one the steps build on, so an edit made in the grid shows in the
 * result the next time it is looked at - the result rebuilds itself from its table. Steps
 * anyone can read, one click each: the ČNB rate on the plan's due date looked up from the
 * exchange rates, the region's target from the targets, the plan in euros, its share of the
 * target, only the approved plans, the largest first, a total by region, a pivot of months by
 * region. Every step can be added at any time: one that needs another brings it, one added
 * after a total or a pivot goes before it; taking one out takes what needs it along; the SQL
 * is one switch away; saved, the steps are a result table. The rates are example ČNB rates;
 * the targets are invented.
 *
 * Every name a visitor reads - a step, a column, a table - is in the page's language. What a
 * step looks things up by - a region, a column's key - is not: Prague and Praha are one
 * region, so a target or a store is found whichever language the plan was written in.
 */

export type StepId = "rate" | "target" | "stores" | "eur" | "share" | "running" | "approved" | "sort" | "group" | "pivot";
type Val = string | number;
export type RRow = Record<string, Val>;
export type RCol = { key: string; name: string; type: string; num?: boolean };
type Group = "Combine" | "Calculate" | "Shape";
type Words = { name: string; sub: string; formula?: string };

/** The steps, as the app's builders make them (bdop's product specification, Transform):
 *  Combine looks up one match or joins every pairing; Calculate writes a `[Column]` formula,
 *  window functions included, shown under its name as typed - with the columns' names in the
 *  page's language, as a team writing in it would see them. */
const STEP: Record<StepId, { group: Group; icon: string; needs?: StepId; en: Words; cs: Words }> = {
  rate: {
    group: "Combine",
    icon: "arrows-join",
    en: { name: "Add the ČNB rate on Due", sub: "Lookup in ČNB exchange rates, on or before Due" },
    cs: { name: "Přidat kurz ČNB k termínu", sub: "Vyhledá kurz v tabulce Kurzy ČNB k termínu nebo dříve" },
  },
  target: {
    group: "Combine",
    icon: "users",
    en: { name: "Add the region's target", sub: "Lookup in Targets 2026 by Region" },
    cs: { name: "Přidat cíl regionu", sub: "Vyhledá cíl v tabulce Cíle 2026 podle regionu" },
  },
  stores: {
    group: "Combine",
    icon: "link",
    en: { name: "Join Stores on Region", sub: "Every pairing: a row for each store in the region" },
    cs: { name: "Spojit s tabulkou Prodejny podle regionu", sub: "Všechny dvojice: řádek pro každou prodejnu v regionu" },
  },
  eur: {
    group: "Calculate",
    icon: "currency-euro",
    needs: "rate",
    en: { name: "Plan in EUR", sub: "A formula", formula: "ROUND([Plan (CZK)] / [Rate], 2)" },
    cs: { name: "Plán v EUR", sub: "Vzorec", formula: "ROUND([Plán (Kč)] / [Kurz], 2)" },
  },
  share: {
    group: "Calculate",
    icon: "percentage",
    needs: "target",
    en: { name: "Share of the target", sub: "A formula", formula: "ROUND(100 * [Plan (CZK)] / [Target], 1)" },
    cs: { name: "Podíl na cíli", sub: "Vzorec", formula: "ROUND(100 * [Plán (Kč)] / [Cíl], 1)" },
  },
  running: {
    group: "Calculate",
    icon: "math-function",
    en: { name: "Running plan by region", sub: "A window formula", formula: "SUM([Plan (CZK)]) OVER (PARTITION BY [Region] ORDER BY [Due])" },
    cs: { name: "Průběžný plán po regionech", sub: "Okenní vzorec", formula: "SUM([Plán (Kč)]) OVER (PARTITION BY [Region] ORDER BY [Termín])" },
  },
  approved: {
    group: "Shape",
    icon: "filter",
    en: { name: "Only approved plans", sub: "Filter rows on Approved = Yes" },
    cs: { name: "Jen schválené plány", sub: "Filtr řádků: Schváleno = ANO" },
  },
  sort: {
    group: "Shape",
    icon: "sort-descending",
    en: { name: "Largest plan first", sub: "Sort rows by Plan, high to low" },
    cs: { name: "Největší plán nahoře", sub: "Seřadí řádky podle plánu sestupně" },
  },
  group: {
    group: "Shape",
    icon: "sum",
    en: { name: "Total by region", sub: "Group by Region: count and sums" },
    cs: { name: "Součet po regionech", sub: "Seskupení podle regionu: počet a součty" },
  },
  pivot: {
    group: "Shape",
    icon: "columns-3",
    en: { name: "Pivot: months by region", sub: "Months down, regions across, the plan summed" },
    cs: { name: "Kontingenční tabulka", sub: "Měsíce v řádcích, regiony ve sloupcích, součet plánu" },
  },
};
/** The order the tiles stand in; Shape leads with the pivot (owner, 2026-11-01: "Transform more
 *  like Shape - pivot, calculate - every option possible to act on"). */
const ORDER: StepId[] = ["rate", "target", "stores", "eur", "share", "running", "pivot", "group", "approved", "sort"];
/** Steps that give the result a new shape - a total, a pivot. One at a time, and always last:
 *  what works on rows goes before it. */
const FINAL = new Set<StepId>(["group", "pivot"]);
const GROUPS: Record<Group, [string, string]> = { Combine: ["Combine", "Spojit"], Calculate: ["Calculate", "Vypočítat"], Shape: ["Shape", "Upravit"] };
const words = (lang: Lang, id: StepId) => STEP[id][lang];

/** The tables, by the name each language gives them. */
const TABLES: Record<"plan" | "rates" | "targets" | "stores", [string, string]> = {
  plan: ["Sales plan 2026", "Plán prodeje 2026"],
  rates: ["ČNB exchange rates", "Kurzy ČNB"],
  targets: ["Targets 2026", "Cíle 2026"],
  stores: ["Stores", "Prodejny"],
};
export const tableName = (lang: Lang, k: keyof typeof TABLES) => TABLES[k][lang === "cs" ? 1 : 0];

/** The columns' names; their keys are the same in either language. */
const COLS: Record<string, [string, string]> = {
  product: ["Product", "Produkt"],
  region: ["Region", "Region"],
  plan: ["Plan (CZK)", "Plán (Kč)"],
  due: ["Due", "Termín"],
  approved: ["Approved", "Schváleno"],
  rate: ["Rate", "Kurz"],
  target: ["Target", "Cíl"],
  store: ["Store", "Prodejna"],
  running: ["Running", "Průběžný součet"],
  eur: ["EUR", "EUR"],
  share: ["Share", "Podíl"],
  n: ["Plans", "Počet plánů"],
  month: ["Month", "Měsíc"],
  total: ["Total", "Celkem"],
};

/** Where a region is looked up, whichever language its name is written in. */
const REGION: Record<string, string> = { Praha: "praha", Prague: "praha", Brno: "brno", Ostrava: "ostrava" };
const regionKey = (v: Val) => REGION[String(v)] ?? String(v);

/** Stores: the stores in each region, for the join that makes a row per store. */
const STORES: Record<string, Record<Lang, string[]>> = {
  praha: { en: ["Prague Anděl", "Prague Karlín"], cs: ["Praha Anděl", "Praha Karlín"] },
  brno: { en: ["Brno Centre"], cs: ["Brno Centrum"] },
  ostrava: { en: ["Ostrava Karolina"], cs: ["Ostrava Karolina"] },
};

/** ČNB exchange rates: a rate holds from its date until the next; a Saturday takes Friday's. */
const RATES: [string, number][] = [
  ["2026-01-30", 24.32],
  ["2026-02-27", 24.26],
  ["2026-03-31", 24.18],
  ["2026-04-30", 24.11],
];
const rateOn = (d: string) => [...RATES].reverse().find(([from]) => from <= d)?.[1] ?? RATES[0][1];
/** Targets 2026: each region's plan target for the year. */
const TARGETS: Record<string, number> = { praha: 300000, brno: 120000, ostrava: 100000 };

/** A figure as the page's language writes it. readNumber reads the Czech way first, and to it
 *  "120,000" is 120 with a decimal comma; in English a comma between groups of three marks the
 *  thousands, so there such a figure is read that way first. Anything else is read as
 *  readNumber reads it, so a Czech figure typed on the English page still counts. */
export function readFigure(lang: Lang, raw: string): number | null {
  const s = raw.trim();
  if (lang === "en" && /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
  return readNumber(s);
}

/** Where a new step goes, so that every tile can be pressed (owner, 2026-11-01: "all options in
 *  the demo should be possible to act on"): a step that needs another brings it along, a step
 *  that works on rows goes in before a total or a pivot, and a total and a pivot replace each
 *  other. The note says which of these happened, or is null when none did. */
function place(lang: Lang, steps: StepId[], id: StepId): { next: StepId[]; note: string | null } {
  const tr = (en: string, cs: string) => (lang === "cs" ? cs : en);
  const nm = (x: StepId) => words(lang, x).name;
  const notes: string[] = [];
  const was = FINAL.has(id) ? steps.find((x) => FINAL.has(x)) : undefined;
  if (was) notes.push(tr(`It replaced “${nm(was)}”.`, `Nahradil krok „${nm(was)}“.`));
  const kept = steps.filter((x) => x !== was);
  const rows = kept.filter((x) => !FINAL.has(x));
  const end = kept.filter((x) => FINAL.has(x));
  const need = STEP[id].needs;
  const brought = need && !kept.includes(need) ? [need] : [];
  if (need && brought.length) notes.push(tr(`“${nm(need)}” came with it, as it needs it.`, `Přibyl i krok „${nm(need)}“, který potřebuje.`));
  if (!FINAL.has(id) && end.length) notes.push(tr(`Put before “${nm(end[0])}”, which shapes the result last.`, `Zařazeno před krok „${nm(end[0])}“, který výsledek tvaruje naposled.`));
  const next = FINAL.has(id) ? [...rows, ...brought, id] : [...rows, ...brought, id, ...end];
  return { next, note: notes.length ? notes.join(" ") : null };
}

/** The plan summed by month and region: a row a month, a column a region in the order the
 *  table first names them, and the month's total. A region with no plan that month is empty; a
 *  row with no date comes last. With Plan in EUR among the steps before it, it sums the euros,
 *  so that step shows in what it makes. */
function pivot(rows: RRow[], nm: (key: string) => string, eur: boolean): { cols: RCol[]; rows: RRow[] } {
  const by = eur ? "eur" : "plan";
  const regions = [...new Set(rows.map((r) => String(r.region || "—")))];
  const months = new Map<string, RRow>();
  rows.forEach((r) => {
    const m = String(r.due).slice(0, 7) || "—";
    const k = `pv:${regionKey(r.region)}`;
    const g = months.get(m) ?? { month: m, total: 0 };
    const v = Number(r[by] ?? 0);
    months.set(m, { ...g, [k]: Math.round((Number(g[k] ?? 0) + v) * 100) / 100, total: Math.round((Number(g.total) + v) * 100) / 100 });
  });
  const last = (m: Val) => (m === "—" ? "~" : String(m));
  return {
    cols: [
      { key: "month", name: nm("month"), type: "date" },
      ...regions.map((x) => ({ key: `pv:${regionKey(x)}`, name: eur ? `${x} (EUR)` : x, type: "decimal", num: true })),
      { key: "total", name: eur ? `${nm("total")} (EUR)` : nm("total"), type: "decimal", num: true },
    ],
    rows: [...months.values()].sort((a, b) => last(a.month).localeCompare(last(b.month))),
  };
}

/** Runs the steps on the table as it is now, each on what the one before made. */
export function runSteps(table: { v: Record<string, string> }[], steps: StepId[], lang: Lang = pageLang()): { cols: RCol[]; rows: RRow[] } {
  const nm = (key: string) => COLS[key][lang === "cs" ? 1 : 0];
  let cols: RCol[] = [
    { key: "product", name: nm("product"), type: "text" },
    { key: "region", name: nm("region"), type: "text" },
    { key: "plan", name: nm("plan"), type: "decimal", num: true },
    { key: "due", name: nm("due"), type: "date" },
    { key: "approved", name: nm("approved"), type: "bool" },
  ];
  let rows: RRow[] = table.map((r) => ({
    product: r.v.product ?? "",
    region: r.v.region ?? "",
    plan: readFigure(lang, r.v.plan ?? "") ?? 0,
    due: readDate(r.v.due ?? "") ?? "",
    approved: r.v.approved ?? "",
  }));
  const add = (c: RCol, f: (r: RRow) => Val) => {
    cols = [...cols, c];
    rows = rows.map((r) => ({ ...r, [c.key]: f(r) }));
  };
  for (const s of steps) {
    if (s === "rate") add({ key: "rate", name: nm("rate"), type: "decimal", num: true }, (r) => rateOn(String(r.due)));
    else if (s === "target") add({ key: "target", name: nm("target"), type: "decimal", num: true }, (r) => TARGETS[regionKey(r.region)] ?? 0);
    else if (s === "stores") {
      cols = [...cols, { key: "store", name: nm("store"), type: "text" }];
      rows = rows.flatMap((r) => (STORES[regionKey(r.region)]?.[lang] ?? ["—"]).map((store) => ({ ...r, store })));
    } else if (s === "running") {
      // The plan summed down each region in date order, each row carrying the total so far.
      const order = rows.map((r, i) => ({ r, i })).sort((a, b) => String(a.r.region).localeCompare(String(b.r.region)) || String(a.r.due).localeCompare(String(b.r.due)) || a.i - b.i);
      const run = new Array<number>(rows.length);
      let region = "";
      let sum = 0;
      for (const { r, i } of order) {
        if (r.region !== region) [region, sum] = [String(r.region), 0];
        sum += Number(r.plan);
        run[i] = sum;
      }
      add({ key: "running", name: nm("running"), type: "decimal", num: true }, (r) => run[rows.indexOf(r)]);
    }
    else if (s === "eur") add({ key: "eur", name: nm("eur"), type: "decimal", num: true }, (r) => Math.round((Number(r.plan) / Number(r.rate)) * 100) / 100);
    else if (s === "share") add({ key: "share", name: nm("share"), type: "percent", num: true }, (r) => (Number(r.target) ? Math.round((Number(r.plan) / Number(r.target)) * 1000) / 10 : 0));
    else if (s === "approved") rows = rows.filter((r) => readBool(String(r.approved)) === true);
    else if (s === "sort") rows = [...rows].sort((a, b) => Number(b.plan) - Number(a.plan));
    else if (s === "pivot") ({ cols, rows } = pivot(rows, nm, cols.some((c) => c.key === "eur")));
    else {
      const eur = cols.some((c) => c.key === "eur");
      const by = new Map<string, RRow>();
      rows.forEach((r) => {
        const k = String(r.region || "—");
        const g = by.get(k) ?? { region: k, n: 0, plan: 0, eur: 0 };
        by.set(k, { ...g, n: Number(g.n) + 1, plan: Number(g.plan) + Number(r.plan), eur: Math.round((Number(g.eur) + Number(r.eur ?? 0)) * 100) / 100 });
      });
      cols = [
        { key: "region", name: nm("region"), type: "text" },
        { key: "n", name: nm("n"), type: "integer", num: true },
        { key: "plan", name: nm("plan"), type: "decimal", num: true },
        ...(eur ? [{ key: "eur", name: nm("eur"), type: "decimal", num: true }] : []),
      ];
      rows = [...by.values()].sort((a, b) => Number(b.plan) - Number(a.plan));
    }
  }
  return { cols, rows };
}

/** The SQL the steps are written to, one common table expression a step. Its identifiers are
 *  English in either language; the tables it reads are named as the page names them. */
function sql(lang: Lang, steps: StepId[]): string {
  const ref = (k: keyof typeof TABLES) => `{{ dataset("${tableName(lang, k)}") }}`;
  const src = ref("plan");
  // The rate table's own columns, as each language's team would have named them.
  const [kurz, datum] = lang === "cs" ? ["kurz", "datum"] : ["czk_per_eur", "valid_from"];
  if (!steps.length) return `select * from ${src}`;
  const parts = steps.map((s, i) => {
    const prev = i === 0 ? src : `s${i}`;
    const body =
      s === "rate"
        ? `select t.*, k.${kurz} as rate\n  from ${prev} t\n  left join lateral (\n    select ${kurz} from ${ref("rates")}\n    where ${datum} <= t.due\n    order by ${datum} desc limit 1\n  ) k on true`
        : s === "target"
          ? `select t.*, c.target\n  from ${prev} t\n  left join ${ref("targets")} c\n    on c.region = t.region`
          : s === "stores"
            ? `select t.*, p.store\n  from ${prev} t\n  join ${ref("stores")} p\n    on p.region = t.region`
          : s === "running"
            ? `select *, sum(plan) over (\n    partition by region order by due\n  ) as running\n  from ${prev}`
          : s === "eur"
            ? `select *, round(plan / nullif(rate, 0), 2) as eur\n  from ${prev}`
            : s === "share"
              ? `select *, round(100 * plan / nullif(target, 0), 1) as share\n  from ${prev}`
              : s === "approved"
                ? `select * from ${prev}\n  where approved`
                : s === "sort"
                  ? `select * from ${prev}\n  order by plan desc`
                  : s === "pivot"
                    ? ((v) =>
                        `select to_char(due, 'YYYY-MM') as month,\n${PIVOT_REGIONS[lang].map((r) => `    sum(${v}) filter (where region = '${r}') as ${regionKey(r)},`).join("\n")}\n    sum(${v}) as total\n  from ${prev} group by 1 order by 1`)(steps.slice(0, i).includes("eur") ? "eur" : "plan")
                    : `select region, count(*) as plans,\n    sum(plan) as plan${steps.slice(0, i).includes("eur") ? ", sum(eur) as eur" : ""}\n  from ${prev} group by region`;
    return `s${i + 1} as (\n  ${body}\n)`;
  });
  return `with ${parts.join(",\n")}\nselect * from s${steps.length}`;
}

/** The regions the pivot's SQL names a column for - the plan's own, in each language. */
const PIVOT_REGIONS: Record<Lang, string[]> = { en: ["Prague", "Brno", "Ostrava"], cs: ["Praha", "Brno", "Ostrava"] };

const KEYWORDS = new Set(["with", "as", "select", "from", "left", "join", "lateral", "on", "true", "where", "order", "by", "desc", "limit", "group", "round", "nullif", "count", "sum", "over", "partition", "filter"]);

/** The SQL with its keywords set darker and its table references in amber. */
function Sql({ text }: { text: string }) {
  const parts = text.split(/(\{\{[^}]+\}\}|\b[a-z]+\b)/g);
  return (
    <pre className="tt-sql">
      {parts.map((p, i) =>
        p.startsWith("{{") ? (
          <span key={i} className="ref">
            {p}
          </span>
        ) : KEYWORDS.has(p) ? (
          <span key={i} className="kw">
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </pre>
  );
}

/** A result value as the page's language writes it: 24,32 and 31. 1. 2026 in Czech, 24.32 and
 *  31 Jan 2026 in English. Only the display changes; the values the steps work on do not. */
const show = (lang: Lang, c: RCol, v: Val | undefined) => {
  if (v === undefined || v === "") return "";
  if (c.key === "rate") return num(lang, Number(v));
  if (c.key === "n") return whole(lang, Number(v));
  if (c.key === "share") {
    const p = num(lang, Number(v), Number.isInteger(Number(v)) ? 0 : 1);
    return lang === "cs" ? `${p} %` : `${p}%`;
  }
  if (c.key === "due") return day(lang, String(v));
  // A pivot's month, "2026-01", as "Jan 2026" or "leden 2026".
  if (c.key === "month" && /^\d{4}-\d{2}$/.test(String(v)))
    return new Date(`${v}-01T12:00:00`).toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-GB", { month: lang === "cs" ? "long" : "short", year: "numeric" });
  return c.num ? num(lang, Number(v)) : String(v);
};

export const nameFor = (steps: StepId[], lang: Lang = pageLang()) => {
  const t = (en: string, cs: string) => (lang === "cs" ? cs : en);
  return steps.includes("pivot")
    ? t("Plan by month and region", "Plán po měsících a regionech")
    : steps.includes("group")
    ? t("Plan by region", "Plán po regionech")
    : steps.includes("eur")
      ? t("Plan in EUR", "Plán v EUR")
      : steps.includes("share")
        ? t("Plan against targets", "Plán proti cílům")
        : t("Plan, adjusted", "Plán, upravený");
};

/** The tables a result is built from: the plan, and each table a lookup reads. */
const inputsOf = (lang: Lang, steps: StepId[]) => [
  tableName(lang, "plan"),
  ...(steps.includes("rate") ? [tableName(lang, "rates")] : []),
  ...(steps.includes("target") ? [tableName(lang, "targets")] : []),
  ...(steps.includes("stores") ? [tableName(lang, "stores")] : []),
];

/** The result the steps make, read-only: the columns the last step added glow in. */
export function ResultGrid({ table, steps, saved }: { table: { v: Record<string, string> }[]; steps: StepId[]; saved: string | null }) {
  const lang = useLang();
  const t = useT();
  const { cols, rows } = runSteps(table, steps, lang);
  const last = steps[steps.length - 1];
  const before = runSteps(table, steps.slice(0, -1), lang).cols.map((c) => c.key);
  const fresh = (c: RCol) => !saved && !!last && !FINAL.has(last) && !before.includes(c.key);
  // On a phone a row of the result keeps its product, its plan and what the steps added, as the
  // table does there; a total by region keeps its region, which is then what a row is.
  const perProduct = cols.some((c) => c.key === "product");
  const sm = (c: RCol) => (c.key === "due" || c.key === "approved" || (perProduct && c.key === "region") ? " tt-sm-hide" : "");
  return (
    <table className="tt-grid" key={steps.join("-")}>
      <thead>
        <tr>
          <th className="tt-rn" aria-label={t("Row", "Řádek")} />
          {cols.map((c) => (
            <Th key={c.key} type={c.type === "percent" ? "decimal" : c.type} name={c.name} className={`${c.num ? "is-num" : ""}${fresh(c) ? " is-new" : ""}${sm(c)}`} />
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${String(r.product ?? r.region ?? r.month)}-${i}`}>
            <td className="tt-rn">{i + 1}</td>
            {cols.map((c) => (
              <td key={c.key} className={`${c.num ? "is-num" : ""}${sm(c)}${fresh(c) ? " is-new" : ""}`} style={fresh(c) ? { animationDelay: `${i * 0.05}s` } : undefined}>
                {show(lang, c, r[c.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The steps beside the table: what the result is built from, the steps in order with their
 *  undo, the ones that can still be added by kind, the SQL, and Save as result table. */
export function StepsPanel({
  table,
  steps,
  setSteps,
  view,
  setView,
  saved,
  setSaved,
  note,
  setNote,
  close,
}: {
  table: { v: Record<string, string> }[];
  steps: StepId[];
  setSteps: (f: (s: StepId[]) => StepId[]) => void;
  view: "steps" | "sql";
  setView: (v: "steps" | "sql") => void;
  saved: string | null;
  setSaved: (s: string | null) => void;
  note: string | null;
  setNote: (s: string | null) => void;
  close: () => void;
}) {
  const lang = useLang();
  const t = useT();
  const name = (id: StepId) => words(lang, id).name;
  const left = ORDER.filter((id) => !steps.includes(id));
  // Shape is open first, the pivot leading it: the step a visitor most wants to see done.
  const [kindPicked, setKind] = useState<Group>("Shape");
  // The kind shown is the one picked while it still has a step to add, else the first that has.
  const kind = left.some((id) => STEP[id].group === kindPicked) ? kindPicked : ((["Shape", "Calculate", "Combine"] as Group[]).find((g) => left.some((id) => STEP[id].group === g)) ?? "Shape");
  const add = (id: StepId) => {
    const { next, note: why } = place(lang, steps, id);
    setSteps(() => next);
    setNote(why);
    setView("steps");
  };
  const remove = (id: StepId) => {
    const out = new Set<StepId>([id]);
    ORDER.forEach((s) => STEP[s].needs && out.has(STEP[s].needs!) && out.add(s));
    setSteps((s) => s.filter((x) => !out.has(x)));
    const took = [...out].filter((x) => x !== id && steps.includes(x));
    setNote(
      took.length
        ? t(
            `${took.map(name).join(" and ")} went with it, as ${took.length > 1 ? "they need" : "it needs"} it; the rest were replayed.`,
            `${took.length > 1 ? "Spolu s ním zmizely i kroky" : "Spolu s ním zmizel i krok"} ${took.map((x) => `„${name(x)}“`).join(" a ")}, ${took.length > 1 ? "protože ho potřebují" : "protože ho potřebuje"}; ostatní kroky proběhly znovu.`,
          )
        : t("Taken out; the steps after it were replayed.", "Krok je odebraný; kroky za ním proběhly znovu."),
    );
  };
  const n = runSteps(table, steps, lang).rows.length;
  const right = (
    <>
      <span className="tt-seg" role="radiogroup" aria-label={t("Show", "Zobrazit")}>
        {(["steps", "sql"] as const).map((v) => (
          <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)}>
            {v === "steps" ? t("Steps", "Kroky") : "SQL"}
          </button>
        ))}
      </span>
      <button className="tt-btn is-icon is-sm" aria-label={t("Close", "Zavřít")} title={t("Close", "Zavřít")} onClick={close}>
        <I n="x" />
      </button>
    </>
  );
  const foot = saved ? (
    <>
      <span className="tt-chip is-ok">
        <I n="circle-check" /> {t("Saved as", "Uloženo jako")} {saved}
      </span>
      <button className="tt-link" onClick={() => (setSteps(() => []), setSaved(null), setNote(null))}>
        {t("Start over", "Začít znovu")}
      </button>
    </>
  ) : steps.length ? (
    <>
      <button className="tt-btn is-primary is-sm" onClick={() => setSaved(nameFor(steps, lang))}>
        <I n="device-floppy" /> {t("Save as result table", "Uložit jako výslednou tabulku")}
      </button>
      <span className="tt-note">
        {count(lang, n, ["row", "rows"], ["řádek", "řádky", "řádků"])} · {t("a preview", "náhled")}
      </span>
    </>
  ) : (
    <span className="tt-note">{t("Each step is one anyone can read; the SQL is written for you.", "Každému kroku porozumí kdokoli; SQL se napíše samo.")}</span>
  );

  return (
    <Side icon={<I n="stack-2" />} title={t("Transform", "Transformace")} right={right} foot={foot}>
      <div className="tt-lineage" aria-label={t("Built from", "Vzniká z")}>
        {inputsOf(lang, steps).map((x, i) => (
          <Fragment key={x}>
            {i > 0 && <span className="tt-lin-plus">+</span>}
            <span className="tt-lin-t">
              <I n="table" /> {x}
            </span>
          </Fragment>
        ))}
        <I n="arrow-narrow-right" className="tt-lin-arrow" />
        <span className={`tt-lin-t is-out${saved ? " is-saved" : ""}`}>
          <I n="code" /> {saved ?? (steps.length ? nameFor(steps, lang) : t("result", "výsledek"))}
        </span>
      </div>
      {view === "sql" ? (
        <Sql text={sql(lang, steps)} />
      ) : (
        <>
          {/* The recipe: the source, then each step a card on one line down from it - its number
              on the line, its kind, its name and what it does, a formula as typed. Built by hand
              as in the app, and laid out to be read at a glance (owner, 2026-11-01:
              "manual, but presentable, stunning and easy for customers"). */}
          <ol className="tt-recipe">
            <li className="is-src">
              <span className="tt-rc-node">
                <I n="table" />
              </span>
              <div className="tt-rc-card">
                <span className="tt-rc-t">
                  <em>{t("Source", "Zdroj")}</em>
                  <b>{tableName(lang, "plan")}</b>
                  <small>{t("This table, as it is now, edits included", "Tato tabulka, jak je teď, včetně úprav")}</small>
                </span>
              </div>
            </li>
            {steps.map((id, i) => (
              <li key={id}>
                <span className="tt-rc-node">{i + 1}</span>
                <div className="tt-rc-card">
                  <span className="tt-rc-ic">
                    <I n={STEP[id].icon} />
                  </span>
                  <span className="tt-rc-t">
                    <em>{t(...GROUPS[STEP[id].group])}</em>
                    <b>{name(id)}</b>
                    {words(lang, id).formula ? <code className="tt-formula">{words(lang, id).formula}</code> : <small>{words(lang, id).sub}</small>}
                  </span>
                  {!saved && (
                    <button className="tt-x" aria-label={t(`Remove ${name(id)}`, `Odebrat krok ${name(id)}`)} onClick={() => remove(id)}>
                      <I n="x" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {note && <p className="tt-note tt-steps-note">{note}</p>}
          {saved ? (
            <div className="tt-saved">
              <b>
                <I n="circle-check" /> {t("Saved as", "Uloženo jako")} {saved}
              </b>
              <span>
                {t(
                  `A real table in the project. It rebuilds itself when ${tableName(lang, "plan")} changes, and the rules run after every build.`,
                  `Skutečná tabulka v projektu. Sestaví se znovu, kdykoli se změní tabulka ${tableName(lang, "plan")}, a po každém sestavení se spustí pravidla.`,
                )}
              </span>
            </div>
          ) : (
            left.length > 0 && (
              // Adding a step: the three kinds as one switch, the chosen kind's steps as tiles,
              // every one of them pressable (place puts it where it can run).
              <div className="tt-addbox">
                <div className="tt-addbox-h">
                  <b>
                    <I n="plus" /> {t("Add a step", "Přidat krok")}
                  </b>
                  <span className="tt-seg is-kinds" role="radiogroup" aria-label={t("Kind of step", "Druh kroku")}>
                    {(["Shape", "Calculate", "Combine"] as Group[]).map((g) => (
                      <button key={g} role="radio" aria-checked={kind === g} onClick={() => setKind(g)} disabled={!left.some((id) => STEP[id].group === g)}>
                        {t(...GROUPS[g])}
                      </button>
                    ))}
                  </span>
                </div>
                <div className="tt-tiles">
                  {left
                    .filter((id) => STEP[id].group === kind)
                    .map((id) => {
                      const w = words(lang, id);
                      return (
                        <button key={id} className={`tt-tile${!steps.length && id === "pivot" ? " is-nudge" : ""}`} onClick={() => add(id)}>
                          <span className="tt-tile-ic">
                            <I n={STEP[id].icon} />
                          </span>
                          <span className="tt-tile-t">
                            <b>{w.name}</b>
                            {w.formula ? <code className="tt-formula">{w.formula}</code> : <small>{w.sub}</small>}
                          </span>
                          <span className="tt-tile-plus" aria-hidden>
                            <I n="plus" />
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )
          )}
        </>
      )}
    </Side>
  );
}

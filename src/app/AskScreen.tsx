import { useEffect, useRef, useState, type FormEvent, type MutableRefObject, type ReactNode, type RefObject } from "react";
// The assistant's avatar: the logo's mark in its navy (the same file as the tab icon).
import logo from "../assets/appolino-mark.svg";
import { fold, mask, readNumber } from "../czech";
import { count, num, useLang, useT, type Lang } from "../i18n";
import { prefersLessMotion, useSeen } from "../motion";
import { useCycle } from "./cycle";
import { EditCell, Head, I, Side, Th } from "./kit";

/**
 * ✦ Ask as a conversation beside the table, in its three kinds of help, as
 * the app offers them. Clean changes cells of this table; Validate adds a
 * rule that runs on every import; Transform adds a column or builds a new
 * table from this one. Switching the kind shows how it works on the table
 * itself: the cells Clean could fix, the value no rule catches yet, the
 * place a new column would go. A sentence in Czech or English comes back as
 * a draft with what it would change, and nothing changes until Apply; then
 * appolino edits the cells in front of you, and Undo puts them back. A rule
 * that finds something offers its fix. Every question shows what left
 * appolino - column names, types and the shape of a value, never the value.
 * It does not answer questions about the data, and says so. Any cell can be
 * edited by hand as well. The answers are prepared; the companies are
 * invented.
 *
 * Until the visitor takes over, the screen plays that conversation by itself,
 * over and over (owner: "there should always be some kind of loop playing in
 * all tabs"): see useAutoplay.
 *
 * The screen speaks the page's language and shows its values that language's
 * way; a typed sentence is understood in either, whichever the page is in,
 * because a Czech team asks in both.
 */

type Row = { id: number; no: string; customer: string; city: string; amount: string };
type Col = Exclude<keyof Row, "id">;

/** The invoices, with the city as each language writes it. Czech keeps the values as a Czech
 *  team types them; English writes the amounts the English way and Praha as Prague, in the
 *  same four spellings, so the clean-up finds the same three cells in either. The companies
 *  keep their Czech names in both: they are Czech businesses. */
const INVOICES: [no: string, customer: string, cityCs: string, cityEn: string, amountCs: string][] = [
  ["FV-2026-101", "Pekárna U Mlýna s.r.o.", "Praha", "Prague", "12 840,00"],
  ["FV-2026-102", "Zahradnictví Hájek", "PRAHA", "PRAGUE", "5 699,00"],
  ["FV-2026-104", "Truhlářství Novák", "Brno", "Brno", "6 000,00"],
  ["FV-2026-105", "Kavárna Na Rohu", "praha", "prague", "845,00"],
  ["FV-2026-106", "Elektro Svoboda a.s.", "Ostrava", "Ostrava", "3 120,50"],
  ["FV-2026-107", "Moravská vinotéka", "Praha ", "Prague ", "2 410,00"],
  ["FV-2026-108", "Pekárna U Mlýna s.r.o.", "Praha", "Prague", "-1 230,00"],
];
/** Zákazníci (Customers), the project's customer table: where Transform's lookup finds a
 *  region, named in Czech and in English. */
const REGIONS: [customer: string, cs: string, en: string][] = [
  ["Pekárna U Mlýna s.r.o.", "Praha", "Prague"],
  ["Zahradnictví Hájek", "Jihomoravský", "South Moravian"],
  ["Truhlářství Novák", "Jihomoravský", "South Moravian"],
  ["Kavárna Na Rohu", "Praha", "Prague"],
  ["Elektro Svoboda a.s.", "Moravskoslezský", "Moravian-Silesian"],
  ["Moravská vinotéka", "Jihomoravský", "South Moravian"],
];

type Effect = "city" | "sign" | "rule" | "unique" | "share" | "region" | "rank" | "running" | "pivot";
type Mode = "clean" | "validate" | "transform";
/** `q` is the sentence offered in the page's language; `qs` holds it in both, so a sentence
 *  copied from the other language is still taken at its word. */
type Intent = { id: Effect; mode: Mode; q: string; qs: string[]; match: RegExp; kind: string; title: string; reply: string; done: string };

/** Everything the screen writes as a word or shows as a value, in one language. */
type Demo = {
  table: string;
  customers: string;
  amount: string;
  invoiceNo: string;
  /** The one spelling of the capital the clean-up writes. */
  city: string;
  start: Row[];
  cols: [Col, string, string][];
  region: Map<string, string>;
  noRegion: string;
  modes: { id: Mode; label: string; lead: string; placeholder: string }[];
  intents: Intent[];
  /** The intents in the order a typed sentence is tried against them. */
  search: Intent[];
  sql: Partial<Record<Effect, string>>;
  sent: { col: string; type: string; v: string }[];
};

function demo(lang: Lang): Demo {
  const t = <V,>(en: V, cs: V): V => (lang === "cs" ? cs : en);
  const table = t("Invoices", "Faktury");
  const customers = t("Customers", "Zákazníci");
  const amount = t("Amount (CZK)", "Částka (Kč)");
  const invoiceNo = t("Invoice no.", "Číslo faktury");
  const city = t("Prague", "Praha");
  const sentence = (en: string, cs: string) => ({ q: t(en, cs), qs: [en, cs] });
  const kind = {
    clean: t("Draft fix · Clean", "Návrh opravy · Čištění"),
    validate: t("Draft rule · Validate", "Návrh pravidla · Validace"),
    transform: t("Draft step · Transform", "Návrh kroku · Transformace"),
  };

  /** Ask's three kinds of help: what each does, and the sentence its box asks for. */
  const modes: Demo["modes"] = [
    {
      id: "clean",
      label: t("Clean", "Čištění"),
      lead: t(
        "changes cells of this table: one spelling, fixed values, no duplicates. Underlined: what it could fix.",
        "mění buňky této tabulky: jednotný zápis, opravené hodnoty, žádné duplicity. Podtržené: co může opravit.",
      ),
      placeholder: t("Say what to fix…", "Napište, co opravit…"),
    },
    {
      id: "validate",
      label: t("Validate", "Validace"),
      lead: t(
        "adds a rule that runs on every import and holds a pipeline when it fails. Outlined: what no rule catches yet.",
        "přidá pravidlo, které běží při každém importu, a když neprojde, zadrží pipeline. Orámované: co zatím žádné pravidlo nezachytí.",
      ),
      placeholder: t("Describe a rule…", "Popište pravidlo…"),
    },
    {
      id: "transform",
      label: t("Transform", "Transformace"),
      lead: t(
        `adds a column or builds a new table from this one (a lookup, a share, a rank, a running total, a pivot) and shows the SQL it writes; ${table} stays as it is.`,
        `přidá sloupec nebo z této tabulky sestaví novou (dohledání, podíl, pořadí, průběžný součet, kontingenční tabulku) a ukáže SQL, které k tomu napíše; ${table} zůstanou, jak jsou.`,
      ),
      placeholder: t("Describe what to calculate…", "Popište, co spočítat…"),
    },
  ];

  // Each `match` hears both languages, with and without the Czech accents, because a
  // visitor types the way they write and not the way the page is set.
  const intents: Intent[] = [
    {
      id: "city",
      mode: "clean",
      ...sentence("make the spellings in City consistent", "sjednoť zápisy ve sloupci Město"),
      match: /sjedno|měst|mest|zápis|zapis|city|spell|consistent|praha|prague/i,
      kind: kind.clean,
      title: t("Make values consistent · City", "Sjednotit hodnoty · Město"),
      reply: t("Here is a fix for City. It changes these cells and nothing else:", "Tady je oprava pro sloupec Město. Změní tyto buňky a nic jiného:"),
      done: t(
        `Done. The cells in City now read ${city}. The originals are in History, and the next import arrives spelled the same way.`,
        `Hotovo. Buňky ve sloupci Město teď mají hodnotu ${city}. Původní hodnoty najdete v Historii a příští import přijde zapsaný stejně.`,
      ),
    },
    {
      id: "sign",
      mode: "clean",
      ...sentence("fix the negative amount", "oprav zápornou částku"),
      match: /oprav.*zápor|oprav.*zapor|fix.*negative|sign/i,
      kind: kind.clean,
      title: t(`Fix values · ${amount}`, `Opravit hodnoty · ${amount}`),
      reply: t("FV-2026-108 breaks the new rule. Here is a fix for this cell, and nothing else:", "FV-2026-108 porušuje nové pravidlo. Tady je oprava jen pro tuto buňku, nic jiného:"),
      done: t(
        `Done. FV-2026-108 now reads ${num(lang, 1230)}, and the rule passes. The original is in History.`,
        `Hotovo. FV-2026-108 teď zní na ${num(lang, 1230)} a pravidlo prochází. Původní hodnota je v Historii.`,
      ),
    },
    {
      id: "rule",
      mode: "validate",
      ...sentence("amount must not be negative", "částka nesmí být záporná"),
      // Not "nesmí" on its own: "čísla se nesmí opakovat" is the unique rule, not this one.
      match: /negative|below zero|less than zero|zápor|zapor|pod nul/i,
      kind: kind.validate,
      title: t(`${amount} · Not negative · Error`, `${amount} · Nezáporná · Chyba`),
      reply: t(
        `Here is a rule for ${amount}. It runs on every import and every edit, and a pipeline run that breaks it is held:`,
        `Tady je pravidlo pro sloupec ${amount}. Běží při každém importu i každé úpravě a běh pipeline, který ho poruší, se zadrží:`,
      ),
      done: t(
        `Added to the rules. It already finds one row: FV-2026-108 at ${num(lang, -1230)}.`,
        `Přidáno mezi pravidla. Už teď najde jeden řádek: FV-2026-108 s částkou ${num(lang, -1230)}.`,
      ),
    },
    {
      id: "unique",
      mode: "validate",
      ...sentence("invoice numbers must be unique", "čísla faktur musí být jedinečná"),
      match: /unique|duplic|unikát|unikat|jedinečn|jedinecn|opak/i,
      kind: kind.validate,
      title: t(`${invoiceNo} · Unique · Error`, `${invoiceNo} · Jedinečné · Chyba`),
      reply: t(`Here is a rule for ${invoiceNo}. It makes it the table's key:`, `Tady je pravidlo pro sloupec ${invoiceNo}. Udělá z něj klíč tabulky:`),
      done: t("Added to the rules. Every invoice number is unique today, so it passes.", "Přidáno mezi pravidla. Všechna čísla faktur jsou dnes jedinečná, takže prochází."),
    },
    {
      id: "share",
      mode: "transform",
      ...sentence("add each customer's share of the total", "přidej podíl každého zákazníka na celkové částce"),
      match: /share|percent|procent|podíl|podil|%/i,
      kind: kind.transform,
      title: t("Add calculated column · share_of_total", "Přidat počítaný sloupec · share_of_total"),
      reply: t(
        "Here is a step that adds share_of_total (each amount over the sum of all of them):",
        "Tady je krok, který přidá share_of_total (každou částku vydělenou součtem všech částek):",
      ),
      done: t(`Added as a step. It recalculates whenever ${table} changes.`, `Přidáno jako krok. Přepočítá se pokaždé, když se ${table} změní.`),
    },
    {
      id: "region",
      mode: "transform",
      ...sentence(`add the region from ${customers}`, "doplň region ze Zákazníků"),
      match: /region|lookup|look up|customers|zákazn|zakazn/i,
      kind: kind.transform,
      title: t(`Lookup · Region from ${customers}`, "Dohledání · Region ze Zákazníků"),
      reply: t(
        `Here is a lookup: each row finds its customer in ${customers} and takes the Region. The number of rows never changes:`,
        `Tady je dohledání: každý řádek najde svého zákazníka v tabulce ${customers} a převezme z ní Region. Počet řádků se nikdy nezmění:`,
      ),
      done: t(
        `Added as a step. A customer new to ${customers} shows an empty Region, not a missing row.`,
        `Přidáno jako krok. Zákazník, který v tabulce ${customers} ještě není, dostane prázdný Region a řádek nezmizí.`,
      ),
    },
    {
      id: "rank",
      mode: "transform",
      ...sentence("rank the invoices by amount", "přidej pořadí faktur podle částky"),
      match: /rank|sort|order by|pořad|porad|seřa|serad|řaď/i,
      kind: kind.transform,
      title: t("Add calculated column · rank", "Přidat počítaný sloupec · rank"),
      reply: t(
        "Here is a step that ranks every invoice by its amount, the largest first; ties share a place:",
        "Tady je krok, který každé faktuře určí pořadí podle částky, od největší; shodné částky mají stejné místo:",
      ),
      done: t("Added as a step. The ranks are worked out again whenever an amount changes.", "Přidáno jako krok. Pořadí se přepočítá při každé změně částky."),
    },
    {
      id: "running",
      mode: "transform",
      ...sentence("add a running total", "přidej průběžný součet"),
      match: /running|cumulative|kumul|průběž|prubez/i,
      kind: kind.transform,
      title: t("Add calculated column · running_total", "Přidat počítaný sloupec · running_total"),
      reply: t("Here is a step that adds a running total down the table, in invoice order:", "Tady je krok, který přidá průběžný součet shora dolů, v pořadí faktur:"),
      done: t("Added as a step. It keeps adding up as rows come in.", "Přidáno jako krok. S každým novým řádkem sčítá dál."),
    },
    {
      id: "pivot",
      mode: "transform",
      ...sentence("total by region, as a new table", "součet podle regionu jako nová tabulka"),
      match: /pivot|summary|total by|by region|per region|sales by|new table|kontingen|souhrn|součet podle|soucet podle|podle region|nová tabulka|nova tabulka/i,
      kind: kind.transform,
      title: t(`Pivot · by Region from ${customers}`, "Kontingenční tabulka · podle Regionu ze Zákazníků"),
      reply: t(
        "Here is a new table, built from this one: a lookup of each customer's region, then a total and a count by region.",
        "Tady je nová tabulka sestavená z této: dohledá region každého zákazníka a pak faktury sečte a spočítá podle regionu.",
      ),
      done: t(
        `Saved as a result table, Sales by region. ${table} stays as it is; the result rebuilds itself when ${table} changes.`,
        `Uloženo jako výsledková tabulka Tržby podle regionů. ${table} zůstávají, jak jsou; výsledek se sám přestaví, když se ${table} změní.`,
      ),
    },
  ];

  return {
    table,
    customers,
    amount,
    invoiceNo,
    city,
    start: INVOICES.map(([no, customer, cityCs, cityEn, a], i) => ({
      id: i + 1,
      no,
      customer,
      city: t(cityEn, cityCs),
      amount: lang === "cs" ? a : num("en", readNumber(a) ?? 0),
    })),
    cols: [
      ["no", invoiceNo, "text"],
      ["customer", t("Customer", "Zákazník"), "text"],
      ["city", t("City", "Město"), "text"],
      ["amount", amount, "decimal"],
    ],
    // A Map, not an object: a customer typed as "constructor" is a name, not a region.
    region: new Map(REGIONS.map(([c, cs, en]) => [c, t(en, cs)])),
    noRegion: t("No region", "Bez regionu"),
    modes,
    intents,
    // A total by region names the region too, so the pivot is tried before the lookup;
    // the rest keep the order they are offered in.
    search: [...intents.filter((x) => x.id === "pivot"), ...intents.filter((x) => x.id !== "pivot")],
    /** The SQL a Transform step is written to, shown with its draft. */
    sql: {
      share: "amount / sum(amount) over () as share_of_total",
      region: t("left join customers c on c.name = t.customer", "left join zakaznici z on z.name = t.customer"),
      rank: "rank() over (order by amount desc) as rank",
      running: "sum(amount) over (order by invoice_no) as running_total",
      pivot: "select region, count(*), sum(amount) ... group by region",
    },
    /** What the model is sent about the table: a column's name, its type and the
     *  shape of a value - letters as X and x, digits as 9. */
    sent: [
      { col: t("Customer", "Zákazník"), type: "Text", v: "Pekárna U Mlýna s.r.o." },
      { col: t("City", "Město"), type: "Text", v: t("PRAGUE", "PRAHA") },
      { col: amount, type: t("Decimal", "Desetinné číslo"), v: t(num("en", 12840), "12 840,00") },
    ],
  };
}

/** Both languages are made once; the screen is mounted afresh when the language changes. */
const DEMO: Record<Lang, Demo> = { en: demo("en"), cs: demo("cs") };
const intentOf = (D: Demo, id: Effect) => D.intents.find((x) => x.id === id)!;

// A question word is followed by anything but a letter: \b alone misses the end of "jaký",
// whose last letter JavaScript does not count as a word character.
const QUESTION = /\?|^(kolik|how much|how many|what|which|who|why|jaký|jaká|jaké|který|která|které|kdo|kde|proč)(?!\p{L})/iu;

const morph = (v: string, p: number) => {
  const n = Math.round(v.length * p);
  return mask(v.slice(0, n)) + v.slice(n);
};

type DraftState = "draft" | "applied" | "discarded" | "undone";
type Msg =
  | { id: number; who: "you"; text: string }
  | { id: number; who: "app"; kind: "hello" }
  | { id: number; who: "app"; kind: "sent" }
  | { id: number; who: "app"; kind: "text"; text: ReactNode }
  | { id: number; who: "app"; kind: "draft"; intent: Effect; state: DraftState };
type NewMsg = Msg extends infer M ? (M extends Msg ? Omit<M, "id"> : never) : never;
type DraftMsg = Extract<Msg, { kind: "draft" }>;
/** The conversation as the screen opens it, and as each autoplay round starts it again. */
const HELLO: Msg[] = [{ id: 0, who: "app", kind: "hello" }];
/** The message holding this effect's draft, while it is in the state asked for. */
const draftIn = (msgs: Msg[], e: Effect, state: DraftState) => msgs.find((m): m is DraftMsg => "intent" in m && m.intent === e && m.state === state);

/** What the autoplay reads and presses: the latest render's state and the very functions the
 *  screen's buttons call, so a step the loop plays is the step a visitor's click would take. */
type Live = {
  D: Demo;
  busy: string;
  msgs: Msg[];
  on: Set<Effect>;
  ask: (q: string) => void;
  apply: (id: number, e: Effect) => void;
  undo: (id: number, e: Effect) => void;
  setMode: (m: Mode) => void;
  restart: () => void;
};

/** An invoice's place by amount, the largest first; equal amounts share it. */
const rankOf = (rows: Row[], r: Row) => 1 + rows.filter((x) => (readNumber(x.amount) ?? 0) > (readNumber(r.amount) ?? 0)).length;
/** The total of the amounts down the table, to and with this row. */
const runningTo = (rows: Row[], r: Row) => rows.slice(0, rows.indexOf(r) + 1).reduce((s, x) => s + (readNumber(x.amount) ?? 0), 0);
/** Count and total by region (Zákazníci), the largest first. */
const byRegion = (rows: Row[], D: Demo): [string, number, number][] => {
  const m = new Map<string, [number, number]>();
  rows.forEach((r) => {
    const k = D.region.get(r.customer) ?? D.noRegion;
    const [n, s] = m.get(k) ?? [0, 0];
    m.set(k, [n + 1, s + (readNumber(r.amount) ?? 0)]);
  });
  return [...m.entries()].map(([k, [n, s]]): [string, number, number] => [k, n, s]).sort((a, b) => b[2] - a[2]);
};

/** The capital written any way but the one the clean-up keeps. */
const messy = (rows: Row[], city: string) => rows.filter((r) => fold(r.city) === fold(city) && r.city !== city);
const negative = (rows: Row[]) => rows.filter((r) => (readNumber(r.amount) ?? 0) < 0);
const share = (lang: Lang, amount: string, total: number) => {
  const n = readNumber(amount) ?? 0;
  return n > 0 && total > 0 ? `${num(lang, (n / total) * 100, 1)}${lang === "cs" ? " %" : "%"}` : "—";
};

export function AskScreen() {
  const lang = useLang();
  const t = useT();
  const D = DEMO[lang];
  const [mode, setMode] = useState<Mode>("clean");
  const [rows, setRows] = useState<Row[]>(D.start);
  const [msgs, setMsgs] = useState<Msg[]>(HELLO);
  const [busy, setBusy] = useState<"" | "sending" | "thinking" | "editing">("");
  const [p, setP] = useState(1);
  const [text, setText] = useState("");
  const [on, setOn] = useState<Set<Effect>>(new Set());
  const [typed, setTyped] = useState<Record<string, number>>({});
  const [appliedOpen, setAppliedOpen] = useState(false);
  const appliedRef = useRef<HTMLSpanElement>(null);
  const [undoRows, setUndoRows] = useState<Record<number, Row[]>>({});
  const timers = useRef<number[]>([]);
  const raf = useRef(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const live = useRef<Live | null>(null);
  const nextId = useRef(1);

  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      cancelAnimationFrame(raf.current);
    },
    [],
  );
  // New messages appear at the bottom of the conversation: keep it there.
  useEffect(() => {
    const el = chatRef.current?.closest(".tt-side-b");
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: prefersLessMotion() ? "auto" : "smooth" });
  }, [msgs, busy, mode]);
  // A new column arrives at the right-hand end: bring it into view.
  useEffect(() => {
    const el = gridRef.current;
    if (el && (on.has("share") || on.has("region") || mode === "transform")) el.scrollTo({ left: el.scrollWidth, behavior: prefersLessMotion() ? "auto" : "smooth" });
  }, [on, mode]);

  const push = (m: NewMsg) => setMsgs((ms) => [...ms, { ...m, id: nextId.current++ } as Msg]);
  const say = (s: ReactNode) => push({ who: "app", kind: "text", text: s });
  const setDraft = (id: number, state: DraftState) => setMsgs((ms) => ms.map((m) => (m.id === id && "intent" in m ? { ...m, state } : m)));

  /** The draft comes back after the shapes have gone out and a moment's thought. */
  const draftFor = (it: Intent, sentFirst = true) => {
    const quick = prefersLessMotion();
    if (sentFirst) {
      push({ who: "app", kind: "sent" });
      setP(quick ? 1 : 0);
      if (!quick) {
        const t0 = performance.now();
        const tick = (now: number) => {
          const v = Math.min(1, (now - t0) / 1100);
          setP(v);
          if (v < 1) raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      }
    }
    setBusy(sentFirst ? "sending" : "thinking");
    later(quick || !sentFirst ? 0 : 1400, () => setBusy("thinking"));
    later(quick ? 0 : sentFirst ? 2300 : 900, () => {
      setBusy("");
      push({ who: "app", kind: "draft", intent: it.id, state: "draft" });
    });
  };

  const ask = (q: string) => {
    if (busy) return;
    push({ who: "you", text: q });
    if (QUESTION.test(q)) {
      later(500, () =>
        say(
          t(
            "I don't answer questions about the data yet. I turn a sentence into a fix, a rule or a step. For a total by city, that is a Transform step. Nothing was sent.",
            "Na otázky o datech zatím neodpovídám. Z věty udělám opravu, pravidlo nebo krok. Součet podle města je krok Transformace. Nic se neodeslalo.",
          ),
        ),
      );
      return;
    }
    const it = D.intents.find((x) => x.qs.includes(q)) ?? D.search.find((x) => x.mode === mode && x.match.test(q)) ?? D.search.find((x) => x.match.test(q));
    if (!it || (it.id === "sign" && !on.has("rule"))) {
      later(500, () =>
        say(
          t(
            "I can clean values, add a rule or build a step from a sentence. This demo knows the sentences offered below; the real Ask takes any sentence, and says so when nothing fits.",
            "Z věty umím vyčistit hodnoty, přidat pravidlo nebo sestavit krok. Tahle ukázka zná věty nabídnuté níže; skutečné appolino vezme jakoukoli větu, a když nic nesedí, řekne to.",
          ),
        ),
      );
      return;
    }
    if (on.has(it.id)) {
      later(500, () => say(t("That is applied already. It is in the table now.", "To už je použito, tabulka to už obsahuje.")));
      return;
    }
    setMode(it.mode);
    draftFor(it);
  };

  /** Applies a draft. A fix to cells is written into them one after another, in view. */
  const apply = (id: number, effect: Effect) => {
    setDraft(id, "applied");
    setUndoRows((u) => ({ ...u, [id]: rows }));
    const it = intentOf(D, effect);
    const targets = effect === "city" ? messy(rows, D.city) : effect === "sign" ? negative(rows) : [];
    if (targets.length) {
      const gap = prefersLessMotion() ? 0 : 280;
      setBusy("editing");
      targets.forEach((r, i) =>
        later(gap * i, () => {
          const col: Col = effect === "city" ? "city" : "amount";
          const v = effect === "city" ? D.city : num(lang, Math.abs(readNumber(r.amount) ?? 0));
          setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, [col]: v } : x)));
          setTyped((ty) => ({ ...ty, [`${r.id}:${col}`]: Date.now() }));
        }),
      );
      later(gap * targets.length + 200, () => {
        setBusy("");
        setOn((s) => new Set(s).add(effect));
        say(it.done);
      });
      return;
    }
    setOn((s) => new Set(s).add(effect));
    later(300, () => {
      say(it.done);
      // A rule that finds something offers the fix for it straight away.
      if (effect === "rule" && negative(rows).length) draftFor(intentOf(D, "sign"), false);
    });
  };

  const undo = (id: number, effect: Effect) => {
    setDraft(id, "undone");
    setOn((s) => {
      const n = new Set(s);
      n.delete(effect);
      return n;
    });
    if ((effect === "city" || effect === "sign") && undoRows[id]) setRows(undoRows[id]);
    say(t("Put back as it was.", "Vráceno do původního stavu."));
  };

  const edit = (row: Row, c: Col, v: string) => {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, [c]: v } : r)));
    setTyped((ty) => ({ ...ty, [`${row.id}:${c}`]: Date.now() }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    setText("");
    ask(q);
  };

  /** The screen as it opened, for the autoplay's next round: the conversation, the table and
   *  everything applied to it start over. Anything the screen still had on its own clock is
   *  dropped with them, so a cell written late cannot land in the fresh table. The composer is
   *  left alone: the loop never writes in it, and a visitor who did has already stopped it. */
  const restart = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    cancelAnimationFrame(raf.current);
    setMode("clean");
    setRows(D.start);
    setMsgs(HELLO);
    setBusy("");
    setP(1);
    setOn(new Set());
    setTyped({});
    setUndoRows({});
    gridRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  };

  const pending = msgs.some((m) => "intent" in m && m.state === "draft");
  /** What is applied to the table now, oldest first: each listed over the grid with its own
   *  undo, the newest also one press away in the head (owner: "it changes the table, and can
   *  be reverted"). */
  const applied = msgs.filter((m): m is Extract<Msg, { kind: "draft" }> => "intent" in m && m.state === "applied");
  const undoLast = () => {
    const m = applied[applied.length - 1];
    if (m) undo(m.id, m.intent);
  };
  // The applied steps' menu closes on a click outside it or Esc, and when nothing is left in it.
  useEffect(() => {
    if (!appliedOpen) return;
    const away = (e: PointerEvent) => !appliedRef.current?.contains(e.target as Node) && setAppliedOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAppliedOpen(false);
    addEventListener("pointerdown", away);
    addEventListener("keydown", esc);
    return () => {
      removeEventListener("pointerdown", away);
      removeEventListener("keydown", esc);
    };
  }, [appliedOpen]);
  useEffect(() => {
    if (!applied.length) setAppliedOpen(false);
  }, [applied.length]);
  const M = D.modes.find((x) => x.id === mode)!;
  const offer = D.intents.filter((x) => x.mode === mode && !on.has(x.id) && x.id !== "sign");
  const rulesOn = (["rule", "unique"] as Effect[]).filter((e) => on.has(e)).length;
  const undoLabel = t("Undo", "Vrátit zpět");
  const undoLastLabel = t("Undo the last applied change", "Vrátit poslední použitou změnu");

  // Written on every render, so the loop's next step always sees this render's state and
  // calls functions that close over it, never a round's worth of stale ones.
  live.current = { D, busy, msgs, on, ask, apply, undo, setMode, restart };
  useAutoplay(root, live);

  return (
    <div className="tt" ref={root}>
      <Head
        icon="table"
        title={D.table}
        sub={`${count(lang, D.start.length, ["invoice", "invoices"], ["faktura", "faktury", "faktur"])} · ${t("click any cell to edit it, or ask appolino", "klikněte na buňku a upravte ji, nebo požádejte appolino")}`}
      >
        <span className="tt-chip is-ok">
          <I n="lock" /> {t("Values never leave appolino", "Hodnoty nikdy neopustí appolino")}
        </span>
        <button className="tt-btn is-icon" aria-label={undoLastLabel} title={undoLastLabel} disabled={!applied.length || !!busy} onClick={undoLast}>
          <I n="arrow-back-up" />
        </button>
        {/* What is applied, behind one button in the head rather than a bar over the table
            (owner, 2026-11-01): "Saved steps", not "Applied steps", which is Power Query's
            word - its count on the button, the steps in a menu under it, each with its own
            undo. */}
        <span className={`tt-appwrap${appliedOpen ? " is-open" : ""}`} ref={appliedRef}>
          <button type="button" className={`tt-btn${appliedOpen ? " is-on" : ""}`} aria-haspopup="menu" aria-expanded={appliedOpen} disabled={!applied.length} onClick={() => setAppliedOpen((o) => !o)}>
            <I n="stack-2" /> {t("Saved steps", "Uložené kroky")}
            {applied.length > 0 && <em className="tt-count">{applied.length}</em>}
          </button>
          {appliedOpen && applied.length > 0 && (
            <span className="tt-appmenu" role="menu" aria-label={t("Steps saved to the table", "Kroky uložené k tabulce")}>
              {applied.map((m, i) => {
                const it = intentOf(D, m.intent);
                return (
                  <span key={m.id} className="tt-appstep" role="menuitem">
                    <span className="tt-appstep-n">{i + 1}</span>
                    <I n={it.mode === "validate" ? "shield-check" : it.mode === "clean" ? "wand" : "stack-2"} />
                    <span className="tt-appstep-t">{it.title}</span>
                    <button type="button" aria-label={undoLabel} title={undoLabel} disabled={!!busy} onClick={() => undo(m.id, m.intent)}>
                      <I n="arrow-back-up" />
                    </button>
                  </span>
                );
              })}
            </span>
          )}
        </span>
      </Head>
      <div className="tt-main">
        <div className="tt-card">
          <div className="tt-gridbox" tabIndex={0} role="region" aria-label={t("Table", "Tabulka")} ref={gridRef}>
            {on.has("pivot") ? <Pivot rows={rows} /> : <Grid rows={rows} on={on} mode={mode} typed={typed} edit={edit} />}
          </div>
          <div className="tt-foot">
            <Foot mode={mode} rows={rows} on={on} rulesOn={rulesOn} />
          </div>
        </div>
        <Side
          className="tt-ask"
          icon={<I n="sparkles" />}
          title={t("Ask", "Zeptat se")}
          right={
            <span className="tt-seg" role="radiogroup" aria-label={t("Kind of help", "Druh pomoci")}>
              {D.modes.map((x) => (
                <button key={x.id} role="radio" aria-checked={mode === x.id} onClick={() => setMode(x.id)}>
                  {x.label}
                </button>
              ))}
            </span>
          }
          foot={
            <form className="tt-composer" onSubmit={submit} style={{ flex: 1 }}>
              <I n="sparkles" />
              <label htmlFor="tt-ask-q" className="sr">
                {t("Ask appolino", "Zadání pro appolino")}
              </label>
              <input id="tt-ask-q" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder={M.placeholder} autoComplete="off" />
              <button className="tt-btn is-primary" type="submit" disabled={!!busy || !text.trim()} aria-label={t("Send", "Odeslat")}>
                <I n="send" />
              </button>
            </form>
          }
        >
          <div className="tt-chat" ref={chatRef}>
            {msgs.map((m) =>
              m.who === "you" ? (
                <p key={m.id} className="tt-you">
                  {m.text}
                </p>
              ) : (
                <AppMsg key={m.id}>
                  {m.kind === "hello" ? (
                    <Hello rows={rows} on={on} ask={ask} busy={!!busy} />
                  ) : m.kind === "sent" ? (
                    <Sent p={p} />
                  ) : m.kind === "text" ? (
                    <p>{m.text}</p>
                  ) : (
                    <Draft
                      m={m}
                      rows={rows}
                      apply={apply}
                      undo={undo}
                      discard={(id) => {
                        setDraft(id, "discarded");
                        say(t("Discarded. Nothing changed.", "Zahozeno. Nic se nezměnilo."));
                      }}
                      busy={!!busy}
                    />
                  )}
                </AppMsg>
              ),
            )}
            {busy === "thinking" && (
              <AppMsg>
                <p className="tt-wait" aria-label={t("appolino is writing", "appolino píše")}>
                  <b />
                  <b />
                  <b />
                </p>
              </AppMsg>
            )}
            {!busy && !pending && (
              <div className="tt-mode" key={mode}>
                <p className="tt-note">
                  <b>{M.label}</b> {M.lead}
                </p>
                {offer.length > 0 && (
                  <div className="tt-try" aria-label={t(`Try ${M.label}`, `Příklady: ${M.label}`)}>
                    {offer.map((x) => (
                      <button key={x.id} onClick={() => ask(x.q)}>
                        <I n="sparkles" />
                        {x.q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Side>
      </div>
    </div>
  );
}

/** How often the loop looks again for the state it waits on, and how long it waits before it
 *  decides the screen will never get there and starts the round over rather than hang. */
const POLL = 150;
const GIVE_UP = 12000;
/** Time to read a draft before it is applied. */
const READ = 1800;

/** Ask plays by itself from the first time it is seen, through the functions its own buttons
 *  call: Clean asks for one spelling of the capital and applies it, cell after cell; Validate
 *  asks for the never-negative rule, adds it, and applies the fix the rule offers; Transform
 *  adds a running total, then builds the pivot, and takes the pivot back with the Applied bar's
 *  Undo so the table is seen to return. Then the conversation and the table start over, for as
 *  long as nobody touches it. Each beat waits for the screen itself - the busy flag down, the
 *  draft in the conversation - rather than for a guessed time, and pauses on what it shows for
 *  long enough to be read. The first press, key or focus of the visitor's inside the screen
 *  stops it where it is, for good on this mount: what the screen was already doing finishes, as
 *  it would after a click, and the conversation stays. With less motion asked for it does not
 *  play at all. */
function useAutoplay(root: RefObject<HTMLElement>, live: MutableRefObject<Live | null>) {
  const seen = useSeen(root, 0.4);
  const cycle = useCycle();
  // Kept across the effect's runs: a visitor who pressed something before two fifths of the
  // screen were in view has already taken over, and seeing it later must not start the loop.
  const taken = useRef(false);
  useEffect(() => {
    const el = root.current;
    if (!el || taken.current || prefersLessMotion()) return;
    let stopped = false;
    const timers: number[] = [];
    // Once stopped, a pause never ends, so a round in flight simply goes no further.
    const sleep = (ms: number) =>
      new Promise<void>((done) => {
        if (!stopped) timers.push(window.setTimeout(done, ms));
      });
    // The first look is a poll away, never at once: the step just played has not rendered yet,
    // and this render's state would answer for the one before it.
    const until = (ready: (s: Live) => boolean) =>
      new Promise<void>((done, stuck) => {
        let waited = 0;
        const look = () => {
          const s = live.current;
          if (s && ready(s)) done();
          else if ((waited += POLL) > GIVE_UP) stuck(new Error("Ask's autoplay waited for a step that never came"));
          else if (!stopped) timers.push(window.setTimeout(look, POLL));
        };
        if (!stopped) timers.push(window.setTimeout(look, POLL));
      });
    const act = (f: (s: Live) => void) => {
      const s = live.current;
      if (s && !stopped) f(s);
    };

    /** Waits for this effect's draft, lets it be read, presses its Apply, and waits until the
     *  table holds the change. */
    const applyDraft = async (e: Effect) => {
      await until((s) => !s.busy && !!draftIn(s.msgs, e, "draft"));
      await sleep(READ);
      act((s) => {
        const m = draftIn(s.msgs, e, "draft");
        if (m) s.apply(m.id, e);
      });
      await until((s) => !s.busy && s.on.has(e));
    };
    /** Sends the sentence the screen offers for this effect, in the page's language, word for
     *  word, as a click on the suggestion would, and applies the draft that comes back. */
    const askFor = async (e: Effect) => {
      act((s) => s.ask(intentOf(s.D, e).q));
      await applyDraft(e);
    };
    const round = async () => {
      await sleep(2200); // the opening: what appolino noticed in the table
      await askFor("city");
      await sleep(2600);
      act((s) => s.setMode("validate"));
      await sleep(2400); // the value no rule catches yet, outlined
      await askFor("rule");
      await applyDraft("sign"); // the rule finds a row and offers its fix by itself
      await sleep(2600);
      act((s) => s.setMode("transform"));
      await sleep(2200);
      await askFor("running");
      await sleep(2600);
      await askFor("pivot");
      await sleep(3000);
      act((s) => {
        const m = draftIn(s.msgs, "pivot", "applied");
        if (m) s.undo(m.id, "pivot");
      });
      await until((s) => !s.on.has("pivot"));
      await sleep(2800);
    };
    const play = async () => {
      while (!stopped) {
        // A step that never came starts the conversation over instead of leaving it stuck.
        await round().catch(() => undefined);
        // The conversation played through: the showcase may move on to the next tab now.
        if (!stopped) cycle.roundEnd();
        act((s) => s.restart());
      }
    };

    const stop = (e: Event) => {
      // Only the visitor's own hand: the loop never dispatches events, but a script might.
      if (!e.isTrusted) return;
      taken.current = true;
      cycle.takeover();
      end();
    };
    const end = () => {
      stopped = true;
      timers.forEach(clearTimeout);
      el.removeEventListener("pointerdown", stop, true);
      el.removeEventListener("keydown", stop, true);
      el.removeEventListener("focusin", stop, true);
    };
    // Captured on the way down, so the press that stops the loop is seen before the button it
    // lands on acts. Focus counts as well: tabbing into the composer is taking over too.
    el.addEventListener("pointerdown", stop, true);
    el.addEventListener("keydown", stop, true);
    el.addEventListener("focusin", stop, true);
    if (seen) void play();
    return end;
  }, [seen, root, live]);
}

const AppMsg = ({ children }: { children: ReactNode }) => (
  <div className="tt-msg">
    <span className="tt-av">
      <img src={logo} alt="" />
    </span>
    <div className="tt-msg-b">{children}</div>
  </div>
);

/** appolino's opening: what it noticed in the table itself, without AI. */
function Hello({ rows, on, ask, busy }: { rows: Row[]; on: Set<Effect>; ask: (q: string) => void; busy: boolean }) {
  const lang = useLang();
  const t = useT();
  const D = DEMO[lang];
  const spellings = new Set(rows.filter((r) => fold(r.city) === fold(D.city)).map((r) => r.city)).size;
  const below = negative(rows).length;
  return (
    <>
      <p>
        {t(
          <>
            I read the columns and types of <b>{D.table}</b>, not its values. Noticed here, without AI:
          </>,
          <>
            Čtu sloupce a typy tabulky <b>{D.table}</b>, ne její hodnoty. Bez AI tu vidím:
          </>,
        )}
      </p>
      <div className="tt-noticed">
        {spellings > 1 && !on.has("city") && (
          <button disabled={busy} onClick={() => ask(intentOf(D, "city").q)}>
            <I n="text-spellcheck" />
            <span>{t(`City: ${D.city} is spelled ${spellings} ways`, `Město: ${D.city} je tu zapsaná ${spellings} způsoby`)}</span>
            <I n="arrow-right" />
          </button>
        )}
        {below > 0 && !on.has("rule") && (
          <button disabled={busy} onClick={() => ask(intentOf(D, "rule").q)}>
            <I n="alert-triangle" />
            <span>
              {t(
                `Amount: ${below} below zero, and no rule says no`,
                `Částka: ${count("cs", below, ["", ""], ["hodnota pod nulou", "hodnoty pod nulou", "hodnot pod nulou"])} a žádné pravidlo to nezakazuje`,
              )}
            </span>
            <I n="arrow-right" />
          </button>
        )}
      </div>
      <p>{t("Or pick a kind of help above and tell me what you want, in your own words.", "Nebo nahoře vyberte druh pomoci a napište, co chcete, vlastními slovy.")}</p>
    </>
  );
}

/** What left appolino for this question, the values turning into shapes. */
function Sent({ p }: { p: number }) {
  const t = useT();
  const D = DEMO[useLang()];
  return (
    <div className="tt-sent">
      <span className="tt-sent-h">
        <I n="lock" /> {t("What left appolino", "Co opustilo appolino")}
      </span>
      <dl>
        {D.sent.map((s) => (
          <div key={s.col} style={{ display: "contents" }}>
            <dt>
              {s.col} · {s.type}
            </dt>
            <dd>{morph(s.v, p)}</dd>
          </div>
        ))}
      </dl>
      <span className="tt-meter">
        <I n="world" /> {t("To Claude on Amazon Bedrock, Frankfurt", "Příjemce: Claude na Amazon Bedrock ve Frankfurtu")}
      </span>
    </div>
  );
}

/** A draft as appolino offers it: what it is, what it would change, and the
 *  buttons that decide. */
function Draft({
  m,
  rows,
  apply,
  undo,
  discard,
  busy,
}: {
  m: Extract<Msg, { kind: "draft" }>;
  rows: Row[];
  apply: (id: number, e: Effect) => void;
  undo: (id: number, e: Effect) => void;
  discard: (id: number) => void;
  busy: boolean;
}) {
  const lang = useLang();
  const t = useT();
  const D = DEMO[lang];
  const it = intentOf(D, m.intent);
  const total = rows.reduce((s, r) => s + Math.max(0, readNumber(r.amount) ?? 0), 0);
  const changes: [string, string][] =
    m.intent === "city"
      ? (m.state === "draft" ? messy(rows, D.city) : messy(D.start, D.city)).map((r) => [r.city.replace(/ $/, "␣"), D.city])
      : m.intent === "sign"
        ? [[num(lang, -1230), num(lang, 1230)]]
        : [];
  const sql = D.sql[m.intent];
  return (
    <>
      <p>{it.reply}</p>
      <div className={`tt-draft${m.state === "applied" ? " is-applied" : m.state === "draft" ? "" : " is-gone"}`}>
        <span className="tt-label">
          {m.state === "applied" ? t("Applied", "Použito") : m.state === "undone" ? t("Undone", "Vráceno") : m.state === "discarded" ? t("Discarded", "Zahozeno") : it.kind}
        </span>
        <b>{it.title}</b>
        {changes.length > 0 && (
          <table className="tt-mini">
            <tbody>
              {changes.map(([was, now], i) => (
                <tr key={i}>
                  <td className="was">{was}</td>
                  <td>→</td>
                  <td className="now">{now}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {m.intent === "rule" && (
          <p>
            {t(
              `Column ${D.amount} · check Not negative · severity Error, which holds delivery.`,
              `Sloupec ${D.amount} · kontrola Nezáporná · závažnost Chyba, která zadrží doručení.`,
            )}
          </p>
        )}
        {m.intent === "unique" && (
          <p>
            {t(
              `Column ${D.invoiceNo} · check Unique · severity Error. Upserts match on it.`,
              `Sloupec ${D.invoiceNo} · kontrola Jedinečné · závažnost Chyba. Podle něj import pozná, který řádek aktualizovat.`,
            )}
          </p>
        )}
        {(m.intent === "share" || m.intent === "region" || m.intent === "rank" || m.intent === "running") && (
          <table className="tt-mini">
            <tbody>
              {rows.slice(0, 3).map((r) => (
                <tr key={r.id}>
                  <td>{r.customer}</td>
                  <td className="now" style={{ textAlign: "right" }}>
                    {m.intent === "share"
                      ? share(lang, r.amount, total)
                      : m.intent === "region"
                        ? (D.region.get(r.customer) ?? "—")
                        : m.intent === "rank"
                          ? rankOf(rows, r)
                          : num(lang, runningTo(rows, r))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {m.intent === "pivot" && (
          <table className="tt-mini">
            <thead>
              <tr>
                <th>Region</th>
                <th style={{ textAlign: "right" }}>{t("Invoices", "Počet faktur")}</th>
                <th style={{ textAlign: "right" }}>{D.amount}</th>
              </tr>
            </thead>
            <tbody>
              {byRegion(rows, D).map(([region, n, sum]) => (
                <tr key={region}>
                  <td>{region}</td>
                  <td style={{ textAlign: "right" }}>{n}</td>
                  <td className="now" style={{ textAlign: "right" }}>
                    {num(lang, sum)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {sql && <code className="tt-sqlline">{sql}</code>}
        {m.state === "draft" && (
          <div className="acts">
            <button className="tt-btn is-primary is-sm" disabled={busy} onClick={() => apply(m.id, m.intent)}>
              {it.mode === "validate" ? t("Add rule", "Přidat pravidlo") : t("Apply", "Použít")}
            </button>
            <button className="tt-link" onClick={() => discard(m.id)}>
              {t("Discard", "Zahodit")}
            </button>
          </div>
        )}
        {m.state === "applied" && (
          <div className="acts">
            <button className="tt-link" disabled={busy} onClick={() => undo(m.id, m.intent)}>
              {t("Undo", "Vrátit zpět")}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/** Under the table: how the chosen kind of help works, or what a rule found. */
function Foot({ mode, rows, on, rulesOn }: { mode: Mode; rows: Row[]; on: Set<Effect>; rulesOn: number }) {
  const lang = useLang();
  const t = useT();
  const D = DEMO[lang];
  if (on.has("rule")) {
    const n = negative(rows).length;
    return (
      <span className={n ? "" : "is-ok"}>
        <I n="shield-check" /> {t(`Rule: ${D.amount} is never negative`, `Pravidlo: ${D.amount} nikdy není záporná`)} ·{" "}
        <b className={n ? "" : "is-ok"}>
          {n ? count(lang, n, ["row breaks it", "rows break it"], ["řádek ho porušuje", "řádky ho porušují", "řádků ho porušuje"]) : t("every row passes", "všechny řádky vyhovují")}
        </b>
      </span>
    );
  }
  if (mode === "validate")
    return (
      <span>
        <I n="shield-check" />{" "}
        {rulesOn
          ? count(lang, rulesOn, ["rule on this table.", "rules on this table."], ["pravidlo na této tabulce.", "pravidla na této tabulce.", "pravidel na této tabulce."])
          : t("No rule on Amount yet.", "Na sloupci Částka zatím není žádné pravidlo.")}{" "}
        {t("A rule runs on every import, edit and pipeline run.", "Pravidlo běží při každém importu, úpravě i běhu pipeline.")}
      </span>
    );
  if (mode === "transform")
    return (
      <span>
        <I n="wand" />{" "}
        {t(`A step adds a column at the end, or builds a new table. ${D.table} itself stays as it is.`, `Krok přidá sloupec na konec, nebo sestaví novou tabulku. ${D.table} samotné zůstanou beze změny.`)}
      </span>
    );
  return (
    <span>
      <I n="pencil" />{" "}
      {t(
        "Click a cell to edit it. Clean changes cells only when you apply its draft, and Undo puts them back.",
        "Buňku upravíte kliknutím. Čištění mění buňky, teprve když jeho návrh použijete, a tlačítko Vrátit zpět je obnoví.",
      )}
    </span>
  );
}

/** The table: every cell editable, changed by what has been applied, and
 *  marked by the kind of help chosen. A cell just written glows once. */
/** The table as the pivot builds it, once applied: a row per region, how many invoices and
 *  their sum - the table itself is untouched under it, and Undo brings it back. */
function Pivot({ rows }: { rows: Row[] }) {
  const lang = useLang();
  const t = useT();
  const D = DEMO[lang];
  return (
    <table className="tt-grid">
      <thead>
        <tr>
          <th className="tt-rn" aria-label={t("Row", "Řádek")} />
          <Th type="text" name="Region" className="is-new" />
          <Th type="integer" name={t("Invoices", "Počet faktur")} className="is-num is-new" />
          <Th type="decimal" name={D.amount} className="is-num is-new" />
        </tr>
      </thead>
      <tbody>
        {byRegion(rows, D).map(([region, n, sum], i) => (
          <tr key={region}>
            <td className="tt-rn">{i + 1}</td>
            <td className="is-new tt-key-v" style={{ animationDelay: `${i * 0.05}s` }}>
              {region}
            </td>
            <td className="is-num is-new" style={{ animationDelay: `${i * 0.05}s` }}>
              {n}
            </td>
            <td className="is-num is-new" style={{ animationDelay: `${i * 0.05}s` }}>
              {num(lang, sum)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Grid({ rows, on, mode, typed, edit }: { rows: Row[]; on: Set<Effect>; mode: Mode; typed: Record<string, number>; edit: (r: Row, c: Col, v: string) => void }) {
  const lang = useLang();
  const t = useT();
  const D = DEMO[lang];
  const total = rows.reduce((s, r) => s + Math.max(0, readNumber(r.amount) ?? 0), 0);
  const ghost = mode === "transform" && !(on.has("share") && on.has("region") && on.has("rank") && on.has("running"));
  return (
    <table className="tt-grid">
      <thead>
        <tr>
          <th className="tt-rn" aria-label={t("Row", "Řádek")} />
          {D.cols.map(([c, name, type]) => (
            <Th key={c} type={type} name={name} keyCol={c === "no"} className={c === "amount" ? "is-num" : c === "customer" ? "tt-sm-hide" : ""} />
          ))}
          {on.has("share") && <Th type="decimal" name="share_of_total" className="is-num is-new" />}
          {on.has("region") && <Th type="text" name="Region" className="is-new" />}
          {on.has("rank") && <Th type="integer" name="rank" className="is-num is-new" />}
          {on.has("running") && <Th type="decimal" name="running_total" className="is-num is-new" />}
          {ghost && (
            <th className="tt-ghost">
              <span className="tt-th">
                <I n="plus" /> {t("New column", "Nový sloupec")}
              </span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id}>
            <td className="tt-rn">{i + 1}</td>
            {D.cols.map(([c, name]) => {
              const k = `${r.id}:${c}`;
              const n = c === "amount" ? readNumber(r[c]) : null;
              const neg = n !== null && n < 0;
              const cls = [
                c === "amount" ? "is-num" : "",
                c === "customer" ? "tt-trunc tt-sm-hide" : "",
                c === "no" ? "tt-key-v" : "",
                neg && on.has("rule") ? "is-bad" : "",
                neg && !on.has("rule") && mode === "validate" ? "is-uncaught" : "",
                c === "city" && mode === "clean" && fold(r.city) === fold(D.city) && r.city !== D.city ? "is-soft" : "",
                typed[k] ? "is-typed" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <EditCell key={`${k}-${typed[k] ?? 0}`} value={r[c]} label={t(`${name}, row ${i + 1}`, `${name}, řádek ${i + 1}`)} className={cls} onCommit={(v) => edit(r, c, v)}>
                  <span className={`tt-v${neg ? " tt-neg" : ""}`}>{n !== null ? num(lang, n) : r[c].replace(/ $/, "␣")}</span>
                </EditCell>
              );
            })}
            {on.has("share") && (
              <td className="is-num is-new" style={{ animationDelay: `${i * 0.05}s` }}>
                {share(lang, r.amount, total)}
              </td>
            )}
            {on.has("region") && (
              <td className="is-new" style={{ animationDelay: `${i * 0.05}s` }}>
                {D.region.get(r.customer) ?? <em>—</em>}
              </td>
            )}
            {on.has("rank") && (
              <td className="is-num is-new" style={{ animationDelay: `${i * 0.05}s` }}>
                {rankOf(rows, r)}
              </td>
            )}
            {on.has("running") && (
              <td className="is-num is-new" style={{ animationDelay: `${i * 0.05}s` }}>
                {num(lang, runningTo(rows, r))}
              </td>
            )}
            {ghost && <td className="tt-ghost" />}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

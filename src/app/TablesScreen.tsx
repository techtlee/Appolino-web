import { useEffect, useRef, useState, type ReactNode } from "react";
import { readBool, readDate } from "../czech";
import { count, useLang, useT, type Lang } from "../i18n";
import { prefersLessMotion, useSeen } from "../motion";
import { Head, I, Side } from "./kit";
import { readFigure, ResultGrid, StepsPanel, tableName, type StepId } from "./planSteps";

/**
 * A manual table, as appolino makes one: the Excel a team keeps by hand,
 * moved in rather than imported. It works as the app does (bdop's
 * DatasetEditor): a column has a type - Text, Whole number, Number,
 * Currency, Percentage, Yes / no, Date - and, apart from its type, its
 * allowed values: any value, one from a list, several from a list. A click
 * opens a cell; what is typed is kept as typed, and while it is typed a
 * value that does not fit its type is refused under the cell in the app's
 * own words ("Must be a number"); Enter saves and moves down, Esc puts the
 * value back, and leaving a cell that does not fit puts the old value back
 * and says so. One from a list opens a menu; several from a list a picker
 * that can also add a value. The column menu renames, edits, hides and
 * deletes; + adds a column. Every edit is in the History beside the table
 * and can be undone there, one by one; Saving can be Auto, or Manual, where
 * changes wait to be saved together. The plan is invented.
 *
 * The plan is in the page's language: on the Czech page the plan a Czech team
 * keeps (Chléb kváskový in Praha, 120 000, 31. 1. 2026, ANO), on the English
 * page the same plan written the English way (Sourdough bread in Prague,
 * 120,000, 31 Jan 2026, Yes). The readers take both ways of writing, so what
 * is refused on one page is refused on the other.
 */

type Type = "text" | "whole" | "number" | "currency" | "percent" | "bool" | "date";
type Allowed = "any" | "one" | "several";
type Column = { id: string; name: string; type: Type; allowed: Allowed; values: string[]; key?: boolean; description?: string; hidden?: boolean };
type Row = { id: number; v: Record<string, string> };
/** An edit in the History. `by` is You, Jana or Petr in either language: the avatar's colour and
 *  the tour's Undo find a person by it, so only its display is translated. */
type Entry = { id: number; at: string; by: string; what: string; col?: string; row?: number; from?: string; to?: string; undone?: boolean; undo: () => void; redo: () => void };

/** A text in both languages, English first. */
type Words = [en: string, cs: string];
const say = (lang: Lang, [en, cs]: Words) => (lang === "cs" ? cs : en);

const TYPES: Record<Type, { name: Words; icon: string; why: Words }> = {
  text: { name: ["Text", "Text"], icon: "letter-case", why: ["", ""] },
  whole: { name: ["Whole number", "Celé číslo"], icon: "123", why: ["Must be a whole number", "Musí být celé číslo"] },
  number: { name: ["Number", "Číslo"], icon: "decimal", why: ["Must be a number", "Musí být číslo"] },
  currency: { name: ["Currency", "Měna"], icon: "currency-euro", why: ["Must be a currency amount", "Musí být částka"] },
  percent: { name: ["Percentage", "Procento"], icon: "percentage", why: ["Must be a percentage", "Musí být procento"] },
  bool: { name: ["Yes / no", "Ano / ne"], icon: "toggle-left", why: ["Must be yes or no: true/false, Yes/No, 1/0", "Musí být ano nebo ne: true/false, ANO/NE, 1/0"] },
  date: { name: ["Date", "Datum"], icon: "calendar", why: ["Must be a valid date", "Musí být platné datum"] },
};
const TYPE_ORDER: Type[] = ["text", "whole", "number", "currency", "percent", "bool", "date"];
const ALLOWED: Record<Allowed, Words> = { any: ["Any value", "Libovolná hodnota"], one: ["One from a list", "Jedna ze seznamu"], several: ["Several from a list", "Více ze seznamu"] };

/** The plan's columns: their ids are the same in either language, their names and a region's
 *  values are the page's. */
function startCols(lang: Lang): Column[] {
  const t = (en: string, cs: string) => (lang === "cs" ? cs : en);
  return [
    { id: "product", name: t("Product", "Produkt"), type: "text", allowed: "any", values: [], key: true, description: t("What is planned", "Co se plánuje") },
    { id: "region", name: "Region", type: "text", allowed: "one", values: [t("Prague", "Praha"), "Brno", "Ostrava"] },
    { id: "channels", name: t("Channels", "Kanály"), type: "text", allowed: "several", values: ["E-shop", "Retail", "B2B"] },
    { id: "plan", name: t("Plan (CZK)", "Plán (Kč)"), type: "currency", allowed: "any", values: [] },
    { id: "due", name: t("Due", "Termín"), type: "date", allowed: "any", values: [] },
    { id: "approved", name: t("Approved", "Schváleno"), type: "bool", allowed: "any", values: [] },
  ];
}
/** The columns a phone lets go, so the three the tour acts on - the product, the plan and its
 *  date - fit the width in type that can be read (owner, 2026-11-01: "the tables are not
 *  visible at all on small screens, make it smaller, make it make sense"). A column made here
 *  stays, as it is the visitor's own. */
const PHONE_HIDES = new Set(["region", "channels", "approved"]);
const smHide = (c: Column) => (PHONE_HIDES.has(c.id) ? " tt-sm-hide" : "");
const row = (id: number, product: string, region: string, channels: string, plan: string, due: string, approved: string): Row => ({ id, v: { product, region, channels, plan, due, approved } });
/** The plan as each language writes it: figures, dates and yes or no each the local way. */
const START_ROWS: Record<Lang, Row[]> = {
  en: [
    row(1, "Sourdough bread", "Prague", "E-shop, Retail", "120,000", "31 Jan 2026", "Yes"),
    row(2, "Bread rolls", "Brno", "Retail", "85,500", "31 Jan 2026", "Yes"),
    row(3, "Kolache", "Prague", "E-shop", "42,000", "28 Feb 2026", "No"),
    row(4, "Baguettes", "Ostrava", "Retail, B2B", "64,250.50", "28 Feb 2026", "No"),
    row(5, "Custom cakes", "Prague", "E-shop, B2B", "150,000", "31 Mar 2026", "Yes"),
  ],
  cs: [
    row(1, "Chléb kváskový", "Praha", "E-shop, Retail", "120 000", "31. 1. 2026", "ANO"),
    row(2, "Rohlíky", "Brno", "Retail", "85 500", "31. 1. 2026", "ANO"),
    row(3, "Koláče", "Praha", "E-shop", "42 000", "28. 2. 2026", "NE"),
    row(4, "Bagety", "Ostrava", "Retail, B2B", "64 250,50", "28. 2. 2026", "NE"),
    row(5, "Dorty na zakázku", "Praha", "E-shop, B2B", "150 000", "31. 3. 2026", "ANO"),
  ],
};

const many = (raw: string) => raw.split(",").map((s) => s.trim()).filter(Boolean);
const bare = (raw: string, strip: RegExp) => raw.replace(strip, "").trim();
const rowsN = (lang: Lang, n: number) => count(lang, n, ["row", "rows"], ["řádek", "řádky", "řádků"]);

/** Why a value, as typed, does not fit its column - the app's own words - or
 *  null when it fits. Spaces, commas and dots are read the Czech way or the
 *  English, and what was typed is kept as typed. */
function misfit(lang: Lang, c: Column, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const notOne = (x: string) => (lang === "cs" ? `„${x}“ není mezi možnostmi sloupce ${c.name}: ${c.values.join(", ")}.` : `'${x}' is not one of ${c.name}'s choices: ${c.values.join(", ")}.`);
  if (c.allowed === "one" && !c.values.includes(v)) return notOne(v);
  if (c.allowed === "several") {
    const off = many(v).find((x) => !c.values.includes(x));
    if (off) return notOne(off);
  }
  const why = say(lang, TYPES[c.type].why);
  switch (c.type) {
    case "whole": {
      // Thousands grouped by a space the Czech way; on the English page by a comma as well.
      const grouped = lang === "cs" ? /^-?\d{1,3}([  ]?\d{3})*$/ : /^-?\d{1,3}([ ,]?\d{3})*$/;
      return grouped.test(v) || /^-?\d+$/.test(v) ? null : why;
    }
    case "number":
      return readFigure(lang, v) === null ? why : null;
    case "currency":
      return readFigure(lang, bare(v, /\s*(Kč|CZK|€|EUR)$/i)) === null ? why : null;
    case "percent":
      return readFigure(lang, bare(v, /\s*%$/)) === null ? why : null;
    case "bool":
      return readBool(v) === null && v !== "1" && v !== "0" ? why : null;
    case "date":
      return readDate(v) === null ? why : null;
    default:
      return null;
  }
}

/** A list value's colour, as the app gives one: by its text, from a set of
 *  soft pairs, never picked. */
const CAT = ["is-c0", "is-c1", "is-c2", "is-c3", "is-c4"];
const catOf = (s: string) => CAT[[...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % CAT.length];

const now = (lang: Lang) => new Date().toLocaleTimeString(lang === "cs" ? "cs-CZ" : "en-GB", { hour: "2-digit", minute: "2-digit" });

/* ------------------------------------------------------------------ pieces */

/** A choice from a short list, as the app's SelectMenu: the value on a
 *  button, the list under it; never the browser's own select. */
function Pick<T extends string>({ value, options, label, onPick, compact }: { value: T; options: [T, string, string?][]; label: string; onPick: (v: T) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, open, () => setOpen(false));
  const cur = options.find(([k]) => k === value);
  return (
    <div className={`tt-pick${compact ? " is-compact" : ""}`} ref={ref}>
      <button type="button" className="tt-pick-b" aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}>
        {cur?.[2] && <I n={cur[2]} />}
        <span>{cur?.[1] ?? "—"}</span>
        <I n="chevron-down" className="tt-car" />
      </button>
      {open && (
        <div className="tt-pop tt-pick-l" role="listbox" aria-label={label}>
          {options.map(([k, name, icon]) => (
            <button
              key={k}
              role="option"
              aria-selected={k === value}
              onClick={() => {
                onPick(k);
                setOpen(false);
              }}
            >
              <span>
                {icon && <I n={icon} />} {name}
              </span>
              {k === value && <I n="check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useOutside(ref: React.RefObject<HTMLElement>, on: boolean, close: () => void) {
  useEffect(() => {
    if (!on) return;
    const out = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    addEventListener("mousedown", out);
    return () => removeEventListener("mousedown", out);
  }, [on, ref, close]);
}

/** The values of a list, as chips that can be taken out, and a box to add one. */
function ListValues({ values, set }: { values: string[]; set: (v: string[]) => void }) {
  const t = useT();
  const [add, setAdd] = useState("");
  const put = () => {
    const v = add.trim();
    if (v && !values.includes(v)) set([...values, v]);
    setAdd("");
  };
  return (
    <div className="tt-listv">
      <div className="tt-chs is-edit">
        {values.length ? (
          values.map((x) => (
            <span key={x} className={`tt-pill tt-ch ${catOf(x)}`}>
              {x}
              <button type="button" aria-label={t(`Remove value ${x}`, `Odebrat hodnotu ${x}`)} onClick={() => set(values.filter((y) => y !== x))}>
                <I n="x" />
              </button>
            </span>
          ))
        ) : (
          <span className="tt-note">{t("No values yet", "Zatím žádné hodnoty")}</span>
        )}
      </div>
      <div className="tt-row">
        <input className="tt-field" value={add} placeholder={t("Add a value", "Přidat hodnotu")} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), put())} />
        <button type="button" className="tt-btn is-sm" onClick={put}>
          {t("Add", "Přidat")}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- cells */

type CellProps = {
  c: Column;
  raw: string;
  editing: boolean;
  open: () => void;
  close: () => void;
  commit: (v: string, move: boolean) => void;
  refuse: (why: string) => void;
  pending: boolean;
  label: string;
  /** What the tour is typing into this cell, a letter at a time; never focused, so a phone's
   *  keyboard stays shut and the page does not jump to it. */
  typed?: string;
  /** A teammate's saved edit has just landed here: the cell glows once. */
  arrived?: boolean;
};

/** A cell of a column of any value: a click opens a box; while typing, a
 *  value that does not fit says why under it; Enter saves and moves down,
 *  Esc puts it back, leaving a misfit puts the old value back. */
function TypedCell({ c, raw, editing, open, close, commit, refuse, pending, label, typed, arrived }: CellProps) {
  const lang = useLang();
  const t = useT();
  const [draft, setDraft] = useState(raw);
  useEffect(() => setDraft(raw), [raw, editing]);
  useEffect(() => {
    if (typed !== undefined) setDraft(typed);
  }, [typed]);
  const why = editing ? misfit(lang, c, draft) : misfit(lang, c, raw);
  const num = c.type !== "text" && c.type !== "bool" && c.type !== "date";
  if (editing)
    return (
      <td className={`is-editing${num ? " is-num" : ""}${why ? " is-refused" : ""}${typed !== undefined ? " is-typing" : ""}${smHide(c)}`}>
        <input
          className="tt-cellin"
          autoFocus={typed === undefined}
          readOnly={typed !== undefined}
          value={draft}
          inputMode={num ? "decimal" : undefined}
          aria-label={label}
          aria-invalid={!!why}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            if (e.key === "Enter" && !why) commit(draft, true);
          }}
          onBlur={() => (why ? refuse(why) : commit(draft, false))}
        />
        {why && (
          <span className="tt-cellerr" role="alert">
            {why}
          </span>
        )}
      </td>
    );
  return (
    <td className={`is-edit${num ? " is-num" : ""}${pending ? " is-pending" : ""}${arrived ? " is-arrived" : ""}${smHide(c)}`} tabIndex={0} onClick={open} onKeyDown={(e) => e.key === "Enter" && open()} title={pending ? t("Not saved", "Neuloženo") : undefined}>
      {raw.trim() ? (
        why ? (
          <span className="tt-flag" title={why}>
            <I n="alert-triangle" />
            {raw}
          </span>
        ) : (
          raw
        )
      ) : (
        <em>—</em>
      )}
    </td>
  );
}

/** One from a list: the app's menu - a dash first, then the values. */
function OneCell({ c, raw, editing, open, close, commit, pending, arrived }: CellProps) {
  const lang = useLang();
  const ref = useRef<HTMLTableCellElement>(null);
  useOutside(ref, editing, close);
  const why = misfit(lang, c, raw);
  return (
    <td ref={ref} className={`is-edit tt-choicecell${editing ? " is-open" : ""}${pending ? " is-pending" : ""}${arrived ? " is-arrived" : ""}${smHide(c)}`} tabIndex={0} onClick={() => !editing && open()} onKeyDown={(e) => e.key === "Enter" && open()}>
      {raw.trim() ? why ? <span className="tt-flag" title={why}><I n="alert-triangle" />{raw}</span> : raw : <em>—</em>}
      <I n="chevron-down" className="tt-car" />
      {editing && (
        <div className="tt-pop tt-pick-l" role="listbox" aria-label={c.name}>
          {["", ...c.values].map((x) => (
            <button key={x || "-"} role="option" aria-selected={x === raw} onClick={(e) => (e.stopPropagation(), commit(x, false))}>
              <span>{x || "—"}</span>
              {x === raw && <I n="check" />}
            </button>
          ))}
        </div>
      )}
    </td>
  );
}

/** Several from a list: the app's picker - find or add, tick on and off,
 *  how many are picked, Done. */
function SeveralCell({ c, raw, editing, open, close, commit, pending, arrived, addValue }: CellProps & { addValue: (v: string) => void }) {
  const t = useT();
  const ref = useRef<HTMLTableCellElement>(null);
  const [find, setFind] = useState("");
  const [picked, setPicked] = useState<string[]>(many(raw));
  useEffect(() => {
    if (editing) {
      setPicked(many(raw));
      setFind("");
    }
  }, [editing, raw]);
  const done = () => {
    if (picked.join(", ") !== many(raw).join(", ")) commit(c.values.filter((v) => picked.includes(v)).concat(picked.filter((p) => !c.values.includes(p))).join(", "), false);
    else close();
  };
  useOutside(ref, editing, done);
  const shown = c.values.filter((v) => v.toLowerCase().includes(find.trim().toLowerCase()));
  const fresh = find.trim() && !c.values.some((v) => v.toLowerCase() === find.trim().toLowerCase()) ? find.trim() : null;
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  return (
    <td ref={ref} className={`is-edit tt-choicecell${editing ? " is-open" : ""}${pending ? " is-pending" : ""}${arrived ? " is-arrived" : ""}${smHide(c)}`} tabIndex={0} onClick={() => !editing && open()} onKeyDown={(e) => e.key === "Enter" && open()}>
      {raw.trim() ? raw : <em>—</em>}
      <I n="chevron-down" className="tt-car" />
      {editing && (
        <div className="tt-pop tt-multi" onClick={(e) => e.stopPropagation()}>
          <input
            className="tt-field"
            autoFocus
            value={find}
            placeholder={t("Type to find or add", "Pište pro hledání nebo přidání")}
            onChange={(e) => setFind(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") done();
              if (e.key !== "Enter") return;
              if (fresh) {
                addValue(fresh);
                toggle(fresh);
              } else if (shown[0]) toggle(shown[0]);
              setFind("");
            }}
          />
          <div className="tt-chs is-wrap">
            {shown.map((v) => (
              <button key={v} type="button" className={`tt-pill tt-ch ${catOf(v)}${picked.includes(v) ? " is-on" : ""}`} aria-pressed={picked.includes(v)} onClick={() => toggle(v)}>
                {picked.includes(v) && <I n="check" />}
                {v}
              </button>
            ))}
            {!c.values.length && !fresh && <span className="tt-note">{t("No options yet. Type one and press Enter.", "Zatím žádné možnosti. Napište jednu a stiskněte Enter.")}</span>}
            {c.values.length > 0 && !shown.length && !fresh && <span className="tt-note">{t("No match.", "Nic neodpovídá.")}</span>}
          </div>
          {fresh && (
            <button
              type="button"
              className="tt-addv"
              onClick={() => {
                addValue(fresh);
                toggle(fresh);
                setFind("");
              }}
            >
              <I n="plus" /> {t(`Add "${fresh}"`, `Přidat „${fresh}“`)}
            </button>
          )}
          <div className="tt-multi-f">
            <span className="tt-note">{picked.length ? t(`${picked.length} selected`, `Vybráno: ${picked.length}`) : t("Nothing selected", "Nic není vybráno")}</span>
            <button type="button" className="tt-btn is-sm is-primary" onClick={done}>
              {t("Done", "Hotovo")}
            </button>
          </div>
        </div>
      )}
    </td>
  );
}

/* ------------------------------------------------------------------ screen */

export function TablesScreen() {
  // The screen is mounted afresh when the language changes, so the plan is made in the
  // language of the page it is shown on and never needs translating while it is edited.
  const lang = useLang();
  const t = useT();
  const [cols, setCols] = useState<Column[]>(() => startCols(lang));
  const [rows, setRows] = useState<Row[]>(START_ROWS[lang]);
  const [editing, setEditing] = useState<{ r: number; c: string } | null>(null);
  const [menu, setMenu] = useState<{ c: string; kind: "menu" | "new" | "delete" } | null>(null);
  const [side, setSide] = useState<{ kind: "history" } | { kind: "transform" } | { kind: "edit"; c: string } | { kind: "row"; r: number }>({ kind: "history" });
  // Transform's steps live with the table, so closing the panel keeps them.
  const [steps, setSteps] = useState<StepId[]>([]);
  const [stepView, setStepView] = useState<"steps" | "sql">("steps");
  const [saved, setSaved] = useState<string | null>(null);
  const [stepNote, setStepNote] = useState<string | null>(null);
  /** Cells a teammate's saved edit has just landed in: they glow once. */
  const [glow, setGlow] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [hist, setHist] = useState<Entry[]>([]);
  const [saving, setSaving] = useState<"auto" | "manual">("auto");
  const [pending, setPending] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const ids = useRef({ row: START_ROWS[lang].length + 1, col: 1, entry: 1 });
  const gridRef = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [tour, setTour] = useState<{ step: number; typed?: string } | null>(null);
  const seen = useSeen(root, 0.4);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const log = (e: Omit<Entry, "id" | "at" | "by"> & { by?: string }) => setHist((h) => [{ by: "You", ...e, id: ids.current.entry++, at: now(lang) }, ...h]);
  const land = (r: number, c: string) => {
    const k = `${r}:${c}`;
    setGlow((g) => new Set(g).add(k));
    window.setTimeout(() => setGlow((g) => (g.delete(k) ? new Set(g) : g)), 1600);
  };
  const write = (r: number, c: string, v: string) => setRows((rs) => rs.map((x) => (x.id === r ? { ...x, v: { ...x.v, [c]: v } } : x)));
  const shown = cols.filter((c) => !c.hidden);
  const value = (r: Row, c: string) => pending[`${r.id}:${c}`] ?? r.v[c] ?? "";
  const edited = t("Edited", "Úprava");

  /** A cell's new value: saved at once, or held while Saving is Manual. */
  const commit = (r: Row, c: Column, v: string, move: boolean) => {
    const from = r.v[c.id] ?? "";
    if (v !== value(r, c.id)) {
      if (saving === "manual") setPending((p) => ({ ...p, [`${r.id}:${c.id}`]: v }));
      else {
        write(r.id, c.id, v);
        log({ what: edited, col: c.name, row: rows.indexOf(r) + 1, from, to: v, undo: () => write(r.id, c.id, from), redo: () => write(r.id, c.id, v) });
      }
    }
    const i = rows.indexOf(r);
    setEditing(move && rows[i + 1] ? { r: rows[i + 1].id, c: c.id } : null);
  };
  const saveAll = () => {
    const entries = Object.entries(pending);
    entries.forEach(([k, v]) => {
      const [rid, cid] = k.split(":");
      const r = rows.find((x) => x.id === +rid);
      const c = cols.find((x) => x.id === cid);
      if (!r || !c) return;
      const from = r.v[cid] ?? "";
      write(r.id, cid, v);
      log({ what: edited, col: c.name, row: rows.indexOf(r) + 1, from, to: v, undo: () => write(r.id, cid, from), redo: () => write(r.id, cid, v) });
    });
    setPending({});
  };
  const addRow = () => {
    const id = ids.current.row++;
    const fresh = { id, v: Object.fromEntries(cols.map((c) => [c.id, ""])) };
    setRows((rs) => [...rs, fresh]);
    log({ what: t("Added a row", "Přidán řádek"), undo: () => setRows((rs) => rs.filter((x) => x.id !== id)), redo: () => setRows((rs) => [...rs, fresh]) });
    requestAnimationFrame(() => gridRef.current?.scrollTo({ top: gridRef.current.scrollHeight, behavior: "smooth" }));
  };
  const addCol = (c: Omit<Column, "id">) => {
    const col = { ...c, id: `c${ids.current.col++}` };
    setCols((cs) => [...cs, col]);
    log({ what: t("Added a column", "Přidán sloupec"), col: col.name, undo: () => setCols((cs) => cs.filter((x) => x.id !== col.id)), redo: () => setCols((cs) => [...cs, col]) });
    setMenu(null);
    requestAnimationFrame(() => gridRef.current?.scrollTo({ left: gridRef.current.scrollWidth, behavior: "smooth" }));
  };
  const change = (id: string, patch: Partial<Column>, what?: string) => {
    const before = cols.find((c) => c.id === id)!;
    setCols((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (what) log({ what, col: before.name, undo: () => setCols((cs) => cs.map((c) => (c.id === id ? before : c))), redo: () => setCols((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c))) });
  };
  const removeCol = (id: string) => {
    const at = cols.findIndex((c) => c.id === id);
    const col = cols[at];
    setCols((cs) => cs.filter((c) => c.id !== id));
    log({ what: t("Deleted the column", "Smazán sloupec"), col: col.name, undo: () => setCols((cs) => [...cs.slice(0, at), col, ...cs.slice(at)]), redo: () => setCols((cs) => cs.filter((c) => c.id !== id)) });
    setMenu(null);
    if (side.kind === "edit" && side.c === id) setSide({ kind: "history" });
  };
  /** A row is picked by its number, as in the app: the number turns into its tick. */
  const pick = (id: number) =>
    setPicked((p) => {
      const n = new Set(p);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const pickAll = () => setPicked((p) => (p.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  const removeRows = () => {
    const gone = rows.flatMap((r, i) => (picked.has(r.id) ? [[i, r] as const] : []));
    const out = (rs: Row[]) => rs.filter((x) => !gone.some(([, g]) => g.id === x.id));
    setRows(out);
    log({
      what: gone.length === 1 ? t("Deleted a row", "Smazán řádek") : t(`Deleted ${gone.length} rows`, `${gone.length < 5 ? "Smazány" : "Smazáno"} ${rowsN(lang, gone.length)}`),
      undo: () =>
        setRows((rs) => {
          const back = out(rs);
          gone.forEach(([i, g]) => back.splice(i, 0, g));
          return back;
        }),
      redo: () => setRows(out),
    });
    setPicked(new Set());
    if (side.kind === "row" && gone.some(([, g]) => g.id === side.r)) setSide({ kind: "history" });
  };
  const flip = (e: Entry) => {
    (e.undone ? e.redo : e.undo)();
    setHist((h) => h.map((x) => (x.id === e.id ? { ...x, undone: !x.undone } : x)));
  };
  const undoLast = () => {
    const e = hist.find((x) => !x.undone);
    if (e) flip(e);
  };
  const reset = () => {
    setCols(startCols(lang));
    setRows(START_ROWS[lang]);
    setHist([]);
    setPending({});
    setEditing(null);
    setMenu(null);
    setPicked(new Set());
    setSide({ kind: "history" });
  };

  // What the tour does, made fresh each render so its steps act on the table as it is when
  // they run, not as it was when the tour started.
  const act: Act = {
    addRow: (by, values, each) => {
      const id = ids.current.row++;
      const empty = { id, v: Object.fromEntries(cols.map((c) => [c.id, ""])) };
      const full = { id, v: { ...empty.v, ...values } };
      setRows((rs) => [...rs, empty]);
      log({ by, what: t("Added a row", "Přidán řádek"), row: rows.length + 1, undo: () => setRows((rs) => rs.filter((x) => x.id !== id)), redo: () => setRows((rs) => [...rs, full]) });
      Object.entries(values).forEach(([c, v], i) =>
        window.setTimeout(() => {
          write(id, c, v);
          land(id, c);
        }, (i + 1) * each),
      );
      requestAnimationFrame(() => gridRef.current?.scrollTo({ top: gridRef.current.scrollHeight, behavior: "smooth" }));
      return id;
    },
    arrive: (by, rid, cid, v) => {
      const r = rows.find((x) => x.id === rid);
      const c = cols.find((x) => x.id === cid);
      if (!r || !c) return;
      const from = r.v[cid] ?? "";
      write(rid, cid, v);
      land(rid, cid);
      log({ by, what: edited, col: c.name, row: rows.indexOf(r) + 1, from, to: v, undo: () => write(rid, cid, from), redo: () => write(rid, cid, v) });
    },
    undoBy: (by) => {
      const e = hist.find((x) => !x.undone && x.by === by);
      if (e) flip(e);
    },
    transform: (s) => {
      if (!s) return setSide({ kind: "history" });
      setSteps(() => s);
      setSaved(null);
      setSide({ kind: "transform" });
    },
    reset: () => {
      reset();
      setSteps([]);
      setSaved(null);
      setStepNote(null);
    },
  };
  const live = useRef<Live>({ act });
  live.current = { act };
  useTour(seen, root, setTour, setEditing, live);

  const unsaved = Object.keys(pending).length;
  const editCol = side.kind === "edit" ? cols.find((c) => c.id === side.c) : undefined;
  const openRow = side.kind === "row" ? rows.find((r) => r.id === side.r) : undefined;
  const result = side.kind === "transform" && steps.length > 0;

  return (
    <div className="tt" ref={root}>
      <Head
        icon="table"
        title={tableName(lang, "plan")}
        sub={`${rowsN(lang, rows.length)} · ${count(lang, shown.length, ["column", "columns"], ["sloupec", "sloupce", "sloupců"])} · ${t("made in appolino, not imported (what used to be an Excel file)", "založená přímo v aplikaci appolino, ne importovaná (dřív to byl soubor v Excelu)")}`}
      >
        <button className="tt-btn is-icon" aria-label={t("Undo last change", "Vrátit poslední změnu")} title={t("Undo last change", "Vrátit poslední změnu")} disabled={!hist.some((x) => !x.undone)} onClick={undoLast}>
          <I n="arrow-back-up" />
        </button>
        {/* What the card beside the table shows: the table's History, or Transform's steps
            on it - one switch, the open one raised, Transform counting its steps. */}
        <span className="tt-views" role="radiogroup" aria-label={t("Beside the table", "Vedle tabulky")}>
          <button role="radio" aria-checked={side.kind !== "transform"} onClick={() => setSide({ kind: "history" })}>
            <I n="history" /> {t("History", "Historie")}
            {hist.length > 0 && <em>{hist.length}</em>}
          </button>
          <button role="radio" aria-checked={side.kind === "transform"} onClick={() => setSide({ kind: "transform" })}>
            <I n="stack-2" /> {t("Transform", "Transformace")}
            {steps.length > 0 && <em>{steps.length}</em>}
          </button>
        </span>
      </Head>
      <div className="tt-main">
        <div className="tt-card">
          <div className="tt-gridbox" ref={gridRef}>
            {/* While Transform is open with steps in, the grid shows what they make of the
                table; closed, it is the table again, to edit. */}
            {result ? (
              <ResultGrid table={rows} steps={steps} saved={saved} />
            ) : (
            <table className={`tt-grid tt-entry${picked.size ? " is-picking" : ""}`}>
              <thead>
                <tr>
                  <th className="tt-rn">
                    <input
                      type="checkbox"
                      className="tt-tick"
                      checked={picked.size > 0 && picked.size === rows.length}
                      ref={(el) => {
                        if (el) el.indeterminate = picked.size > 0 && picked.size < rows.length;
                      }}
                      onChange={pickAll}
                      aria-label={t("Select all rows", "Vybrat všechny řádky")}
                    />
                  </th>
                  {shown.map((c, i) => (
                    <th key={c.id} className={`${c.type !== "text" && c.type !== "bool" && c.type !== "date" ? "is-num " : ""}${editCol?.id === c.id ? "is-sel " : ""}tt-colh${smHide(c)}`}>
                      <span className="tt-th">
                        <I n={TYPES[c.type].icon} />
                        {c.name}
                        {c.key && <I n="key" className="tt-key" />}
                      </span>
                      <button className="tt-colm" aria-label={t("Column menu", "Nabídka sloupce")} title={t("Column menu", "Nabídka sloupce")} onClick={() => setMenu(menu?.c === c.id ? null : { c: c.id, kind: "menu" })}>
                        <I n="chevron-down" />
                      </button>
                      {menu?.c === c.id && (
                        <ColumnMenu
                          c={c}
                          right={i > shown.length - 3}
                          kind={menu.kind}
                          close={() => setMenu(null)}
                          rename={(name) => change(c.id, { name }, t("Renamed the column", "Přejmenován sloupec"))}
                          edit={() => {
                            setSide({ kind: "edit", c: c.id });
                            setMenu(null);
                          }}
                          hide={() => {
                            change(c.id, { hidden: true }, t("Hid the column", "Skryt sloupec"));
                            setMenu(null);
                          }}
                          ask={() => setMenu({ c: c.id, kind: "delete" })}
                          remove={() => removeCol(c.id)}
                        />
                      )}
                    </th>
                  ))}
                  <th className="tt-addcol">
                    <button aria-label={t("Add column", "Přidat sloupec")} title={t("Add column", "Přidat sloupec")} onClick={() => setMenu(menu?.kind === "new" ? null : { c: "+", kind: "new" })}>
                      <I n="plus" />
                    </button>
                    {menu?.kind === "new" && <NewColumn n={cols.length + 1} close={() => setMenu(null)} create={addCol} />}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={picked.has(r.id) ? "is-picked" : side.kind === "row" && side.r === r.id ? "is-open" : undefined}>
                    {/* The number doubles as the tick, as in the app: a click picks the row and
                        the number becomes its box; the door to the row's details sits beside it. */}
                    <td className="tt-rn">
                      <input type="checkbox" className="tt-tick" checked={picked.has(r.id)} onChange={() => pick(r.id)} aria-label={t(`Select row ${i + 1}`, `Vybrat řádek ${i + 1}`)} />
                      <span className="tt-rn-n" aria-hidden>
                        {i + 1}
                      </span>
                      <button type="button" className="tt-door" title={t("Row details", "Detail řádku")} aria-label={t(`Open row ${i + 1}`, `Otevřít řádek ${i + 1}`)} onClick={() => setSide({ kind: "row", r: r.id })}>
                        <I n="chevron-right" />
                      </button>
                    </td>
                    {shown.map((c) => {
                      const props: CellProps = {
                        c,
                        raw: value(r, c.id),
                        editing: editing?.r === r.id && editing.c === c.id,
                        open: () => setEditing({ r: r.id, c: c.id }),
                        close: () => setEditing(null),
                        commit: (v, move) => commit(r, c, v, move),
                        refuse: (why) => {
                          setEditing(null);
                          setToast(t(`${c.name} in row ${i + 1} was not saved. ${why}.`, `Hodnota ve sloupci ${c.name} v řádku ${i + 1} se neuložila. ${why}.`));
                        },
                        pending: `${r.id}:${c.id}` in pending,
                        label: t(`${c.name}, row ${i + 1}`, `${c.name}, řádek ${i + 1}`),
                        typed: tour?.typed !== undefined && editing?.r === r.id && editing.c === c.id ? tour.typed : undefined,
                        arrived: glow.has(`${r.id}:${c.id}`),
                      };
                      if (c.allowed === "one") return <OneCell key={c.id} {...props} />;
                      if (c.allowed === "several") return <SeveralCell key={c.id} {...props} addValue={(v) => change(c.id, { values: [...c.values, v] })} />;
                      return <TypedCell key={c.id} {...props} />;
                    })}
                    <td className="tt-addcol" />
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
          {toast && (
            <div className="tt-toast" role="status">
              <I n="alert-triangle" /> {toast}
            </div>
          )}
          {tour && (
            <div className="tt-tour" role="status" key={tour.step}>
              <b>{tour.step < STEPS_SHOWN ? t(`${tour.step + 1} of ${STEPS_SHOWN}`, `${tour.step + 1} z ${STEPS_SHOWN}`) : t("Now you", "Teď vy")}</b>
              {t(TOUR.en, TOUR.cs)[tour.step]}
            </div>
          )}
          {result ? (
            <div className="tt-foot">
              <span>
                <I n="eye" />{" "}
                {saved
                  ? t(`${saved}: a result table, rebuilt whenever this table changes`, `${saved}: výsledná tabulka, sestaví se znovu při každé změně této tabulky`)
                  : t("A preview of the result: an edit to the table shows here the next time you look", "Náhled výsledku: úprava tabulky se tu ukáže, až se sem příště podíváte")}
              </span>
              <button className="tt-link" onClick={() => setSide({ kind: "history" })}>
                {t("Back to the table", "Zpět k tabulce")}
              </button>
            </div>
          ) : (
          <div className="tt-foot tt-savebar">
            {picked.size ? (
              <span className="tt-pickbar">
                <b>{picked.size === 1 ? t("1 row selected", "Vybrán 1 řádek") : t(`${picked.size} rows selected`, `${picked.size < 5 ? "Vybrány" : "Vybráno"} ${rowsN(lang, picked.size)}`)}</b>
                <button className="tt-btn is-sm is-danger" onClick={removeRows}>
                  <I n="trash" /> {t("Delete", "Smazat")}
                </button>
                <button className="tt-link" onClick={() => setPicked(new Set())}>
                  {t("Clear", "Zrušit výběr")}
                </button>
              </span>
            ) : (
              <>
                <button className="tt-link tt-addrow" onClick={addRow} title={t("Add an empty row", "Přidat prázdný řádek")}>
                  <I n="plus" /> {t("Add row", "Přidat řádek")}
                </button>
                <span>{rowsN(lang, rows.length)}</span>
              </>
            )}
            <span className="tt-saving">
              <span className="tt-label">{t("Saving", "Ukládání")}</span>
              <span className="tt-seg" role="radiogroup" aria-label={t("Saving", "Ukládání")}>
                {(["auto", "manual"] as const).map((m) => (
                  <button key={m} role="radio" aria-checked={saving === m} onClick={() => (m === "auto" && unsaved ? saveAll() : null, setSaving(m))}>
                    {m === "auto" ? t("Auto", "Automaticky") : t("Manual", "Ručně")}
                  </button>
                ))}
              </span>
              {saving === "manual" &&
                (unsaved ? (
                  <>
                    <b className="tt-unsaved">{count(lang, unsaved, ["unsaved change", "unsaved changes"], ["neuložená změna", "neuložené změny", "neuložených změn"])}</b>
                    <button className="tt-link" onClick={() => setPending({})}>
                      {t("Discard", "Zahodit")}
                    </button>
                    <button className="tt-btn is-sm is-primary" onClick={saveAll}>
                      {t("Save", "Uložit")} {count(lang, unsaved, ["change", "changes"], ["změnu", "změny", "změn"])}
                    </button>
                  </>
                ) : (
                  <span className="tt-note">{t("No unsaved changes", "Žádné neuložené změny")}</span>
                ))}
            </span>
          </div>
          )}
        </div>
        {side.kind === "transform" ? (
          <StepsPanel
            table={rows}
            steps={steps}
            setSteps={setSteps}
            view={stepView}
            setView={setStepView}
            saved={saved}
            setSaved={setSaved}
            note={stepNote}
            setNote={setStepNote}
            close={() => setSide({ kind: "history" })}
          />
        ) : editCol ? (
          <EditColumn key={editCol.id} c={editCol} rows={rows} close={() => setSide({ kind: "history" })} save={(patch) => (change(editCol.id, patch, t("Edited the column", "Upraven sloupec")), setSide({ kind: "history" }))} />
        ) : openRow ? (
          <RowDetails r={openRow} n={rows.indexOf(openRow) + 1} cols={shown} value={value} hist={hist} close={() => setSide({ kind: "history" })} />
        ) : (
          <History hist={hist} flip={flip} reset={reset} nudge={tour?.step === 3 ? hist.find((x) => !x.undone && x.by === "Petr")?.id : undefined} />
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- tour */

/** What the tour says at each step: teammates' edits arriving, a misfit refused, Undo, and
 *  the same table transformed. */
const TOUR = {
  en: [
    "Jana adds a row. Her values land as she saves them.",
    "Petr changes a plan. History names who and when.",
    "A word typed into a number column is refused. Nothing broken gets in.",
    "So is a date that does not exist: there is no 31 February.",
    "Any edit can be undone. Here, Petr's.",
    "Transform the same table in steps: in EUR here, rebuilt whenever it changes.",
    "Then shape it: one click pivots the plan into months by region.",
    "Your turn: click any cell, or open Transform.",
  ],
  cs: [
    "Jana přidává řádek. Její hodnoty se objeví, jakmile je uloží.",
    "Petr mění plán. Historie ukazuje, kdo a kdy.",
    "Slovo ve sloupci s čísly tabulka odmítne. Nic chybného se dovnitř nedostane.",
    "Stejně tak datum, které neexistuje: 31. únor v kalendáři není.",
    "Každou úpravu lze vrátit, tady tu Petrovu.",
    "Tutéž tabulku převedete po krocích: tady do EUR, a výsledek se přepočítá při každé její změně.",
    "Pak jí dáte tvar: jedním klikem kontingenční tabulka plánu po měsících a regionech.",
    "Teď vy: klikněte do libovolné buňky, nebo otevřete Transformaci.",
  ],
};
const STEPS_SHOWN = TOUR.en.length - 1;

/** What the tour does to the table, made fresh each render so it acts on the table as it is. */
export type Act = {
  addRow: (by: string, values: Record<string, string>, each: number) => number;
  arrive: (by: string, row: number, col: string, value: string) => void;
  undoBy: (by: string) => void;
  transform: (steps: StepId[] | null) => void;
  /** Puts the table back as it was, for the tour to play again. */
  reset: () => void;
};
type Live = { act: Act };

/** Tables shows itself the first time it is seen, as a table several people keep (owner,
 *  2026-11-01: "filling cells, collaborating on them, errors when filling incorrectly, with
 *  history there"), as appolino works today: a teammate's edit arrives once it is saved -
 *  there is no live cursor or presence in the app - glows once where it lands and is named in
 *  History. Jana's new row fills value by value, Petr changes a plan, a word typed into a
 *  number column is refused under the cell, Petr's edit is undone, and the table is
 *  transformed in the same tab. Each step is named in a line over the grid. The first press
 *  or key in the window stops it where it is; with less motion asked for it does not play.
 *  What is typed is written the way the page's language writes it, so the impossible date is
 *  31. 2. 2026 on the Czech page and 31 Feb 2026 on the English one. */
function useTour(
  seen: boolean,
  root: React.RefObject<HTMLElement>,
  setTour: (t: { step: number; typed?: string } | null | ((t: { step: number; typed?: string } | null) => { step: number; typed?: string } | null)) => void,
  setEditing: (e: { r: number; c: string } | null) => void,
  live: React.MutableRefObject<Live>,
) {
  const t = useT();
  useEffect(() => {
    const el = root.current;
    // Every time the tab is opened and seen, as every tab plays (owner: "always a loop").
    if (!seen || !el || prefersLessMotion()) return;
    const timers: number[] = [];
    let clock = 700;
    const at = (wait: number, f: () => void) => {
      clock += wait;
      timers.push(window.setTimeout(f, clock));
    };
    let open = false;
    // A value a beat, a letter a blink: brisk, as someone who knows the table types (owner,
    // 2026-11-01: "the writing and editing a little faster"; it was 420 and 120 ms).
    const EACH = 280;
    const LETTER = 75;
    /** A value typed into a cell a letter at a time, never focused; it does not fit, so the
     *  cell says why, and is then left. */
    const type = (r: number, c: string, text: string, step: number) => {
      at(0, () => {
        open = true;
        setEditing({ r, c });
        setTour({ step, typed: "" });
      });
      [...text].forEach((_, k) => at(k === 0 ? 350 : LETTER, () => setTour((x) => x && { ...x, typed: text.slice(0, k + 1) })));
      at(1600, () => {
        open = false;
        setEditing(null);
      });
    };
    // One round; it plays again from a fresh table until the visitor takes over (owner: "loop").
    // Each round schedules from the moment it starts, so its clock starts at nought.
    const round = () => {
      clock = 0;
      at(0, () => {
        setTour({ step: 0 });
        live.current.act.addRow(
          "Jana",
          t(
            { product: "Croissants", region: "Brno", channels: "Retail, E-shop", plan: "38,000", due: "30 Apr 2026", approved: "No" },
            { product: "Croissanty", region: "Brno", channels: "Retail, E-shop", plan: "38 000", due: "30. 4. 2026", approved: "NE" },
          ),
          EACH,
        );
      });
      clock += 6 * EACH + 1000;
      at(0, () => {
        setTour({ step: 1 });
        live.current.act.arrive("Petr", 2, "plan", t("92,000", "92 000"));
      });
      clock += 2100;
      type(3, "plan", t("lots", "hodně"), 2);
      type(4, "due", t("31 Feb 2026", "31. 2. 2026"), 3);
      at(300, () => setTour({ step: 4 }));
      at(1500, () => live.current.act.undoBy("Petr"));
      at(2000, () => {
        setTour({ step: 5 });
        live.current.act.transform(["rate"]);
      });
      at(1000, () => live.current.act.transform(["rate", "eur"]));
      at(3200, () => {
        setTour({ step: 6 });
        live.current.act.transform(["rate", "eur", "pivot"]);
      });
      at(3800, () => {
        setTour({ step: 7 });
        live.current.act.transform(null);
      });
      at(5200, () => {
        setTour(null);
        live.current.act.reset();
      });
      at(1400, round);
    };
    at(0, round);
    const stop = (e: Event) => {
      if (!e.isTrusted) return;
      timers.forEach(clearTimeout);
      setTour(null);
      if (open) setEditing(null);
      off();
    };
    const off = () => {
      el.removeEventListener("pointerdown", stop, true);
      el.removeEventListener("keydown", stop, true);
    };
    el.addEventListener("pointerdown", stop, true);
    el.addEventListener("keydown", stop, true);
    return () => {
      timers.forEach(clearTimeout);
      off();
    };
  }, [seen, root, setTour, setEditing, live, t]);
}

/* ---------------------------------------------------- column menu and forms */

function ColumnMenu({
  c,
  right,
  kind,
  close,
  rename,
  edit,
  hide,
  ask,
  remove,
}: {
  c: Column;
  right: boolean;
  kind: "menu" | "new" | "delete";
  close: () => void;
  rename: (n: string) => void;
  edit: () => void;
  hide: () => void;
  ask: () => void;
  remove: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(c.name);
  useOutside(ref, true, close);
  const keep = () => name.trim() && name.trim() !== c.name && rename(name.trim());
  if (kind === "delete")
    return (
      <div className={`tt-pop tt-colmenu${right ? " is-right" : ""}`} ref={ref} role="alertdialog" aria-label={t(`Delete column ${c.name}?`, `Smazat sloupec ${c.name}?`)}>
        <b>{t(`Delete column ${c.name}?`, `Smazat sloupec ${c.name}?`)}</b>
        <p className="tt-note">{t("Its values are deleted with it.", "Smažou se s ním i jeho hodnoty.")}</p>
        <div className="tt-row">
          <button className="tt-btn is-sm" onClick={close}>
            {t("Cancel", "Zrušit")}
          </button>
          <button className="tt-btn is-sm is-danger" onClick={remove}>
            {t("Delete column", "Smazat sloupec")}
          </button>
        </div>
      </div>
    );
  return (
    <div className={`tt-pop tt-colmenu${right ? " is-right" : ""}`} ref={ref} role="menu" aria-label={t(`${c.name} column`, `Sloupec ${c.name}`)}>
      <input
        className="tt-field"
        value={name}
        aria-label={t("Column name", "Název sloupce")}
        onChange={(e) => setName(e.target.value)}
        onBlur={keep}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            keep();
            close();
          }
        }}
      />
      <button role="menuitem" onClick={edit}>
        <I n="adjustments-horizontal" /> {t("Edit column", "Upravit sloupec")} {c.description && <span className="tt-tag">{t("Described", "Popsaný")}</span>}
      </button>
      <button role="menuitem" onClick={hide}>
        <I n="eye-off" /> {t("Hide column", "Skrýt sloupec")}
      </button>
      <button role="menuitem" className="is-danger" onClick={ask}>
        <I n="trash" /> {t("Delete column", "Smazat sloupec")}
      </button>
    </div>
  );
}

function NewColumn({ n, close, create }: { n: number; close: () => void; create: (c: Omit<Column, "id">) => void }) {
  const lang = useLang();
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(t(`Column ${n}`, `Sloupec ${n}`));
  const [type, setType] = useState<Type>("text");
  const [allowed, setAllowed] = useState<Allowed>("any");
  const [values, setValues] = useState<string[]>([]);
  useOutside(ref, true, close);
  const list = allowed !== "any";
  return (
    <div className="tt-pop tt-colmenu tt-newcolpop is-right" ref={ref} role="dialog" aria-label={t("New column", "Nový sloupec")}>
      <b>{t("New column", "Nový sloupec")}</b>
      <input className="tt-field" autoFocus value={name} placeholder={t("Column name", "Název sloupce")} aria-label={t("Column name", "Název sloupce")} onChange={(e) => setName(e.target.value)} />
      <label className="tt-fieldl">
        <span className="tt-label">{t("Type", "Typ")}</span>
        <Pick value={type} label={t("Type", "Typ")} options={TYPE_ORDER.map((ty) => [ty, say(lang, TYPES[ty].name), TYPES[ty].icon])} onPick={setType} compact />
      </label>
      <label className="tt-fieldl">
        <span className="tt-label">{t("Allowed values", "Povolené hodnoty")}</span>
        <Pick value={allowed} label={t("Allowed values", "Povolené hodnoty")} options={(Object.keys(ALLOWED) as Allowed[]).map((k) => [k, say(lang, ALLOWED[k])])} onPick={setAllowed} compact />
      </label>
      {list && (
        <div>
          <span className="tt-label">{t("List values", "Hodnoty seznamu")}</span>
          <ListValues values={values} set={setValues} />
        </div>
      )}
      <button className="tt-btn is-primary is-sm" disabled={!name.trim() || (list && !values.length)} onClick={() => create({ name: name.trim(), type, allowed, values })}>
        {t("Create column", "Vytvořit sloupec")}
      </button>
    </div>
  );
}

/** The Edit column window, in the card beside the table: what the column
 *  holds, then its settings - saved together. */
function EditColumn({ c, rows, close, save }: { c: Column; rows: Row[]; close: () => void; save: (p: Partial<Column>) => void }) {
  const lang = useLang();
  const t = useT();
  const [d, setD] = useState<Column>(c);
  const [negative, setNegative] = useState<"allowed" | "no">("allowed");
  const [places, setPlaces] = useState("as");
  const [misfits, setMisfits] = useState<"keep" | "clear">("keep");
  const vals = rows.map((r) => (r.v[c.id] ?? "").trim());
  const filled = vals.filter(Boolean);
  const num = d.type !== "text" && d.type !== "bool" && d.type !== "date";
  const nums = num ? filled.map((v) => readFigure(lang, v.replace(/\s*(Kč|CZK|€|EUR|%)$/i, ""))).filter((x): x is number => x !== null) : [];
  const locale = lang === "cs" ? "cs-CZ" : "en-GB";
  const fact = (k: string, v: ReactNode) => (
    <div>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
  return (
    <Side
      icon={<I n="adjustments-horizontal" />}
      title={t(`Edit column · ${c.name}`, `Upravit sloupec · ${c.name}`)}
      right={
        <button className="tt-x" aria-label={t("Close", "Zavřít")} onClick={close}>
          <I n="x" />
        </button>
      }
      foot={
        <>
          <button className="tt-btn is-sm" onClick={close}>
            {t("Cancel", "Zrušit")}
          </button>
          <button className="tt-btn is-sm is-primary" onClick={() => save(d)} disabled={d.allowed !== "any" && !d.values.length}>
            {t("Save", "Uložit")}
          </button>
        </>
      }
    >
      <div className="tt-setup">
        <p className="tt-note">
          {say(lang, TYPES[d.type].name)}
          {d.key ? t(" · key column", " · klíčový sloupec") : ""} · {t("SQL name", "název v SQL")} <code>{c.id}</code>
        </p>
        <dl className="tt-facts">
          {fact(t("Filled", "Vyplněno"), filled.length)}
          {fact(t("Empty", "Prázdné"), vals.length - filled.length)}
          {fact(t("Distinct", "Různých"), new Set(filled).size)}
          {nums.length > 0 && fact("Minimum", Math.min(...nums).toLocaleString(locale))}
          {nums.length > 0 && fact("Maximum", Math.max(...nums).toLocaleString(locale))}
        </dl>
        <span className="tt-note">{t(`Of the ${rowsN(lang, rows.length)} in the grid`, `Z ${rows.length} ${rows.length === 1 ? "řádku" : "řádků"} v tabulce`)}</span>
        <label className="tt-fieldl">
          <span className="tt-label">{t("Description", "Popis")}</span>
          <input className="tt-field" value={d.description ?? ""} placeholder={t("What this column holds", "Co sloupec obsahuje")} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </label>
        <label className="tt-fieldl">
          <span className="tt-label">{t("Type", "Typ")}</span>
          <Pick value={d.type} label={t("Type", "Typ")} options={TYPE_ORDER.map((ty) => [ty, say(lang, TYPES[ty].name), TYPES[ty].icon])} onPick={(ty) => setD({ ...d, type: ty })} />
        </label>
        <label className="tt-check" title={t("Identifies a row", "Jednoznačně určuje řádek")}>
          <input type="checkbox" checked={!!d.key} onChange={(e) => setD({ ...d, key: e.target.checked })} /> {t("Key column", "Klíčový sloupec")}
        </label>
        {num && (
          <div className="tt-row2">
            <div>
              <span className="tt-label">{t("Negative numbers", "Záporná čísla")}</span>
              <span className="tt-seg" role="radiogroup" aria-label={t("Negative numbers", "Záporná čísla")}>
                {(["allowed", "no"] as const).map((k) => (
                  <button key={k} role="radio" aria-checked={negative === k} onClick={() => setNegative(k)}>
                    {k === "allowed" ? t("Allowed", "Povolena") : t("Not allowed", "Zakázána")}
                  </button>
                ))}
              </span>
            </div>
            <div>
              <span className="tt-label">{t("Decimal places", "Desetinná místa")}</span>
              <Pick value={places} label={t("Decimal places", "Desetinná místa")} options={["as", "0", "1", "2", "3", "4"].map((p) => [p, p === "as" ? t("As entered", "Jak bylo zadáno") : p])} onPick={setPlaces} compact />
            </div>
          </div>
        )}
        <div>
          <span className="tt-label">{t("Values that don't fit", "Hodnoty, které neodpovídají")}</span>
          <span className="tt-seg" role="radiogroup" aria-label={t("Values that don't fit", "Hodnoty, které neodpovídají")}>
            {(["keep", "clear"] as const).map((k) => (
              <button key={k} role="radio" aria-checked={misfits === k} onClick={() => setMisfits(k)}>
                {k === "keep" ? t("Keep and flag", "Ponechat a označit") : t("Clear", "Vymazat")}
              </button>
            ))}
          </span>
          <p className="tt-note">{t("Applies now and to future imports", "Platí hned i pro další importy")}</p>
        </div>
        <label className="tt-fieldl">
          <span className="tt-label">{t("Allowed values", "Povolené hodnoty")}</span>
          <Pick value={d.allowed} label={t("Allowed values", "Povolené hodnoty")} options={(Object.keys(ALLOWED) as Allowed[]).map((k) => [k, say(lang, ALLOWED[k])])} onPick={(a) => setD({ ...d, allowed: a })} />
        </label>
        {d.allowed !== "any" && (
          <div>
            <span className="tt-label">{t("List values", "Hodnoty seznamu")}</span>
            <ListValues values={d.values} set={(v) => setD({ ...d, values: v })} />
          </div>
        )}
      </div>
    </Side>
  );
}

/** A row's details, the app's row drawer opened by the door beside its number: each column's
 *  value under its type's icon, and how many of History's edits are this row's. */
function RowDetails({ r, n, cols, value, hist, close }: { r: Row; n: number; cols: Column[]; value: (r: Row, c: string) => string; hist: Entry[]; close: () => void }) {
  const lang = useLang();
  const t = useT();
  const edits = hist.filter((e) => e.row === n && e.from !== undefined && !e.undone).length;
  return (
    <Side
      icon={<I n="list-details" />}
      title={t(`Row ${n}`, `Řádek ${n}`)}
      sub={r.v.product || t("Row details", "Detail řádku")}
      right={
        <button className="tt-btn is-icon is-sm" aria-label={t("Close", "Zavřít")} title={t("Close", "Zavřít")} onClick={close}>
          <I n="x" />
        </button>
      }
      foot={
        <span className="tt-note">
          {edits
            ? `${count(lang, edits, ["edit", "edits"], ["úprava", "úpravy", "úprav"])}${t(" of this row in History", " tohoto řádku v historii")}`
            : t("No edits of this row yet", "Tento řádek zatím nikdo neupravil")}
        </span>
      }
    >
      <dl className="tt-rowfacts">
        {cols.map((c) => (
          <div key={c.id}>
            <dt>
              <I n={TYPES[c.type].icon} />
              {c.name}
            </dt>
            <dd>{value(r, c.id) || "—"}</dd>
          </div>
        ))}
      </dl>
    </Side>
  );
}

/** The History beside the table: every edit, newest first, each with its
 *  Undo - or Restore, once undone. */
function History({ hist, flip, reset, nudge }: { hist: Entry[]; flip: (e: Entry) => void; reset: () => void; nudge?: number }) {
  const t = useT();
  // The person is kept by name; "You" alone reads differently in Czech.
  const who = (by: string) => (by === "You" ? t("You", "Vy") : by);
  return (
    <Side
      icon={<I n="history" />}
      title={t("History", "Historie")}
      sub={t("each edit can be undone", "každou úpravu lze vrátit")}
      foot={
        <>
          <span className="tt-note">{t("Every edit to this table, by everyone who keeps it.", "Každá úprava této tabulky, od všech, kdo ji vedou.")}</span>
          <button className="tt-link" onClick={reset}>
            {t("Start over", "Začít znovu")}
          </button>
        </>
      }
    >
      {hist.length === 0 ? (
        <div className="tt-hist-empty">
          <I n="pencil" />
          <p>
            {t(
              "Click any cell and type. Try a word in Plan (CZK), or pick from Region and Channels. Every edit lands here, and each one can be undone.",
              "Klikněte do libovolné buňky a pište. Zkuste napsat slovo do sloupce Plán (Kč) nebo vybrat hodnotu ve sloupcích Region a Kanály. Každá úprava se zapíše sem a každou lze vrátit.",
            )}
          </p>
        </div>
      ) : (
        <ol className="tt-hist">
          {hist.map((e) => (
            <li key={e.id} className={e.undone ? "is-undone" : ""}>
              <span className={`tt-av is-${e.by.toLowerCase()}`} title={who(e.by)} aria-hidden>
                {who(e.by)[0]}
              </span>
              <span>
                <b>
                  {e.what}
                  {e.col ? ` · ${e.col}` : ""}
                  {e.row ? t(`, row ${e.row}`, `, řádek ${e.row}`) : ""}
                </b>
                {e.from !== undefined && (
                  <small>
                    <s>{e.from || "—"}</s> → {e.to || "—"}
                  </small>
                )}
                <small className="tt-by">
                  {who(e.by)} · {e.at}
                </small>
              </span>
              <button className={`tt-btn is-sm${nudge === e.id ? " is-nudge" : ""}`} onClick={() => flip(e)}>
                {e.undone ? t("Restore", "Obnovit") : t("Undo", "Vrátit")}
              </button>
            </li>
          ))}
        </ol>
      )}
    </Side>
  );
}

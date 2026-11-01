import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { FLAGS } from "./flags";

/**
 * The page in two languages, English and Czech (owner, 2026-11-01: "the whole site in Czech
 * and English, values in English too"). Every text sits beside its other language where it
 * is used - t("English", "Česky") - rather than in a catalogue far from it, so a sentence and
 * its translation are read and changed together. The demo's example data comes in both
 * languages too: Czech values read the Czech way, English values the English way.
 *
 * The language is picked once from what the visitor chose last (kept in this browser), else
 * from the browser's own language, and is switched in the header. The page's <html lang> and
 * title follow it. With the czech flag off (src/flags.ts) the page is English, always.
 */

export type Lang = "en" | "cs";

const KEY = "appolino.lang";
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

function first(): Lang {
  if (!FLAGS.czech) return "en";
  try {
    const kept = localStorage.getItem(KEY);
    if (kept === "en" || kept === "cs") return kept;
  } catch {
    /* storage can be closed (a private window): fall back to the browser's language */
  }
  return typeof navigator !== "undefined" && /^(cs|sk)\b/i.test(navigator.language) ? "cs" : "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(first);
  const setLang = useCallback((l: Lang) => {
    if (!FLAGS.czech) return;
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* not kept: the choice still holds for this visit */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === "cs" ? "appolino · Datová platforma pro firemní týmy" : "appolino · The data platform for business teams";
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx).lang;
export const useSetLang = () => useContext(Ctx).setLang;

/** The text in the page's language: t("English", "Česky"). Works for any value, not only
 *  strings - t(EN_ROWS, CS_ROWS) picks a whole data set. */
export function useT() {
  const lang = useLang();
  return useCallback(<V,>(en: V, cs: V): V => (lang === "cs" ? cs : en), [lang]);
}

/** The same, outside React (the canvases): the language the page is shown in now. */
export const pageLang = (): Lang => (typeof document !== "undefined" && document.documentElement.lang === "cs" ? "cs" : "en");

/** A number as each language writes it: 12 840,50 in Czech, 12,840.50 in English. */
export const num = (lang: Lang, n: number, places = 2) =>
  n.toLocaleString(lang === "cs" ? "cs-CZ" : "en-GB", { minimumFractionDigits: places, maximumFractionDigits: places });
/** A whole number: 12 840 / 12,840. */
export const whole = (lang: Lang, n: number) => n.toLocaleString(lang === "cs" ? "cs-CZ" : "en-GB");

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** An ISO date (2026-01-31) as each language writes it: 31. 1. 2026 or 31 Jan 2026 - both
 *  read back by readDate. */
export const day = (lang: Lang, iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return lang === "cs" ? `${+m[3]}. ${+m[2]}. ${m[1]}` : `${+m[3]} ${MON[+m[2] - 1]} ${m[1]}`;
};

/** A count with its noun in the right form: English one/many; Czech one, two to four, five
 *  and more (1 řádek, 3 řádky, 7 řádků). */
export const count = (lang: Lang, n: number, en: [string, string], cs: [string, string, string]) => {
  if (lang === "en") return `${n} ${n === 1 ? en[0] : en[1]}`;
  return `${n} ${n === 1 ? cs[0] : n >= 2 && n <= 4 ? cs[1] : cs[2]}`;
};

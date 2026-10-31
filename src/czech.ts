/**
 * How Appolino reads the values Czech teams write, after the app's own readers
 * (backend/app/services/numbers.py, dates.py, booleans.py, patterns.py and the
 * masking in ai_payload.py). Small and exact enough for the demos on this page.
 */

/** "1 234,50", "1.234,50", "12 840" and "220,789,550" read as numbers. A space or
 *  dot counts as a thousands separator only when it groups digits in threes, so
 *  a postcode such as "110 00" stays text. */
export function readNumber(raw: string): number | null {
  const s = raw.trim().replace(/ /g, " ");
  if (!s) return null;
  if (/^-?\d+$/.test(s)) return Number(s);
  // Czech: spaces or dots in threes, a comma before the decimals.
  let m = s.match(/^(-?\d{1,3}(?:[ .]\d{3})*)(?:,(\d+))?$/);
  if (m) return Number(m[1].replace(/[ .]/g, "") + (m[2] ? "." + m[2] : ""));
  // English: commas in threes, a dot before the decimals.
  m = s.match(/^(-?\d{1,3}(?:,\d{3})*)(?:\.(\d+))?$/);
  if (m) return Number(m[1].replace(/,/g, "") + (m[2] ? "." + m[2] : ""));
  return null;
}

const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number | string) => String(n).padStart(2, "0");

/** "15. 1. 2026", "15.1.2026", "2026-01-15", "15/01/2026" and "15 Jan 26" are
 *  dates; a day that does not exist (31. 4. 2026) is empty, not an error. */
export function readDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, mo: number, d: number;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})$/))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{2,4})$/))) {
    d = +m[1];
    mo = MON.indexOf(m[2].toLowerCase()) + 1;
    y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  } else return null;
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

const YES = ["ano", "yes", "y", "true", "pravda", "ja", "oui"];
const NO = ["ne", "no", "n", "false", "nepravda", "nein", "non"];
export function readBool(raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  return YES.includes(s) ? true : NO.includes(s) ? false : null;
}

/** IČO: eight digits whose last is a check digit over the first seven. */
export function icoOk(s: string): boolean {
  if (!/^\d{8}$/.test(s)) return false;
  const d = s.split("").map(Number);
  let a = 0;
  for (let i = 0; i < 7; i++) a += d[i] * (8 - i);
  a %= 11;
  const c = a === 0 ? 1 : a === 1 ? 0 : 11 - a;
  return c === d[7];
}

/** What the assistant is sent instead of a value: its shape. A capital letter is
 *  X, a small one x, a digit 9; punctuation stays, at most 40 characters. */
export function mask(v: string): string {
  return v
    .slice(0, 40)
    .replace(/\p{Lu}/gu, "X")
    .replace(/\p{Ll}/gu, "x")
    .replace(/\d/g, "9");
}

/** Values folded the way "Make values consistent" groups them: case, accents,
 *  repeated spaces and a trailing dot. */
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "");

export const czk = (n: number) => n.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const int = (n: number) => n.toLocaleString("cs-CZ");
export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

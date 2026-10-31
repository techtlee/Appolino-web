import { useEffect, useRef, useState } from "react";
import { prefersLessMotion, useSeen } from "../motion";
import { icoOk, readBool, readDate, readNumber } from "../czech";

type X = { from: string; to: string; tone?: "bad" | "keep" };

const date = (s: string): X => {
  const d = readDate(s.replace(/ \d{1,2}:\d{2}$/, ""));
  const time = s.match(/ (\d{1,2}:\d{2})$/)?.[1];
  return d ? { from: s, to: time ? `${d} ${time}` : d } : { from: s, to: "empty · no such day", tone: "bad" };
};
const num = (s: string): X => {
  const n = readNumber(s);
  return n === null ? { from: s, to: "stays text", tone: "keep" } : { from: s, to: n.toFixed(2) };
};
const bool = (s: string): X => {
  const b = readBool(s);
  return b === null ? { from: s, to: "not yes or no", tone: "keep" } : { from: s, to: b ? "Yes" : "No" };
};
const ico = (s: string): X => (icoOk(s) ? { from: s, to: "✓ IČO check digit" } : { from: s, to: "✗ check digit", tone: "bad" });

const CARDS: { h: string; p: string; xs: X[]; fmts?: string[] }[] = [
  {
    h: "Dates as Czech Excel writes them",
    p: "The spaced form, the dotted one, ISO, with or without a time. A day that does not exist becomes empty instead of stopping the steps.",
    xs: [date("15. 1. 2026"), date("15.1.2026 14:30"), date("2026-01-15"), date("31. 4. 2026"), date("15 Jan 26")],
  },
  {
    h: "Numbers with spaces and commas",
    p: "Czech and English spellings both read. A separator counts only when it groups digits in threes, so a postcode stays a postcode.",
    xs: [num("1 234,50"), num("1.234,50"), num("220,789,550"), num("110 00")],
  },
  {
    h: "Ano, ne, and friends",
    p: "Yes and no are recognised in Czech, English, German, French and more. A column of 0 and 1 is never mistaken for one.",
    xs: [bool("ano"), bool("NE"), bool("pravda"), bool("1")],
  },
  {
    h: "IČO, IBAN and birth numbers",
    p: "Checks that know the IČO check digit, IBAN and ISIN shapes, e-mail, phone and postcode. Birth numbers and IBANs are proposed as personal.",
    xs: [ico("27082440"), ico("12345678"), { from: "CZ65 0800 0000 1920 0014 5399", to: "looks like an IBAN" }, { from: "856201/1234", to: "personal · never to AI", tone: "keep" }],
  },
  {
    h: "Files from Czech systems",
    p: "ISDOC e-invoices and GPC/ABO statements read with fixed columns. Amounts are exact decimals, debits signed, haléře converted.",
    fmts: ["ISDOC", "GPC / ABO", "camt.053", "MT940", "cp1250 text"],
    xs: [
      { from: "+00001284000 (haléře)", to: "12 840,00 CZK" },
      { from: "-00000245000 (haléře)", to: "−2 450,00 CZK" },
      { from: "CSV (oddělený středníkem)", to: "save as CSV UTF-8", tone: "bad" },
    ],
  },
  {
    h: "Records kept as long as the law asks",
    p: "The audit log keeps every change with the value before and after. An owner sets how long, from one year up to the ten-year accounting record period.",
    xs: [
      { from: "retention · default", to: "2 years" },
      { from: "retention · minimum", to: "1 year", tone: "keep" },
      { from: "retention · maximum", to: "10 years" },
    ],
  },
];

export function Czech() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.15);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!seen || prefersLessMotion()) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 2200);
    return () => clearInterval(id);
  }, [seen]);

  return (
    <section className="czech" id="czech">
      <div className="wrap" ref={ref}>
        <div className="sec-head">
          <p className="label">Built for Czech data</p>
          <h2>Reads your files the way your team writes them.</h2>
          <p className="intro">Most tools were built for English spreadsheets. Appolino reads Czech dates, amounts, IČO and bank files out of the box, so nobody fixes them by hand first.</p>
        </div>
        <div className="cz-grid">
          {CARDS.map((c, i) => {
            const x = c.xs[(tick + i) % c.xs.length];
            return (
              <div className="cz" key={c.h}>
                <h3>{c.h}</h3>
                <div className="xf" aria-live="off">
                  <span className="from swap" key={`f${tick}`}>
                    {x.from}
                  </span>
                  <span className="ar" aria-hidden>
                    →
                  </span>
                  <span className={`to swap ${x.tone ?? ""}`} key={`t${tick}`} style={{ animationDelay: ".12s" }}>
                    {x.to}
                  </span>
                </div>
                {c.fmts && (
                  <div className="fmts">
                    {c.fmts.map((f) => (
                      <span key={f} className="chip-ext">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                <p>{c.p}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

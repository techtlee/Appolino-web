import { useEffect, useRef, useState } from "react";
import { prefersLessMotion, useSeen } from "../motion";
import { mask } from "../czech";

const ITEMS: [string, string][] = [
  ["Google or Microsoft sign-in", "No passwords stored. Microsoft sign-in can be pinned to your directory and require MFA; nobody gets in without an invitation, your directory or your domain."],
  ["Roles, groups and row rules", "Viewer, editor, admin per project. Groups get read or write on sections and tables, and a row rule limits a group to, say, Region is Morava."],
  ["Restricted columns", "Salary or e-mail stays hidden from everyone but admins and the groups you name, in the grid, results, SQL, pipelines and run logs alike."],
  ["An audit log that lasts", "Every change with the value before and after, every sign-in and export, and every time an Appolino operator opened your data. Kept 1 to 10 years."],
  ["Your data, where you choose", "Appolino's managed database in the EU, or your own PostgreSQL. On Amazon RDS or Google Cloud SQL it connects through cloud identity, with no password at all."],
  ["AI with a budget", "Claude on Amazon Bedrock in Frankfurt by default, or your own key. A monthly stop in dollars, a daily limit per person, and a log of every call and what it sent."],
];

/** Values from one row, as the assistant receives them. */
const ROW: { c: string; v: string; no?: boolean }[] = [
  { c: "Customer", v: "Pekárna U Mlýna s.r.o." },
  { c: "City", v: "Praha" },
  { c: "Amount (CZK)", v: "12 840,00" },
  { c: "IČO", v: "27082440" },
  { c: "Contact e-mail", v: "objednavky@pekarna-mlyn.cz", no: true },
];

function Masking() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.4);
  const [p, setP] = useState(prefersLessMotion() ? 1 : 0);
  useEffect(() => {
    if (!seen || prefersLessMotion()) return;
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      // Mask, hold, unmask, hold: a loop of six seconds.
      const k = ((t - start) / 6000) % 1;
      setP(k < 0.3 ? k / 0.3 : k < 0.7 ? 1 : k < 0.85 ? 1 - (k - 0.7) / 0.15 : 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen]);

  return (
    <div className="masking" ref={ref}>
      <div>
        <h3>What the AI sees: the shape, never the value.</h3>
        <p>
          ✦ Ask is sent column names, types and a few masked shapes, so “Praha” leaves as “Xxxxx”. A column tagged personal is withheld entirely, for everyone, owners included.
          Columns Appolino recognises as e-mail, IBAN, birth number or phone are proposed for that tag.
        </p>
      </div>
      <div className="mask-rows">
        {ROW.map((r) => {
          const n = Math.round(r.v.length * p);
          return (
            <div key={r.c} className={`mask-row${r.no ? " no" : ""}`}>
              <span className="c">{r.c}</span>
              <span className="v">
                {r.no ? (
                  <span className="veil">withheld · never sent to AI</span>
                ) : (
                  <>
                    <span className="m">{mask(r.v.slice(0, n))}</span>
                    {r.v.slice(n)}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Trust() {
  return (
    <section className="trust" id="security">
      <div className="wrap">
        <h2>Built for companies, not side projects.</h2>
        <p className="intro" style={{ marginTop: 14 }}>
          What a finance or operations team needs before it moves its spreadsheets anywhere.
        </p>
        <Masking />
        <div className="trust-grid">
          {ITEMS.map(([h, d]) => (
            <div key={h}>
              <h3>{h}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

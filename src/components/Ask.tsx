import { useEffect, useRef, useState, type FormEvent } from "react";
import { prefersLessMotion } from "../motion";

/** Three questions this example answers, each with the step Appolino's Ask
 *  would offer and a few rows of what it gives. */
const ANSWERS = [
  {
    q: "Total revenue by customer for October",
    match: /revenue|total|sum|by customer/i,
    kind: "Result · SQL",
    code: "SELECT customer, SUM(amount) AS revenue\nFROM invoices\nWHERE date >= '2026-10-01' AND date < '2026-11-01'\nGROUP BY customer\nORDER BY revenue DESC",
    head: ["customer", "revenue"],
    rows: [
      ["Northwind Timber Ltd.", "12,840.00"],
      ["Mill Lane Bakery", "5,699.00"],
      ["Hillside Nursery", "3,120.00"],
    ],
  },
  {
    q: "Add the region from the Customers table to each invoice",
    match: /region|add|lookup|customers table/i,
    kind: "Step · Lookup",
    code: "Lookup  invoices.vat  →  customers.vat\nAdds column  region\nNot found  leave empty",
    head: ["customer", "region"],
    rows: [
      ["Northwind Timber Ltd.", "North West"],
      ["Mill Lane Bakery", "Midlands"],
      ["Green Yard plc", "South East"],
    ],
  },
  {
    q: "Flag invoices that are overdue",
    match: /overdue|flag|late|past due/i,
    kind: "Step · Formula",
    code: "status =\n  CASE WHEN due_date < CURRENT_DATE AND paid_on IS NULL\n       THEN 'Overdue'\n       ELSE 'OK' END",
    head: ["invoice", "status"],
    rows: [
      ["INV-2026-1182", "Overdue"],
      ["INV-2026-1183", "OK"],
      ["INV-2026-1184", "OK"],
    ],
  },
];

export function AskPanel() {
  const [text, setText] = useState("");
  const [ans, setAns] = useState<number | null>(0);
  const [miss, setMiss] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);
  const timer = useRef<number>();

  useEffect(() => () => clearInterval(timer.current), []);

  const ask = (i: number) => {
    clearInterval(timer.current);
    setAdded(null);
    setMiss(false);
    const q = ANSWERS[i].q;
    if (prefersLessMotion()) {
      setText(q);
      setAns(i);
      return;
    }
    // The question types itself in, then the step arrives.
    setAns(null);
    setTyping(true);
    let n = 0;
    timer.current = window.setInterval(() => {
      n += 2;
      setText(q.slice(0, n));
      if (n >= q.length) {
        clearInterval(timer.current);
        setTyping(false);
        setAns(i);
      }
    }, 22);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const i = ANSWERS.findIndex((a) => a.match.test(text));
    setAdded(null);
    if (i < 0) {
      setAns(null);
      setMiss(true);
    } else {
      setMiss(false);
      setAns(i);
    }
  };

  const a = ans === null ? null : ANSWERS[ans];

  return (
    <>
      <p className="panel-hint">Ask proposes a step and shows what it will do. Nothing changes until you add it. Demo with prepared answers.</p>
      <div className="ask">
          <div className="ask-side">
            <p className="label">Try one of these</p>
            {ANSWERS.map((x, i) => (
              <button key={x.q} className={`ask-chip${ans === i ? " on" : ""}`} onClick={() => ask(i)}>
                {x.q}
              </button>
            ))}
          </div>
          <div className="card ask-panel">
            <form className="ask-input" onSubmit={submit}>
              <span className="spark-ico" aria-hidden>
                ✦
              </span>
              <label htmlFor="ask-q" className="sr">
                What do you want to do with the table
              </label>
              <input
                id="ask-q"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What do you want to do with the table?"
                autoComplete="off"
              />
              <button className="btn sm" type="submit" disabled={typing || !text.trim()}>
                Ask
              </button>
            </form>

            {miss && (
              <p className="ask-miss">
                This demo only knows the three questions on the left. In Appolino, your organization's model answers
                anything about your tables.
              </p>
            )}
            {typing && (
              <p className="ask-wait">
                <b />
                <b />
                <b />
              </p>
            )}
            {a && (
              <div className="ask-step" key={ans}>
                <div className="ask-step-head">
                  <span className="tag quiet">{a.kind}</span>
                  <span className="label">Proposal · nothing changed yet</span>
                </div>
                <pre>{a.code}</pre>
                <div className="grid-scroll">
                  <table className="grid mini">
                    <thead>
                      <tr>
                        {a.head.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {a.rows.map((r) => (
                        <tr key={r[0]}>
                          {r.map((c, j) => (
                            <td key={j} className={/^[\d,.]+$/.test(c) ? "num" : ""}>
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {added === ans ? (
                  <p className="ok-line">
                    <b>✓</b> The step is in Steps. Undoing it is one click.
                  </p>
                ) : (
                  <div className="row">
                    <button className="btn sm" onClick={() => setAdded(ans)}>
                      Add step
                    </button>
                    <button className="ghost sm" onClick={() => setAns(null)}>
                      Discard
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
    </>
  );
}

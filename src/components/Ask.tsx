import { useEffect, useRef, useState, type FormEvent } from "react";
import { prefersLessMotion } from "../motion";
import { mask } from "../czech";

/**
 * ✦ Ask as built: pick a kind of help, write a sentence in Czech or English,
 * see exactly what leaves Appolino (names, types and masked shapes, never a
 * value), and get a draft step or check to preview, apply or take out. It never
 * writes SQL, and it does not answer questions about the data yet.
 */

type KindId = "clean" | "validate" | "transform";
type Answer = {
  q: string;
  match: RegExp;
  tag: string;
  title: string;
  summary: string;
  touches: string[];
  builder: string;
  preview: { head: string[]; rows: string[][]; hot: number };
  done: string;
};

const KINDS: { id: KindId; label: string; sub: string; placeholder: string; noticed?: [string, string][]; answers: Answer[] }[] = [
  {
    id: "clean",
    label: "Clean",
    sub: "Fix values in this table",
    placeholder: "Describe what to fix, e.g. Město is spelled several ways",
    noticed: [
      ["City", "4 spellings of “Praha”"],
      ["Invoice no.", "1 row is a copy of another"],
    ],
    answers: [
      {
        q: "sjednoť zápisy ve sloupci Město",
        match: /sjedno|město|mesto|city|spell|consistent/i,
        tag: "Draft step · Make values consistent",
        title: "Make City consistent",
        summary: "Three spellings become “Praha”: “PRAHA”, “Praha ” and “praha”.",
        touches: ["City"],
        builder: "Make values consistent",
        preview: { head: ["City before", "City after"], rows: [["PRAHA", "Praha"], ["Praha␣", "Praha"], ["praha", "Praha"]], hot: 1 },
        done: "Applied. The originals stay in History, and the next import arrives spelled the same way.",
      },
    ],
  },
  {
    id: "validate",
    label: "Validate",
    sub: "Find errors and add checks",
    placeholder: "Describe a rule, e.g. an amount is never negative",
    noticed: [
      ["Amount (CZK)", "1 value is not a number"],
      ["Status", "1 value is not in the list"],
    ],
    answers: [
      {
        q: "an amount is never negative",
        match: /negative|záporn|zaporn|below zero|never/i,
        tag: "Draft check · Not negative",
        title: "Amount (CZK) is never negative",
        summary: "A check on Faktury: Not negative, column Amount (CZK), severity Error - stops delivery.",
        touches: ["Amount (CZK)"],
        builder: "Not negative",
        preview: { head: ["Invoice no.", "Amount (CZK)"], rows: [["FV-2026-107", "−1 230,00"]], hot: 1 },
        done: "Added to Checks. It runs on every Validate, sync and pipeline run, and holds delivery while it fails.",
      },
    ],
  },
  {
    id: "transform",
    label: "Transform",
    sub: "Build a new table from this one",
    placeholder: "Describe what to calculate, e.g. each customer's share of the total",
    answers: [
      {
        q: "each customer's share of the total",
        match: /share|podíl|podil|percent|%/i,
        tag: "Draft step · Add calculated column",
        title: "share_of_total",
        summary: "A calculated column from the Share of total recipe, over Amount (CZK).",
        touches: ["Amount (CZK)"],
        builder: "Recipe · Share of total",
        preview: {
          head: ["Customer", "Amount (CZK)", "share_of_total"],
          rows: [
            ["Pekárna U Mlýna s.r.o.", "12 840,00", "45,1 %"],
            ["Zahradnictví Hájek", "5 699,00", "20,0 %"],
            ["Truhlářství Novák", "6 000,00", "21,1 %"],
          ],
          hot: 2,
        },
        done: "Applied as a step. Save the steps as a result table and it recalculates when Faktury changes.",
      },
      {
        q: "total amount by month",
        match: /month|měsíc|mesic|pivot|by month|total/i,
        tag: "Draft step · Pivot",
        title: "Total by month",
        summary: "Rows: Date grouped by month. Values: Sum of Amount (CZK).",
        touches: ["Date", "Amount (CZK)"],
        builder: "Pivot",
        preview: { head: ["Month", "Sum of Amount (CZK)"], rows: [["2026-08", "214 380,00"], ["2026-09", "198 655,50"], ["2026-10", "28 504,50"]], hot: 1 },
        done: "Applied as a step. A pivot saved as a result updates itself.",
      },
      {
        q: "add the region from Zákazníci by IČO",
        match: /region|zákazn|zakazn|lookup|ičo|ico/i,
        tag: "Draft step · Lookup",
        title: "Region from Zákazníci",
        summary: "Lookup (keep this table's rows): match IČO to Zákazníci.IČO, add Region.",
        touches: ["IČO"],
        builder: "Lookup",
        preview: { head: ["Customer", "IČO", "Region"], rows: [["Pekárna U Mlýna s.r.o.", "27082440", "Praha"], ["Zahradnictví Hájek", "25596641", "Jihomoravský"], ["Elektro Svoboda a.s.", "27936520", "Moravskoslezský"]], hot: 2 },
        done: "Applied as a step. The number of rows never changes with this kind of lookup.",
      },
    ],
  },
];

/** What the model is sent about the table. */
const SENT: { col: string; type: string; values: string[] }[] = [
  { col: "Customer", type: "Text", values: ["Pekárna U Mlýna s.r.o.", "Zahradnictví Hájek"] },
  { col: "City", type: "Text", values: ["Praha", "PRAHA"] },
  { col: "Date", type: "Date", values: ["2026-10-03"] },
  { col: "Amount (CZK)", type: "Decimal", values: ["12 840,00", "845,00"] },
];

/** Replaces a value's characters with its shape, left to right, as p goes 0→1. */
const morph = (v: string, p: number) => {
  const n = Math.round(v.length * p);
  return mask(v.slice(0, n)) + v.slice(n);
};

type Phase = "idle" | "typing" | "sending" | "thinking" | "card";

export function AskPanel() {
  const [kind, setKind] = useState<KindId>("clean");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [ans, setAns] = useState<Answer | null>(null);
  const [state, setState] = useState<"draft" | "preview" | "applied" | "removed">("draft");
  const [note, setNote] = useState<string | null>(null);
  const [p, setP] = useState(0);
  const [asks, setAsks] = useState(2);
  const timers = useRef<number[]>([]);
  const raf = useRef(0);

  const K = KINDS.find((k) => k.id === kind)!;
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    cancelAnimationFrame(raf.current);
  };
  useEffect(() => clear, []);

  const run = (q: string) => {
    clear();
    setNote(null);
    setAns(null);
    setState("draft");
    if (/\?|how much|kolik|what was|what is/i.test(q)) {
      setPhase("idle");
      setNote("Ask does not answer questions about the data yet. It turns a sentence into a step, a check or a fix, and says so when nothing fits. Nothing was sent.");
      return;
    }
    const a = K.answers.find((x) => x.match.test(q));
    if (!a) {
      setPhase("idle");
      setNote("This demo knows one sentence per example. The real Ask turns any sentence into a step it validates first; if none fits, it says so and nothing changes.");
      return;
    }
    setAsks((n) => n + 1);
    if (prefersLessMotion()) {
      setP(1);
      setAns(a);
      setPhase("card");
      return;
    }
    setPhase("sending");
    setP(0);
    const start = performance.now();
    const tick = (now: number) => {
      const v = Math.min(1, (now - start) / 1300);
      setP(v);
      if (v < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    timers.current.push(window.setTimeout(() => setPhase("thinking"), 2100));
    timers.current.push(
      window.setTimeout(() => {
        setAns(a);
        setPhase("card");
      }, 3000),
    );
  };

  const example = (q: string) => {
    clear();
    if (prefersLessMotion()) {
      setText(q);
      return run(q);
    }
    setPhase("typing");
    setAns(null);
    setNote(null);
    let n = 0;
    const id = window.setInterval(() => {
      n += 2;
      setText(q.slice(0, n));
      if (n >= q.length) {
        clearInterval(id);
        run(q);
      }
    }, 24);
    timers.current.push(id);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) run(text);
  };

  const switchKind = (k: KindId) => {
    clear();
    setKind(k);
    setText("");
    setPhase("idle");
    setAns(null);
    setNote(null);
  };

  return (
    <>
      <p className="panel-hint">Pick a kind of help and try a sentence. Watch what is sent: column names, types and masked shapes, never a value. Prepared answers.</p>
      <div className="ask">
        <div className="ask-side">
          <div className="kind-list" role="radiogroup" aria-label="Kind of help">
            {KINDS.map((k) => (
              <button key={k.id} role="radio" aria-checked={kind === k.id} className={`ask-kind${kind === k.id ? " on" : ""}`} onClick={() => switchKind(k.id)}>
                <b>{k.label}</b>
                <small>{k.sub}</small>
              </button>
            ))}
          </div>
          {K.noticed && (
            <div className="noticed">
              <p className="label">Noticed, without a model</p>
              {K.noticed.map(([c, t]) => (
                <p key={t}>
                  <span>{c}</span> {t} <em>Fix…</em>
                </p>
              ))}
            </div>
          )}
          <p className="label">{K.noticed ? "Or try" : "For example"}</p>
          {K.answers.map((a) => (
            <button key={a.q} className="ask-chip" onClick={() => example(a.q)}>
              {a.q}
            </button>
          ))}
        </div>

        <div className="card ask-panel">
          <div className="ask-top">
            <span className="label">
              <span className="spark-ico">✦</span> Ask AI · {K.label} · nothing changes until you apply it
            </span>
          </div>
          <form className="ask-input" onSubmit={submit}>
            <label htmlFor="ask-q" className="sr">
              Describe what you want
            </label>
            <input id="ask-q" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={K.placeholder} autoComplete="off" />
            <button className="btn sm" type="submit" disabled={phase === "typing" || phase === "sending" || phase === "thinking" || !text.trim()}>
              Ask
            </button>
          </form>

          {note && <p className="ask-miss">{note}</p>}

          {(phase === "sending" || phase === "thinking" || phase === "card") && (
            <details className="sent" open={phase !== "card"}>
              <summary>
                <span className="label">What leaves Appolino</span>
                <span className="label">{SENT.length} columns · {SENT.reduce((n, s) => n + s.values.length, 0)} shapes · 1 withheld</span>
              </summary>
              <table className="grid mini">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Type</th>
                    <th>Shapes sent</th>
                  </tr>
                </thead>
                <tbody>
                  {SENT.map((s) => (
                    <tr key={s.col}>
                      <td>{s.col}</td>
                      <td className="txt">{s.type}</td>
                      <td className="mono">{s.values.map((v) => morph(v, p)).join("   ")}</td>
                    </tr>
                  ))}
                  <tr className="withheld">
                    <td>Contact e-mail</td>
                    <td className="txt">Text</td>
                    <td>
                      <span className="veil">withheld · tagged personal, never sent to AI</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </details>
          )}

          {phase === "thinking" && (
            <p className="ask-wait" aria-label="Thinking">
              <b />
              <b />
              <b />
            </p>
          )}

          {phase === "card" && ans && (
            <div className={`ask-card ${state}`} key={ans.q}>
              <div className="ask-step-head">
                <span className="tag quiet">{ans.tag}</span>
                <span className="label">
                  {state === "applied" ? "Applied" : state === "removed" ? "Taken out" : state === "preview" ? "Drafted by Ask - check a few rows before applying" : "Proposal · nothing changed yet"}
                </span>
              </div>
              <h3>{ans.title}</h3>
              <p className="fd">{ans.summary}</p>
              <p className="touch">
                <span className="label">Touches</span>
                {ans.touches.map((t) => (
                  <code key={t}>{t}</code>
                ))}
                <span className="label">Built with</span>
                <code>{ans.builder}</code>
              </p>
              {(state === "preview" || state === "applied") && (
                <div className="grid-scroll prev-in">
                  <table className="grid mini">
                    <thead>
                      <tr>
                        {ans.preview.head.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ans.preview.rows.map((r, i) => (
                        <tr key={i} className="row-in" style={{ animationDelay: `${i * 0.08}s` }}>
                          {r.map((c, j) => (
                            <td key={j} className={j === ans.preview.hot ? "draft" : /^[−\d\s,%.]+$/.test(c) ? "num" : ""}>
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {state === "applied" ? (
                <p className="ok-line">
                  <b>✓</b> {ans.done}
                </p>
              ) : state === "removed" ? (
                <p className="note">Taken out. The table is as it was.</p>
              ) : (
                <div className="row">
                  {state === "draft" && (
                    <button className="btn2 sm" onClick={() => setState("preview")}>
                      Preview
                    </button>
                  )}
                  <button className="btn sm" onClick={() => setState("applied")}>
                    {kind === "validate" ? "Add check" : "Apply"}
                  </button>
                  <button className="ghost sm" onClick={() => setState("removed")}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="ask-foot">
            <span className="meter">
              <span style={{ width: `${(3.12 + asks * 0.04) / 0.5}%` }} />
            </span>
            <span className="label">
              ${(3.12 + asks * 0.04).toFixed(2)} of the $50 monthly stop · {asks} of 200 asks today · Claude on Amazon Bedrock, Frankfurt
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

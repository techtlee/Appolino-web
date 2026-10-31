import { useLayoutEffect, useRef, useState } from "react";

/**
 * Who sees what in one table, as Appolino decides it: a role per project,
 * groups, a row rule on Region, a column restricted to a group, a column tagged
 * personal (never sent to AI), and an audit log that records every look and
 * change with the value before and after. The people are invented.
 */

type Person = "jana" | "petr" | "eva";
const PEOPLE: { id: Person; name: string; role: "Viewer" | "Editor" | "Admin"; groups: string[] }[] = [
  { id: "jana", name: "Jana", role: "Viewer", groups: ["Sales Morava"] },
  { id: "petr", name: "Petr", role: "Editor", groups: ["Finance"] },
  { id: "eva", name: "Eva", role: "Admin", groups: [] },
];

const COLS = [
  { k: "no", t: "Invoice no." },
  { k: "customer", t: "Customer" },
  { k: "region", t: "Region" },
  { k: "amount", t: "CZK", num: true },
  { k: "margin", t: "Margin", num: true, tag: "finance", by: "Finance" },
  { k: "email", t: "E-mail", tag: "personal", by: "" },
] as const;
type K = (typeof COLS)[number]["k"];
const ROWS: Record<K, string>[] = [
  { no: "FV-2026-101", customer: "Pekárna U Mlýna", region: "Čechy", amount: "12 840,00", margin: "31 %", email: "mlyn@pekarna.cz" },
  { no: "FV-2026-102", customer: "Zahradnictví Hájek", region: "Morava", amount: "5 699,00", margin: "24 %", email: "hajek@zahrady.cz" },
  { no: "FV-2026-104", customer: "Truhlářství Novák", region: "Morava", amount: "6 000,00", margin: "18 %", email: "novak@truhlar.cz" },
  { no: "FV-2026-105", customer: "Kavárna Na Rohu", region: "Čechy", amount: "845,00", margin: "40 %", email: "rohu@kavarna.cz" },
  { no: "FV-2026-106", customer: "Elektro Svoboda", region: "Morava", amount: "3 120,50", margin: "12 %", email: "info@svoboda.cz" },
];

function sees(p: (typeof PEOPLE)[number], c: (typeof COLS)[number]) {
  if (!("tag" in c)) return true;
  if (p.role === "Admin") return true;
  return c.by !== "" && p.groups.includes(c.by);
}
const rowOk = (p: (typeof PEOPLE)[number], r: Record<K, string>) => !p.groups.includes("Sales Morava") || r.region === "Morava";

let clockMin = 41;
const stamp = () => {
  clockMin += 1;
  return `9:${String(clockMin % 60).padStart(2, "0")}`;
};

export function AccessPanel() {
  const [who, setWho] = useState<Person>("jana");
  const [log, setLog] = useState<{ t: string; at: string; id: number; kind: string }[]>([
    { t: "Jana opened Faktury: 3 of 5 rows, 2 columns hidden", at: "9:41", id: 2, kind: "Read" },
    { t: "Petr changed Amount on FV-2026-104: “6k” → 6 000,00", at: "9:12", id: 1, kind: "Data edit" },
    { t: "Eva tagged E-mail as personal · never sent to AI", at: "8:55", id: 0, kind: "Access" },
  ]);
  const segRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ left: 3, width: 0 });

  useLayoutEffect(() => {
    const place = () => {
      const b = segRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
      if (b) setKnob({ left: b.offsetLeft, width: b.offsetWidth });
    };
    place();
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, [who]);

  const P = PEOPLE.find((p) => p.id === who)!;
  const rows = ROWS.filter((r) => rowOk(P, r));
  const hidden = COLS.filter((c) => !sees(P, c));
  const add = (t: string, kind: string) => setLog((l) => [{ t, at: stamp(), id: l[0].id + 1, kind }, ...l].slice(0, 5));

  const pick = (p: Person) => {
    if (p === who) return;
    setWho(p);
    const Q = PEOPLE.find((x) => x.id === p)!;
    const n = ROWS.filter((r) => rowOk(Q, r)).length;
    const h = COLS.filter((c) => !sees(Q, c)).length;
    add(`${Q.name} opened Faktury: ${n} of ${ROWS.length} rows${h ? `, ${h} ${h === 1 ? "column" : "columns"} hidden` : ", restricted columns included"}`, "Read");
  };

  return (
    <>
      <p className="panel-hint">Switch the person. A row rule, a restricted column and a personal column decide what each one sees; every look and change lands in the audit log.</p>
      <div className="access">
        <div className="card access-card">
          <div className="access-top">
            <p className="label">Faktury, as seen by</p>
            <div className="seg" role="radiogroup" aria-label="Person" ref={segRef}>
              <span className="knob" style={knob} aria-hidden />
              {PEOPLE.map((p) => (
                <button key={p.id} role="radio" aria-checked={who === p.id} onClick={() => pick(p.id)}>
                  {p.name} · {p.role}
                </button>
              ))}
            </div>
          </div>
          <div className="grid-scroll">
            <table className="grid" key={who}>
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th key={c.k} className={`${"num" in c ? "num " : ""}${sees(P, c) ? "" : "hidden-col"}`}>
                      {c.t}
                      {"tag" in c && <span className={`ctag ${c.tag}`}>{c.tag}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.no} className="row-in" style={{ animationDelay: `${i * 0.05}s` }}>
                    {COLS.map((c) => (
                      <td key={c.k} className={`${"num" in c ? "num " : ""}${c.k === "email" ? "trunc " : ""}${sees(P, c) ? "" : "hidden-col"}`}>
                        {sees(P, c) ? <span className="tr">{r[c.k]}</span> : <span className="veil">hidden</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            {rows.length < ROWS.length ? `${ROWS.length - rows.length} rows hidden by the row rule of Sales Morava: Region is Morava. ` : "Every row. "}
            The same rules apply inside PostgreSQL for BI tools, through a login per group.
          </p>
        </div>

        <div className="access-side">
          <div className="glass can" key={who}>
            <p className="label">What can {P.name} see?</p>
            <ul className="facts">
              <li>
                <span>Role</span>
                <b>{P.role}</b>
                {P.role === "Admin" ? " · sees every row and column" : P.role === "Editor" ? " · builds and changes tables, results, pipelines" : " · reads, makes own charts"}
              </li>
              <li>
                <span>Groups</span>
                <b>{P.groups.length ? P.groups.join(", ") : "none needed"}</b>
              </li>
              <li>
                <span>Rows</span>
                <b>
                  {rows.length} of {ROWS.length}
                </b>
                {rows.length < ROWS.length ? " · from Sales Morava's row rule" : ""}
              </li>
              <li>
                <span>Hidden</span>
                <b>{hidden.length ? hidden.map((c) => c.t).join(", ") : "nothing"}</b>
                {hidden.length ? (P.role === "Editor" ? " · editors see a restricted column only through a group its tag names" : " · tags name other groups") : ""}
              </li>
            </ul>
            {P.role === "Editor" && <p className="note">Petr can still edit the other cells, but cannot add steps, SQL or a pipeline over E-mail.</p>}
          </div>
          <div className="glass audit-log">
            <div className="log-top">
              <p className="label">Audit log · project</p>
              <button className="ghost sm" onClick={() => add("Eva exported the audit log as CSV", "Export")}>
                Export CSV
              </button>
            </div>
            <ul>
              {log.map((e) => (
                <li key={e.id}>
                  <span className="at">{e.at}</span>
                  <span>
                    <small>{e.kind}</small>
                    {e.t}
                  </span>
                </li>
              ))}
            </ul>
            <p className="note">Kept 2 years by default; an owner can set 1 to 10.</p>
          </div>
        </div>
      </div>
    </>
  );
}

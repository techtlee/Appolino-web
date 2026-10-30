import { useLayoutEffect, useRef, useState } from "react";

type Role = "viewer" | "editor" | "admin";

const ROLES: [Role, string][] = [
  ["viewer", "Viewer"],
  ["editor", "Editor"],
  ["admin", "Admin"],
];

/** A staff table with two columns Appolino recognised as personal and an admin restricted. */
const COLS = [
  { k: "name", t: "Name", restricted: false },
  { k: "team", t: "Team", restricted: false },
  { k: "email", t: "Email", restricted: true },
  { k: "salary", t: "Salary", restricted: true },
];
const ROWS = [
  { name: "Petra Hall", team: "Finance", email: "petra.hall@company.com", salary: "58,000" },
  { name: "Tom Harris", team: "Sales", email: "tom.harris@company.com", salary: "64,500" },
  { name: "Eva Dawson", team: "Logistics", email: "eva.dawson@company.com", salary: "47,200" },
];

const CAN: Record<Role, { yes: string[]; no: string[] }> = {
  viewer: {
    yes: ["Read the project's tables and results", "Make charts"],
    no: ["Edit data and steps", "See restricted columns", "Change pipelines"],
  },
  editor: {
    yes: ["Edit tables, steps and results", "Import and search SharePoint", "Build pipelines"],
    no: ["See restricted columns", "Manage people in the project"],
  },
  admin: {
    yes: ["Everything an editor can", "See restricted columns", "Add people to the project", "Change a table's alerts"],
    no: [],
  },
};

const LOG: Record<Role, string> = {
  viewer: "Jane opened the Staff table as a viewer",
  editor: "Jane opened the Staff table as an editor",
  admin: "Jane opened the Staff table as an admin, restricted columns included",
};

export function AccessPanel() {
  const [role, setRole] = useState<Role>("viewer");
  const [log, setLog] = useState<{ t: string; at: string; id: number }[]>([{ t: LOG.viewer, at: "9:41", id: 0 }]);
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
  }, [role]);

  const pick = (r: Role) => {
    if (r === role) return;
    setRole(r);
    setLog((l) => {
      const last = l[0];
      const [hh, mm] = last.at.split(":").map(Number);
      const m = mm + 1;
      const at = `${hh + Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
      return [{ t: LOG[r], at, id: last.id + 1 }, ...l].slice(0, 4);
    });
  };

  const sees = (restricted: boolean) => !restricted || role === "admin";
  const roleName = ROLES.find((r) => r[0] === role)![1].toLowerCase();

  return (
    <>
      <p className="panel-hint">What can Jane see? Switch her role: restricted columns show only to admins, and every access lands in the audit log.</p>
      <div className="access">
          <div className="card access-card">
            <div className="access-top">
              <p className="label">Jane is in the project as</p>
              <div className="seg" role="radiogroup" aria-label="Role" ref={segRef}>
                <span className="knob" style={knob} aria-hidden />
                {ROLES.map(([r, t]) => (
                  <button key={r} id={`role-${r}`} role="radio" aria-checked={role === r} onClick={() => pick(r)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid-scroll">
              <table className="grid">
                <thead>
                  <tr>
                    {COLS.map((c) => (
                      <th key={c.k} className={sees(c.restricted) ? "" : "hidden-col"}>
                        {c.t}
                        {c.restricted && <span className="lock" title="Restricted column"> ●</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r.name}>
                      {COLS.map((c) => (
                        <td key={c.k} className={`${c.k === "salary" ? "num " : ""}${sees(c.restricted) ? "" : "hidden-col"}`}>
                          {sees(c.restricted) ? r[c.k as keyof typeof r] : <span className="veil">hidden</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">● restricted column, personal data</p>
          </div>

          <div className="access-side">
            <div className="glass can" key={role}>
              <p className="label">As {role === "viewer" ? "a" : "an"} {roleName}, Jane can</p>
              <ul className="yes">
                {CAN[role].yes.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              {CAN[role].no.length > 0 && (
                <ul className="no">
                  {CAN[role].no.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="glass audit-log">
              <p className="label">Audit log</p>
              <ul>
                {log.map((e) => (
                  <li key={e.id}>
                    <span className="at">{e.at}</span>
                    {e.t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
    </>
  );
}

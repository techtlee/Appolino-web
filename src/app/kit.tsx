import { useState, type ReactNode } from "react";
import { useT } from "../i18n";
import "./icons.css";
import "./app.css";

/**
 * The parts the demo window's views are made of. The window presents what
 * appolino does, one feature to a tab, on example data - not the whole app:
 * no rail, top bar, search or table tabs, only the table and the part of
 * appolino that acts on it. Type, icons and colours are the app's own, so
 * what a visitor sees here is what they will use.
 */

export const I = ({ n, className }: { n: string; className?: string }) => <i className={`ti ti-${n}${className ? ` ${className}` : ""}`} aria-hidden />;

/** The top of a view: what is open, in a line, and the one thing to press. */
export function Head({ icon, title, sub, children }: { icon: string; title: ReactNode; sub: ReactNode; children?: ReactNode }) {
  return (
    <header className="tt-head">
      <span className="tt-head-ic">
        <I n={icon} />
      </span>
      <div className="tt-head-t">
        <h4>{title}</h4>
        <small>{sub}</small>
      </div>
      {children && <div className="tt-head-acts">{children}</div>}
    </header>
  );
}

/** A column's type, as the grid's header marks it. */
const TYPE_ICON: Record<string, string> = {
  text: "letter-case",
  decimal: "decimal",
  date: "calendar",
  integer: "number-123",
  select: "list-check",
  multi: "list-details",
  bool: "toggle-left",
  source: "plug",
};

export function Th({ type, name, keyCol, className }: { type: string; name: string; keyCol?: boolean; className?: string }) {
  return (
    <th className={className}>
      <span className="tt-th">
        <I n={TYPE_ICON[type] ?? "letter-case"} />
        {name}
        {keyCol && <I n="key" className="tt-key" />}
      </span>
    </th>
  );
}

/** A cell edited where it is, as in a spreadsheet: a click (or Enter) opens
 *  its value, Enter or leaving the cell keeps what was typed, Esc puts the
 *  value back. What is kept is the text as typed; the table reads it. With
 *  `check`, a value that does not fit is refused in a sentence under the cell
 *  and the cell stays open; leaving it then puts the old value back. */
export function EditCell({
  value,
  onCommit,
  label,
  className,
  placeholder,
  check,
  children,
}: {
  value: string;
  onCommit: (v: string) => void;
  label: string;
  className?: string;
  placeholder?: string;
  check?: (v: string) => string | null;
  children: ReactNode;
}) {
  const t = useT();
  const [draft, setDraft] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cls = className ? `${className} ` : "";
  if (draft !== null) {
    const close = () => {
      setDraft(null);
      setErr(null);
    };
    const keep = (leaving: boolean) => {
      const why = check?.(draft) ?? null;
      if (why) return leaving ? close() : setErr(why);
      if (draft !== value) onCommit(draft);
      close();
    };
    return (
      <td className={`${cls}is-editing${err ? " is-refused" : ""}`}>
        <input
          className="tt-cellin"
          autoFocus
          value={draft}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={!!err}
          onChange={(e) => {
            setDraft(e.target.value);
            setErr(null);
          }}
          onBlur={() => keep(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") keep(false);
            if (e.key === "Escape") close();
          }}
        />
        {err && (
          <span className="tt-cellerr" role="alert">
            {err}
          </span>
        )}
      </td>
    );
  }
  return (
    <td className={`${cls}is-edit`} tabIndex={0} title={t("Click to edit", "Kliknutím upravíte")} onClick={() => setDraft(value)} onKeyDown={(e) => e.key === "Enter" && setDraft(value)}>
      {children}
    </td>
  );
}

/** The statuses the grid draws as a Single select, each under its English key
 *  with the word it reads as in either language. The key gives the pill its
 *  colour (is-paid, is-held), so a screen passes the key and never has to know
 *  what the page is shown in. */
const STATUS = new Map<string, [string, string]>([
  ["Paid", ["Paid", "Zaplaceno"]],
  ["Open", ["Open", "Otevřeno"]],
  ["Overdue", ["Overdue", "Po splatnosti"]],
  ["Held", ["Held", "Pozastaveno"]],
  ["Succeeded", ["Succeeded", "Úspěch"]],
]);

/** A known status as a pill, in the page's language; anything else is a value
 *  the list does not know, shown as it was typed - never translated, because
 *  what the visitor typed is what is stored. */
export function Status({ v }: { v: string }) {
  const t = useT();
  // A Map, not an object: a cell typed "constructor" is a value, not a status.
  const known = STATUS.get(v);
  return known ? <span className={`tt-pill is-${v.toLowerCase()}`}>{t(known[0], known[1])}</span> : <span className="tt-v">{v}</span>;
}

/** The card beside the table that holds the feature: a title line, its body,
 *  and a foot for its buttons. */
export function Side({
  icon,
  title,
  sub,
  right,
  foot,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  sub?: ReactNode;
  right?: ReactNode;
  foot?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`tt-side${className ? ` ${className}` : ""}`} aria-label={title}>
      <div className="tt-side-h">
        {icon}
        <div className="tt-side-t">
          <h5>{title}</h5>
          {sub && <small>{sub}</small>}
        </div>
        {right && <div className="tt-side-r">{right}</div>}
      </div>
      <div className="tt-side-b">{children}</div>
      {foot && <div className="tt-side-f">{foot}</div>}
    </section>
  );
}

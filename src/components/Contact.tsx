import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";

export type Draft = { text: string; at: number };
type Fields = { name: string; company: string; email: string; msg: string };

/**
 * The form checks itself and prepares the message. There is no backend yet,
 * so it ends with the text to copy rather than pretending to send it.
 */
export function Contact({ draft }: { draft: Draft | null }) {
  const [f, setF] = useState<Fields>({ name: "", company: "", email: "", msg: "" });
  const [err, setErr] = useState<Partial<Record<keyof Fields, string>>>({});
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState("");
  const pre = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!draft) return;
    setF((x) => ({ ...x, msg: draft.text }));
    setDone(false);
  }, [draft]);

  const upd = (k: keyof Fields) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setF((x) => ({ ...x, [k]: v }));
    if (err[k]) setErr((x) => ({ ...x, [k]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er: typeof err = {};
    if (!f.name.trim()) er.name = "Tell us what to call you.";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) er.email = "Enter an email like name@company.com.";
    if (!f.msg.trim()) er.msg = "Write a few words about what you're dealing with.";
    setErr(er);
    if (Object.keys(er).length === 0) {
      setCopied("");
      setDone(true);
    }
  };

  const text = `Name: ${f.name}${f.company ? `\nCompany: ${f.company}` : ""}\nEmail: ${f.email}\n\n${f.msg}`;

  const copy = () => {
    const selectIt = () => {
      if (!pre.current) return;
      const r = document.createRange();
      r.selectNodeContents(pre.current);
      const s = getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
      setCopied("The text is selected. Copy it with ⌘C or Ctrl+C.");
    };
    navigator.clipboard?.writeText(text).then(() => setCopied("Copied."), selectIt) ?? selectIt();
  };

  const fld = (k: keyof Fields, label: string, el: ReactNode) => (
    <div className={`fld${err[k] ? " bad" : ""}`}>
      <label htmlFor={`f-${k}`}>{label}</label>
      {el}
      {err[k] && <span className="err">{err[k]}</span>}
    </div>
  );

  return (
    <section className="blk" id="contact">
      <div className="wrap">
        <div className="contact">
          <div className="contact-side">
            <p className="label">Contact</p>
            <h2>See Appolino on your own data.</h2>
            <p className="intro">
              Half an hour over the spreadsheets you assemble by hand today. We'll show what the import, the check and
              a scheduled run would look like in Appolino.
            </p>
            <ul>
              <li>Sign in with Google or Microsoft</li>
              <li>Files stay in your own SharePoint</li>
              <li>Every organization has its own audit log</li>
            </ul>
          </div>

          {done ? (
            <div className="glass done">
              <p className="label">Your message is ready</p>
              <h3>Thanks, {f.name.trim().split(" ")[0]}.</h3>
              <p style={{ color: "var(--fg-3)" }}>Sending is not connected yet. Copy the message and email it to us.</p>
              <pre ref={pre}>{text}</pre>
              <div className="row">
                <button className="btn" onClick={copy}>
                  Copy message
                </button>
                <button className="ghost" onClick={() => setDone(false)}>
                  Edit
                </button>
              </div>
              {copied && <p className="note">{copied}</p>}
            </div>
          ) : (
            <form className="glass" onSubmit={submit} noValidate>
              <div className="f2">
                {fld("name", "Name", <input id="f-name" value={f.name} onChange={upd("name")} autoComplete="name" />)}
                {fld(
                  "company",
                  "Company (optional)",
                  <input id="f-company" value={f.company} onChange={upd("company")} autoComplete="organization" />,
                )}
              </div>
              {fld(
                "email",
                "Email",
                <input id="f-email" type="email" value={f.email} onChange={upd("email")} autoComplete="email" />,
              )}
              {fld(
                "msg",
                "What are you dealing with?",
                <textarea
                  id="f-msg"
                  value={f.msg}
                  onChange={upd("msg")}
                  placeholder="For example: our monthly report comes from six spreadsheets and we clean them by hand every time."
                />,
              )}
              <div>
                <button className="btn" type="submit">
                  Prepare message
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

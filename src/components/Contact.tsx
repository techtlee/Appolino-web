import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useT } from "../i18n";

export type Draft = { text: string; at: number };
type Fields = { name: string; company: string; email: string; msg: string };

/**
 * The form checks itself and prepares the message, in English or Czech. There is no backend
 * yet, so it ends with the text to copy rather than pretending to send it.
 */
export function Contact({ draft }: { draft: Draft | null }) {
  const t = useT();
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
    if (!f.name.trim()) er.name = t("Tell us what to call you.", "Napište nám, jak vás oslovit.");
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) er.email = t("Enter an email like name@company.com.", "Zadejte e-mail ve tvaru jmeno@firma.cz.");
    if (!f.msg.trim()) er.msg = t("Write a few words about what you're dealing with.", "Napište pár slov o tom, co řešíte.");
    setErr(er);
    if (Object.keys(er).length === 0) {
      setCopied("");
      setDone(true);
    }
  };

  const text = t(
    `Name: ${f.name}${f.company ? `\nCompany: ${f.company}` : ""}\nEmail: ${f.email}\n\n${f.msg}`,
    `Jméno: ${f.name}${f.company ? `\nFirma: ${f.company}` : ""}\nE-mail: ${f.email}\n\n${f.msg}`,
  );

  const copy = () => {
    const selectIt = () => {
      if (!pre.current) return;
      const r = document.createRange();
      r.selectNodeContents(pre.current);
      const s = getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
      setCopied(t("The text is selected. Copy it with ⌘C or Ctrl+C.", "Text je označený. Zkopírujte ho pomocí ⌘C nebo Ctrl+C."));
    };
    navigator.clipboard?.writeText(text).then(() => setCopied(t("Copied.", "Zkopírováno.")), selectIt) ?? selectIt();
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
            <p className="label">{t("Contact", "Kontakt")}</p>
            <h2>{t("See appolino on your own data.", "Podívejte se na appolino na vlastních datech.")}</h2>
            <p className="intro">
              {t(
                "Half an hour over the processes your team runs by hand today. We'll show what bringing them in, validating them and a scheduled delivery would look like in appolino.",
                "Půl hodiny nad procesy, které dnes váš tým dělá ručně. Ukážeme, jak by v appolinu vypadalo jejich načtení, ověření a doručení podle plánu.",
              )}
            </p>
          </div>

          {done ? (
            <div className="glass done">
              <p className="label">{t("Your message is ready", "Zpráva je připravená")}</p>
              <h3>{t(`Thanks, ${f.name.trim().split(" ")[0]}.`, `Děkujeme, ${f.name.trim().split(" ")[0]}.`)}</h3>
              <p style={{ color: "var(--fg-3)" }}>{t("Sending is not connected yet. Copy the message and email it to us.", "Odesílání zatím není zapojené. Zkopírujte zprávu a pošlete nám ji e-mailem.")}</p>
              <pre ref={pre}>{text}</pre>
              <div className="row">
                <button className="btn" onClick={copy}>
                  {t("Copy message", "Zkopírovat zprávu")}
                </button>
                <button className="ghost" onClick={() => setDone(false)}>
                  {t("Edit", "Upravit")}
                </button>
              </div>
              {copied && <p className="note">{copied}</p>}
            </div>
          ) : (
            <form className="glass" onSubmit={submit} noValidate>
              <div className="f2">
                {fld("name", t("Name", "Jméno"), <input id="f-name" value={f.name} onChange={upd("name")} autoComplete="name" />)}
                {fld("company", t("Company (optional)", "Firma (nepovinné)"), <input id="f-company" value={f.company} onChange={upd("company")} autoComplete="organization" />)}
              </div>
              {fld("email", t("Email", "E-mail"), <input id="f-email" type="email" value={f.email} onChange={upd("email")} autoComplete="email" />)}
              {fld(
                "msg",
                t("What are you dealing with?", "Co řešíte?"),
                <textarea
                  id="f-msg"
                  value={f.msg}
                  onChange={upd("msg")}
                  placeholder={t(
                    "For example: our monthly report comes from six spreadsheets and we clean them by hand every time.",
                    "Například: měsíční report skládáme ze šesti tabulek a pokaždé je ručně čistíme.",
                  )}
                />,
              )}
              <div>
                <button className="btn" type="submit">
                  {t("Prepare message", "Připravit zprávu")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

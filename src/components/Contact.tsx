import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useT } from "../i18n";

export type Draft = { text: string; at: number };
type Fields = { name: string; company: string; email: string; msg: string };
/** Filling in, on its way, arrived, or ended with the text to copy: because sending is not set
 *  up in this build ("copy"), or because it did not go through ("failed"). */
type Stage = "form" | "sending" | "sent" | "copy" | "failed";

/** Where the form is sent: the Worker in cloudflare/contact-worker.js, its URL written into the
 *  build from VITE_CONTACT_URL (.env.production). A build without one ends with the text to copy
 *  rather than pretending to send it. */
const SEND_TO = import.meta.env.VITE_CONTACT_URL;

/** Sends the form; true once the Worker says it went. Sent as text/plain, a simple request, so
 *  the browser asks no permission first: one round trip. */
async function send(f: Fields, trap: string): Promise<boolean> {
  const form = { name: f.name.trim(), company: f.company.trim(), email: f.email.trim(), msg: f.msg.trim(), website: trap };
  try {
    const r = await fetch(SEND_TO!, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(form) });
    return r.ok;
  } catch {
    return false;
  }
}

/** The form checks itself and sends the message, in English or Czech. */
export function Contact({ draft }: { draft: Draft | null }) {
  const t = useT();
  const [f, setF] = useState<Fields>({ name: "", company: "", email: "", msg: "" });
  const [err, setErr] = useState<Partial<Record<keyof Fields, string>>>({});
  const [stage, setStage] = useState<Stage>("form");
  const [trap, setTrap] = useState("");
  const [copied, setCopied] = useState("");
  const pre = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!draft) return;
    setF((x) => ({ ...x, msg: draft.text }));
    setStage("form");
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
    if (Object.keys(er).length || stage === "sending") return;
    setCopied("");
    if (!SEND_TO) return setStage("copy");
    setStage("sending");
    send(f, trap).then((ok) => setStage(ok ? "sent" : "failed"));
  };

  const first = f.name.trim().split(" ")[0];

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

          {stage === "sent" ? (
            <div className="glass done" role="status">
              <p className="label">{t("Message sent", "Zpráva odeslána")}</p>
              <h3>{t(`Thanks, ${first}.`, `Děkujeme, ${first}.`)}</h3>
              <p style={{ color: "var(--fg-3)" }}>{t(`It reached us. We'll write back to ${f.email.trim()}.`, `Došla nám. Odpovíme na ${f.email.trim()}.`)}</p>
            </div>
          ) : stage === "copy" || stage === "failed" ? (
            <div className="glass done" role="status">
              <p className="label">{t("Your message is ready", "Zpráva je připravená")}</p>
              <h3>{t(`Thanks, ${first}.`, `Děkujeme, ${first}.`)}</h3>
              <p style={{ color: "var(--fg-3)" }}>
                {stage === "failed"
                  ? t("It did not go through. Copy the message and email it to us.", "Zprávu se nepodařilo odeslat. Zkopírujte ji a pošlete nám ji e-mailem.")
                  : t("Sending is not connected yet. Copy the message and email it to us.", "Odesílání zatím není zapojené. Zkopírujte zprávu a pošlete nám ji e-mailem.")}
              </p>
              <pre ref={pre}>{text}</pre>
              <div className="row">
                <button className="btn" onClick={copy}>
                  {t("Copy message", "Zkopírovat zprávu")}
                </button>
                <button className="ghost" onClick={() => setStage("form")}>
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
              {/* A field no person sees or reaches: a bot that fills in every input fills in this
                  one too, and the Worker sends nothing it carries. */}
              <div hidden>
                <label htmlFor="f-website">Website</label>
                <input id="f-website" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
              </div>
              <div>
                <button className="btn" type="submit" disabled={stage === "sending"}>
                  {!SEND_TO ? t("Prepare message", "Připravit zprávu") : stage === "sending" ? t("Sending", "Odesílám") : t("Send message", "Odeslat zprávu")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

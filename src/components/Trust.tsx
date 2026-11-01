import { useEffect, useRef, useState } from "react";
import { prefersLessMotion, useSeen } from "../motion";
import { mask } from "../czech";
import { useLang, useT } from "../i18n";

/** Security as enterprise platforms set it out (owner, 2026-11-01, after Airtable's): three
 *  columns - where the data lives, who gets in, what it is held to - each a list of short,
 *  checkable claims rather than paragraphs, in English and Czech. Every claim is bdop's own
 *  record; the certifications are the providers', and the line says so: appolino holds no
 *  ISO 27001 certificate or SOC 2 report of its own yet, and must not be read as claiming one.
 *  No claim of encryption at rest (unconfirmed) and none of password-less cloud sign-in (not
 *  live). Named Trust in the bar and over the section (owner, 2026-11-01: "put trust there");
 *  it was "Trust Center" for a while, Peliqan's name for a page of its own, then Security. */
type Two = [string, string];
/** The three frames over the columns, as Peliqan sets them out: each named, said in a line,
 *  and backed by what it rests on. "GDPR-ready", not "compliant" (a legal finding no one has
 *  made); sovereignty as the two places data can live; the certificates as the hosting's own. */
const FRAMES: { icon: string; title: Two; text: Two; proof: Two }[] = [
  {
    icon: "lock",
    title: ["GDPR-ready", "Připraveno na GDPR"],
    text: ["Personal data kept in the EU, tagged, withheld from AI and traced in a full audit trail.", "Osobní údaje zůstávají v EU, jsou označené, nikdy nejdou do AI a vše zachytí úplná auditní stopa."],
    proof: ["EU hosting · personal tags · audit trail", "Hosting v EU · osobní štítky · auditní stopa"],
  },
  {
    icon: "world",
    title: ["Data sovereignty", "Datová suverenita"],
    // Hosting by appolino first, as the offer it is; the customer's own database as the
    // choice for those who want it (owner, 2026-11-01: "preferably we host it and provide the
    // solution, or you host it if you wish").
    text: [
      "We host it for you in the EU as a complete solution. If you prefer, it stays in your own database.",
      "Hostujeme za vás v EU jako hotové řešení. Pokud chcete, zůstanou data ve vaší vlastní databázi.",
    ],
    proof: ["Hosted by us in the EU · or your own PostgreSQL", "Hostujeme my v EU · nebo váš PostgreSQL"],
  },
  {
    icon: "shield-check",
    title: ["Certified infrastructure", "Certifikovaná infrastruktura"],
    // As security pages say it: the cloud and its region, its certificates named as its own.
    // Cloudflare serves the site, not the data, so it belongs in a subprocessor list rather
    // than here (owner, 2026-11-01: "is this really mentioned so explicitly?").
    text: [
      "Your data runs on Amazon Web Services in the EU, in data centres certified to ISO 27001 and SOC 2.",
      "Vaše data běží na Amazon Web Services v EU, v datových centrech s certifikací ISO 27001 a SOC 2.",
    ],
    proof: ["ISO 27001 · SOC 2", "ISO 27001 · SOC 2"],
  },
];

type Option = { icon: string; title: Two; text: Two; tags: Two[] };
// "Every load is safe" (ACID, never named) moved to Solutions, in place of the write modes and
// the load receipt (owner, 2026-11-01).

/** What a company signs up to beside the controls: the service (owner, 2026-11-01: "add uptime
 *  99.5%, scalability, compliant logs, RBAC, premium support, easy migrations, where it suits
 *  best"). The uptime is the figure bdop's architecture specification calls safe to sign once
 *  production stands (§12: 99.5% a month, 99.9% with a second zone); scaling is its known path
 *  (one server, then more copies); the logs are the audit trail and operator log the columns
 *  above name; support and migration help are the owner's offer. */
const SERVICE: [string, Two, Two][] = [
  ["chart-line", ["99.5% uptime", "Dostupnost 99,5 %"], ["A monthly uptime commitment, written into the contract.", "Měsíční závazek dostupnosti, zapsaný ve smlouvě."]],
  ["stack-2", ["Scales with you", "Roste s vámi"], ["More teams, more data, more runs: capacity grows as you do.", "Víc týmů, dat i běhů: kapacita roste spolu s vámi."]],
  ["history", ["Audit-ready logs", "Záznamy pro audit"], ["Every change and every access recorded, kept 1 to 10 years.", "Každá změna i každý přístup zaznamenaný, uchovaný 1 až 10 let."]],
  ["user-shield", ["Role-based access", "Přístup podle rolí"], ["Roles per organization and project decide who sees and changes what.", "Role v organizaci a projektu určují, kdo co vidí a mění."]],
  ["users", ["Premium support", "Prémiová podpora"], ["Direct help from the team that builds appolino, onboarding included.", "Přímá pomoc od týmu, který appolino vyvíjí, včetně zaškolení."]],
  ["arrows-exchange", ["Easy migration", "Snadný přechod"], ["Your files come in as they are, and we help move your first processes.", "Vaše soubory se načtou, jak jsou, a s prvními procesy pomůžeme."]],
];

const PILLARS: { icon: string; title: Two; lead: Two; options?: Option[]; items: Two[] }[] = [
  // The two places a project's data can live, chosen per project before anything is made in it
  // (bdop: projects.store_chosen_at), shown as the two options they are (owner, 2026-11-01).
  {
    icon: "database",
    title: ["Where your data lives", "Kde jsou vaše data"],
    lead: ["Two ways to keep your data, chosen project by project.", "Dva způsoby, jak data uložit: volíte pro každý projekt zvlášť."],
    options: [
      {
        icon: "cloud",
        title: ["Hosted by appolino", "Hostované appolinem"],
        text: ["Our managed, secured database in the EU.", "Naše spravovaná, zabezpečená databáze v EU."],
        tags: [
          ["EU region", "Region EU"],
          ["Fully managed", "Plně spravované"],
        ],
      },
      {
        icon: "server",
        title: ["Your own database", "Vaše vlastní databáze"],
        text: ["Your PostgreSQL. Only metadata reaches appolino.", "Váš PostgreSQL. K appolinu se dostanou jen metadata."],
        tags: [
          ["Amazon RDS", "Amazon RDS"],
          ["Cloud SQL", "Cloud SQL"],
          ["Your server", "Váš server"],
        ],
      },
    ],
    items: [],
  },
  {
    icon: "user-shield",
    title: ["Access control", "Řízení přístupu"],
    lead: ["Everyone sees exactly what they should, in the app and in every BI tool.", "Každý vidí přesně to, co má, v aplikaci i v každém BI nástroji."],
    items: [
      ["SSO with Microsoft Entra ID or Google Workspace", "Jednotné přihlášení přes Microsoft Entra ID nebo Google Workspace"],
      ["Enforced MFA, no stored passwords", "Povinné vícefázové ověření, žádná uložená hesla"],
      ["Role-based access control per project", "Přístup podle rolí v každém projektu"],
      ["Row-level security, enforced in PostgreSQL", "Zabezpečení na úrovni řádků, vynucené v PostgreSQL"],
      ["Column-level access for sensitive fields", "Přístup na úrovni sloupců pro citlivá pole"],
      // What the AI may reach is access too, and the column then matches Audit's seven lines
      // (owner, 2026-11-01: "add here AI access, something on the platform like tags"). Both are
      // what the masking box below says: a personal column is withheld entirely, owners included;
      // the assistant runs on a monthly budget and a daily limit per person.
      ["Columns tagged personal, kept from AI", "Osobní sloupce označené, mimo AI"],
      ["AI use capped per person", "Použití AI omezené pro každého"],
    ],
  },
  {
    icon: "shield-check",
    title: ["Audit and compliance", "Audit a soulad"],
    lead: ["Every change is traced, and the platform is held to published standards.", "Každá změna je dohledatelná a platforma se drží veřejných standardů."],
    // Hosting and certificates named as security pages name them: the provider and the region,
    // never a data centre; the certificates as the hosting's own (owner, 2026-11-01: "specify
    // ISO, GDPR, EU, hosted - shortly"). The city is left out until production stands in
    // Frankfurt: pre-production runs in Stockholm (bdop ARCHITECTURE.md), both in the EU.
    items: [
      ["Hosted in the EU on Amazon Web Services", "Hostováno v EU na Amazon Web Services"],
      ["ISO 27001 and SOC 2 certified infrastructure", "Infrastruktura certifikovaná ISO 27001 a SOC 2"],
      ["GDPR-ready: personal data tagged and kept from AI", "Připraveno na GDPR: osobní údaje označené a mimo AI"],
      ["Project isolation", "Oddělené projekty"],
      ["Full audit trail, retained 1 to 10 years", "Úplná auditní stopa, uchovaná 1 až 10 let"],
      ["Every operator access logged", "Každý přístup operátora zaznamenaný"],
      // "Encrypted in transit" is what TLS means, said so a business reader knows it (owner,
      // 2026-11-01: "what does TLS in transit mean").
      ["Built to OWASP Top 10, encrypted in transit", "Postaveno podle OWASP Top 10, šifrováno při přenosu"],
    ],
  },
];

/** Values from one row, as the assistant receives them, in each language's own example. */
const ROW_EN: { c: string; v: string; no?: boolean }[] = [
  { c: "Customer", v: "Pekárna U Mlýna s.r.o." },
  { c: "City", v: "Prague" },
  { c: "Amount (CZK)", v: "12,840.00" },
  { c: "Company ID (IČO)", v: "27082440" },
  { c: "Contact e-mail", v: "orders@pekarna-mlyn.cz", no: true },
];
const ROW_CS: { c: string; v: string; no?: boolean }[] = [
  { c: "Odběratel", v: "Pekárna U Mlýna s.r.o." },
  { c: "Město", v: "Praha" },
  { c: "Částka (Kč)", v: "12 840,00" },
  { c: "IČO", v: "27082440" },
  { c: "Kontaktní e-mail", v: "objednavky@pekarna-mlyn.cz", no: true },
];

function Masking() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.4);
  const [p, setP] = useState(prefersLessMotion() ? 1 : 0);
  const t = useT();
  const lang = useLang();
  const ROW = lang === "cs" ? ROW_CS : ROW_EN;
  useEffect(() => {
    if (!seen || prefersLessMotion()) return;
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      // Mask, hold, unmask, hold: a loop of six seconds.
      const k = ((now - start) / 6000) % 1;
      setP(k < 0.3 ? k / 0.3 : k < 0.7 ? 1 : k < 0.85 ? 1 - (k - 0.7) / 0.15 : 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen]);

  return (
    <div className="masking" ref={ref}>
      <div>
        <h3>{t("What the AI sees: the shape, never the value.", "Co vidí AI: tvar, nikdy hodnotu.")}</h3>
        <p>
          {t(
            "✦ Ask is sent column names, types and a few masked shapes, so “Prague” leaves as “Xxxxxx”. A column tagged personal is withheld entirely, for everyone, owners included. Columns appolino recognises as e-mail, IBAN, birth number or phone are proposed for that tag.",
            "✦ Zeptat se dostane názvy sloupců, typy a pár zamaskovaných tvarů, takže „Praha“ odchází jako „Xxxxx“. Sloupec označený jako osobní se neposílá vůbec, nikomu, ani vlastníkům. Sloupce, které appolino pozná jako e-mail, IBAN, rodné číslo nebo telefon, navrhne takto označit.",
          )}
        </p>
        <ul className="ai-facts">
          <li>{t("Claude on Amazon Bedrock in Frankfurt, or your own key", "Claude na Amazon Bedrock ve Frankfurtu, nebo váš vlastní klíč")}</li>
          <li>{t("A monthly budget and a daily limit per person", "Měsíční rozpočet a denní limit na osobu")}</li>
          <li>{t("A log of every call and what it sent", "Záznam o každém volání a o tom, co odeslalo")}</li>
        </ul>
      </div>
      <div className="mask-rows">
        {ROW.map((r) => {
          const n = Math.round(r.v.length * p);
          return (
            <div key={r.c} className={`mask-row${r.no ? " no" : ""}`}>
              <span className="c">{r.c}</span>
              <span className="v">
                {r.no ? (
                  <span className="veil">{t("withheld · never sent to AI", "zadrženo · nikdy do AI")}</span>
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
  const t = useT();
  return (
    <section className="trust" id="security">
      <div className="wrap">
        <div className="sec-head">
          <p className="label">{t("Trust", "Důvěra")}</p>
          {/* Said as security pages say it (owner, 2026-11-01: "a more professional title"; it was
              "Built for companies, not side projects."). */}
          <h2>{t("Enterprise-grade security, built in from day one.", "Zabezpečení na podnikové úrovni, zabudované od prvního dne.")}</h2>
          <p className="intro">
            {t(
              "Security, privacy and where your data lives: what a finance or operations team needs before it moves its spreadsheets anywhere.",
              "Bezpečnost, soukromí a místo, kde data žijí: co finanční nebo provozní tým potřebuje, než své tabulky kamkoli přesune.",
            )}
          </p>
        </div>
        <div className="frames">
          {FRAMES.map((f) => (
            <div className="frame" key={f.icon}>
              <div className="frame-top">
                <span className="frame-ic" aria-hidden>
                  <i className={`ti ti-${f.icon}`} />
                </span>
                <h3>{t(...f.title)}</h3>
              </div>
              <div className="frame-b">
                <p>{t(...f.text)}</p>
                <small>{t(...f.proof)}</small>
              </div>
            </div>
          ))}
        </div>
        <div className="pillars">
          {PILLARS.map((p) => (
            <div className="pillar" key={p.icon}>
              <span className="pillar-ic" aria-hidden>
                <i className={`ti ti-${p.icon}`} />
              </span>
              <h3>{t(...p.title)}</h3>
              <p>{t(...p.lead)}</p>
              {p.options && (
                <div className="pillar-opts">
                  {p.options.map((o, i) => (
                    <div className="opt" key={o.icon}>
                      {i > 0 && <span className="opt-or">{t("or", "nebo")}</span>}
                      <span className="opt-ic" aria-hidden>
                        <i className={`ti ti-${o.icon}`} />
                      </span>
                      <span className="opt-t">
                        <small>{t(`Option ${i + 1}`, `Možnost ${i + 1}`)}</small>
                        <b>{t(...o.title)}</b>
                        <span>{t(...o.text)}</span>
                        <span className="opt-tags">
                          {o.tags.map((g) => (
                            <em key={g[0]}>{t(...g)}</em>
                          ))}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {p.items.length > 0 && (
                <ul>
                  {p.items.map((it) => (
                    <li key={it[0]}>{t(...it)}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <div className="svc">
          <span className="svc-h">{t("Service you can rely on", "Služba, na kterou se můžete spolehnout")}</span>
          <div className="svc-row">
            {SERVICE.map(([icon, name, line]) => (
              <p className="svc-i" key={icon}>
                <i className={`ti ti-${icon}`} aria-hidden />
                <span>
                  <b>{t(...name)}</b>
                  {t(...line)}
                </span>
              </p>
            ))}
          </div>
        </div>
        <Masking />
      </div>
    </section>
  );
}

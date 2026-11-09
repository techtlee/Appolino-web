import { useState } from "react";
import { useT } from "../i18n";

/**
 * Deliver: where the data goes and the two ways a team can go - leave hand-made reporting for
 * a trusted pipeline, or stay in Excel and let appolino do the work around it. Its three notes
 * on how it is written - the write modes, writeback, the load receipt - went to Solutions
 * (owner, 2026-11-01: "this should somehow be in Solutions, incorporated"). In English and
 * Czech. Its text breaks no sentence with a dash (owner, 2026-11-01: "don't use - in texts, so
 * it looks pro").
 */
export function Platform() {
  const t = useT();
  /** Which cards are open (owner, 2026-11-08): each shows its heading and its line, and its
   *  points only when opened - each card on its own. */
  const [open, setOpen] = useState<boolean[]>(() => PATHS.map(() => false));
  return (
    <section className="platform" id="platform">
      <div className="wrap">
        <div className="sec-head">
          <p className="label">{t("Deliver", "Doručení")}</p>
          {/* Said as management needs it, not as a list of databases and file types (owner,
              2026-11-01: "more like management needs; don't be too specific about these types,
              sources and techs, more general"). */}
          <h2>{t("The right numbers, where decisions are made.", "Správná čísla tam, kde se rozhoduje.")}</h2>
          <p className="intro">
            {t(
              "Checked, consistent data reaches every report, dashboard and spreadsheet your teams rely on, on time and without manual work. Your existing tools keep working, and corrected figures flow back to where they started.",
              "Ověřená a jednotná data dorazí včas a bez ruční práce do každého reportu, přehledu i tabulky, na které se vaše týmy spoléhají. Stávající nástroje fungují dál a opravená čísla se vrátí tam, kde vznikla.",
            )}
          </p>
        </div>
        {/* The two ways a team can go (owner, 2026-11-01): out of reporting stitched together by
            hand into a validated, automated pipeline - or keep the spreadsheets and manual
            inputs and make the work round them a process that runs the same every time. */}
        <div className="paths">
          {PATHS.map((p, i) => (
            <div className="path" key={p.icon}>
              <span className="path-ic" aria-hidden>
                <i className={`ti ti-${p.icon}`} />
              </span>
              <small>{t(`Path ${i + 1}`, `Cesta ${i + 1}`)}</small>
              <h3>{t(p.h[0], p.h[1])}</h3>
              <p>{t(p.p[0], p.p[1])}</p>
              <div className={open[i] ? "path-more is-open" : "path-more"}>
                <button
                  type="button"
                  className="path-toggle"
                  aria-expanded={open[i]}
                  aria-controls={`path-list-${i}`}
                  onClick={() => setOpen((o) => o.map((v, k) => (k === i ? !v : v)))}
                >
                  {open[i] ? t("Show less", "Méně") : t(`What's included (${p.list.length})`, `Co obsahuje (${p.list.length})`)}
                  <i className="ti ti-chevron-down" aria-hidden />
                </button>
                {/* Kept in the page while closed, so the card opens by sliding; hidden from
                    screen readers until then (it holds nothing to focus). */}
                <div className="path-list" id={`path-list-${i}`} aria-hidden={!open[i]}>
                  <ul>
                    {p.list.map(([en, cs]) => (
                      <li key={en}>{t(en, cs)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The two ways forward, each with all it covers (owner, 2026-11-01: "state all use case
 *  potential"): leave hand-made reporting for a validated, automated pipeline - or stay in
 *  Excel with the manual inputs as they are and let appolino do the work around them. Not only
 *  spreadsheets: every kind of input a team has - typed in, exported, mailed, dropped in a
 *  folder - named by what it is, never by a file format (owner: "not just spreadsheets, but
 *  manual inputs, different inputs and source formats").
 *
 *  The two lists are seven lines each, so the cards end together (owner, 2026-11-01: "the
 *  same ending, not an empty box at the end"); index.css lines their parts up across both.
 *
 *  E-mail intake is a line in Path 2, said as what it does today, not a card of its own
 *  (owner, 2026-11-01: "as functionality, not like something coming; not a separate card, but
 *  mentioned: possible to scan e-mail and ingest into a table, various formats"). As bdop has
 *  it since 2026-10-15 (technical specification §3, *Files that arrive by mail*): a Microsoft
 *  365 mailbox, each sender verified before anything loads. Gmail and PDFs are not built yet,
 *  so neither is named. */
const PATHS: { icon: string; h: [string, string]; p: [string, string]; list: [string, string][] }[] = [
  {
    icon: "bolt",
    h: ["Leave manual reporting behind", "Nechte ruční reporting za sebou"],
    p: [
      "Move from reporting stitched together by hand, out of spreadsheets, system exports, e-mailed files and numbers typed in, to data that is validated, automated and trusted: an easy, fast migration that puts quality first.",
      "Přejděte od reportingu skládaného ručně z tabulek, exportů ze systémů, souborů z e-mailu a ručně zadaných čísel k datům, která jsou ověřená, automatizovaná a důvěryhodná: snadný a rychlý přechod, ve kterém je kvalita na prvním místě.",
    ],
    list: [
      [
        "Easy, fast migration: every input comes in as it is, from spreadsheets and system exports to bank statements, e-invoices and manual entries, every column typed",
        "Snadný a rychlý přechod: každý vstup se načte tak, jak je, od tabulek a exportů ze systémů po bankovní výpisy, e-faktury a ruční zadání, a každý sloupec dostane typ",
      ],
      ["Quality first: every value checked against your rules from the first import", "Kvalita na prvním místě: každá hodnota zkontrolovaná podle vašich pravidel od prvního importu"],
      ["Pipelines that fetch, check and deliver on schedule", "Pipeliny, které podle plánu stáhnou, zkontrolují a doručí"],
      // An offer, not a built-in list (owner, 2026-11-01: "add that we can provide specific
      // integrations into ERP and other systems").
      [
        "Specific integrations with your ERP, accounting or CRM, built by us when an export is not enough",
        "Integrace na míru s vaším ERP, účetnictvím nebo CRM, které připravíme, když export nestačí",
      ],
      ["One database every report and BI tool reads", "Jedna databáze, ze které čte každý report i BI nástroj"],
      ["Bad loads held before anyone reports them", "Špatná data zastavená dřív, než je někdo reportuje"],
      ["History, access rules and an audit trail on every table", "Historie, přístupová práva a auditní stopa u každé tabulky"],
    ],
  },
  {
    icon: "file-spreadsheet",
    h: ["Stay in Excel and work there", "Zůstaňte v Excelu a pracujte v něm"],
    p: [
      "Keep your spreadsheets and manual inputs as they are and keep working in them. appolino does the work around them, whatever comes in and from wherever, the same way every time.",
      "Ponechte si tabulky i ruční vstupy, jak jsou, a dál v nich pracujte. Práci kolem nich udělá appolino, ať přijde cokoli a odkudkoli, a pokaždé stejně.",
    ],
    list: [
      [
        "Manual inputs stay where people make them: plans, adjustments and price lists, in a spreadsheet or typed straight into a table in appolino",
        "Ruční vstupy zůstanou tam, kde je lidé tvoří: plány, korekce a ceníky, v tabulce nebo zapsané rovnou do tabulky v appolinu",
      ],
      ["Files read as they arrive, from a folder, SharePoint or OneDrive", "Soubory načtené, jak přijdou, ze složky, SharePointu nebo OneDrivu"],
      [
        "Mail scanned and ingested: attachments sent to your mailbox land in their tables, spreadsheets, text exports, bank statements and e-invoices alike, each sender checked first",
        "E-maily zpracované samy: přílohy poslané do vaší schránky skončí ve svých tabulkách, ať jde o tabulky, textové exporty, bankovní výpisy, nebo e-faktury, a každý odesílatel se nejdřív ověří",
      ],
      ["Scheduled exports from source systems come in by themselves: ERP, accounting, CRM", "Plánované exporty ze zdrojových systémů přijdou samy: ERP, účetnictví, CRM"],
      ["Every input checked by the same rules, combined in repeatable steps", "Každý vstup zkontrolovaný stejnými pravidly, spojený v opakovatelných krocích"],
      ["An alert in Teams when a file is late or a load is held", "Upozornění v Teams, když soubor nedorazí včas nebo se načtení zastaví"],
      ["Results written back into your workbook, cell by cell", "Výsledky zapsané zpátky do vašeho sešitu, buňku po buňce"],
    ],
  },
];

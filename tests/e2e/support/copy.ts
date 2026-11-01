// The owner's standing rules for the words the site shows (docs/design-system.md section 8), as
// one function over a list of texts, so every test can hold every word it saw to them
// (support/test.ts) and content.spec.ts can say which rule broke where.
//
// Each rule is written as narrowly as its reason: a hyphen inside a word, a minus sign and a
// lone "—" standing for an empty cell are all allowed; the certifications may be named, as the
// infrastructure's.

export type Seen = { text: string; code?: boolean };

type Rule = {
  name: string;
  /** Applies to prose only: code, SQL and form fields are written as they must be. */
  prose?: boolean;
  broken: (text: string) => boolean;
};

/** Where the certifications may stand: in a sentence or line that names the infrastructure that
 *  holds them, never as appolino's own (docs/design-system.md section 8, 2026-11-01: "certifications named as
 *  the hosting's, never appolino's own"). */
export const INFRASTRUCTURE = /infrastructure|data cent(?:re|er)s?|Amazon Web Services|\bAWS\b|hosting|provider/i;
/** A line that is nothing but certification names - a tag under a card - stands for the card's
 *  own claim, which content.spec.ts reads in the page. */
export const ONLY_CERTS = /^(?:\s|·|,|and|ISO\s?27001|SOC\s?2)+$/i;
const CERT = /ISO\s?27001|SOC\s?2\b/i;

export const RULES: Rule[] = [
  {
    // "don't use - in texts, so it looks pro" (owner, 2026-11-01): a sentence breaks with a
    // comma, a colon, a full stop or parentheses, never a spaced hyphen or en dash.
    name: 'a spaced dash (" - ") used as punctuation',
    prose: true,
    broken: (t) => /(^|\s)[-–](\s|$)/.test(t) && !/^\s*[-–]\s*$/.test(t),
  },
  {
    // The em dash is punctuation too; alone, it is the grid's empty cell.
    name: 'an em dash ("—") in a sentence',
    prose: true,
    broken: (t) => t.includes("—") && t.trim() !== "—",
  },
  { name: '"Czech Republic" named', broken: (t) => /Czech\s+Republic/i.test(t) },
  { name: '"ACID" named (said in business words, never the acronym)', broken: (t) => /\bACID\b/.test(t) },
  { name: 'something promised as "coming"', broken: (t) => /\bcoming\s+(in|soon)\b/i.test(t) },
  {
    name: "GDPR said as compliance (it is GDPR-ready, never compliant)",
    broken: (t) => /GDPR[\s-]*complian|complian\w*\s+(?:with\s+)?(?:the\s+)?GDPR/i.test(t),
  },
  {
    name: "a certification claimed as appolino's own",
    broken: (t) =>
      /\bappolino\b[^.]{0,60}\b(?:is|are|has|holds?|gets?|got)\b[^.]{0,40}\bcertifi/i.test(t) ||
      /\b(?:we|we're|we are|our (?:company|platform|team))\b[^.]{0,30}\bcertified\b/i.test(t) ||
      /\bcertified\b[^.]{0,20}\bappolino\b/i.test(t) ||
      (CERT.test(t) && !INFRASTRUCTURE.test(t) && !ONLY_CERTS.test(t)),
  },
  { name: "the name not in lower case", broken: (t) => /\bAppolino\b|\bAPPOLINO\b/.test(t) },
  { name: '"Applied steps" (Power Query\'s word; appolino says "Saved steps")', broken: (t) => /Applied steps/i.test(t) },
  { name: "Power BI named", broken: (t) => /Power\s?BI/i.test(t) },
];

/** Every broken rule, once per rule and text: `rule: "the text"`. */
export function copyProblems(seen: Seen[]): string[] {
  const out = new Set<string>();
  for (const { text, code } of seen) {
    const t = text.replace(/\s+/g, " ");
    for (const r of RULES) {
      if (r.prose && code) continue;
      if (r.broken(t)) out.add(`${r.name}: "${t.trim().slice(0, 140)}"`);
    }
  }
  return [...out].sort();
}

/** The newest entries of the app's release notes, in the words a user notices them. */
const ENTRIES: [string, string, string][] = [
  ["October 9, 2026", "Easier to read, and a failed result says why", "Small text meets the accessibility standard; a failed result opens on its rows with the reason; Run now says why it did not run."],
  ["October 8, 2026", "A result's page looks like a table's", "Results and tables share one page and one tool line; schemas live under Data storage."],
  ["October 5, 2026", "Settings laid out like a product's", "Settings has a sidebar of its own, Connections is its own page again, and authentication was redone."],
  ["October 4, 2026", "One tool line above the table", "A table's tools sit on one line, Validate moves nothing, and dates written with spaces are read as dates."],
];

export function Changelog() {
  return (
    <section className="changelog" id="changelog">
      <div className="wrap">
        <h2>appolino keeps getting better.</h2>
        <div className="cl-grid">
          {ENTRIES.map(([d, h, p]) => (
            <article className="cl" key={d}>
              <span className="d">{d}</span>
              <h3>{h}</h3>
              <p>{p}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

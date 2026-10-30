const SOURCES = ["Excel", "CSV", "SharePoint", "OneDrive", "PostgreSQL", "Cloud SQL"];

/** The files and systems Appolino reads from and writes to today. */
export function Connects() {
  return (
    <section className="connects" aria-label="Works with">
      <div className="wrap">
        <p className="label">Works with the files and systems you already have</p>
        <div className="logos">
          {SOURCES.map((s) => (
            <span key={s}>
              <i aria-hidden />
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

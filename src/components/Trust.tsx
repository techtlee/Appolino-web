const ITEMS: [string, string][] = [
  ["Sign in with Google or Microsoft", "Your company directory decides who gets in. No passwords are stored."],
  ["Roles per project", "Viewer, editor, admin. What you may not do is, for the most part, not offered."],
  ["Restricted columns", "Personal data stays hidden from everyone but admins, in the grid and in results."],
  ["An audit log per organization", "Sign-ins, members, settings, every project's changes, and every time someone from Appolino looked at your data."],
  ["Your files stay yours", "SharePoint and OneDrive through your own Microsoft app. Each project's data on its own database."],
  ["AI with a monthly cap", "Each organization picks the model Ask uses and sets a monthly stop."],
];

export function Trust() {
  return (
    <section className="trust" id="security">
      <div className="wrap">
        <h2>Built for companies, not side projects.</h2>
        <p className="intro" style={{ marginTop: 14 }}>
          What a finance or operations team needs before it moves its spreadsheets anywhere.
        </p>
        <div className="trust-grid">
          {ITEMS.map(([h, d]) => (
            <div key={h}>
              <h3>{h}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

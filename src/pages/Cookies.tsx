import LegalPageLayout from "@/components/LegalPageLayout";

const Cookies = () => (
  <LegalPageLayout
    title="Cookie Policy"
    subtitle="What cookies we use and why."
    updatedAt="April 2026"
  >
    <section>
      <h2 className="text-lg font-semibold text-foreground">What are cookies?</h2>
      <p>
        Cookies are small text files stored on your device when you visit a website. They help the
        site remember you between visits and power features like staying signed in.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">Cookies we use</h2>
      <div className="not-prose mt-4 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Purpose</th>
              <th className="px-4 py-3">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-muted-foreground">
            <tr>
              <td className="px-4 py-3 font-mono text-xs text-foreground">sb-access-token</td>
              <td className="px-4 py-3">Keeps you signed in.</td>
              <td className="px-4 py-3">1 hour</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-xs text-foreground">sb-refresh-token</td>
              <td className="px-4 py-3">Refreshes your session securely.</td>
              <td className="px-4 py-3">30 days</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-xs text-foreground">epiclotto-prefs</td>
              <td className="px-4 py-3">Remembers your UI preferences.</td>
              <td className="px-4 py-3">1 year</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-xs text-foreground">_ga / _ga_*</td>
              <td className="px-4 py-3">Anonymous analytics (Google Analytics).</td>
              <td className="px-4 py-3">2 years</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">Managing cookies</h2>
      <p>
        Most browsers let you block or delete cookies via their settings. Note that disabling
        essential cookies will prevent you from signing in or completing purchases.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">Third parties</h2>
      <p>
        We use a small number of trusted providers (payments, analytics, support chat) that may
        set their own cookies. Their policies govern how those cookies are used.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">Contact</h2>
      <p>
        Questions? Email <span className="text-foreground">privacy@epiclotto.com</span>.
      </p>
    </section>
  </LegalPageLayout>
);

export default Cookies;

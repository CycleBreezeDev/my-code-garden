import LegalPageLayout from "@/components/LegalPageLayout";

const Privacy = () => (
  <LegalPageLayout
    title="Privacy Policy"
    subtitle="How we collect, use, and protect your personal data."
    updatedAt="April 2026"
  >
    <section>
      <h2 className="text-lg font-semibold text-foreground">1. Data we collect</h2>
      <p>
        We collect the information you provide when you create an account (name, email, password
        hash), make a purchase (payment reference, billing country), or contact support. We also
        log technical data such as IP address, device type, and browser version for security and
        fraud prevention.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">2. How we use it</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>To purchase, store, and deliver lottery tickets you order.</li>
        <li>To process payments and pay out winnings.</li>
        <li>To verify your identity when required by law.</li>
        <li>To send transactional emails (order confirmations, draw results, payouts).</li>
        <li>To improve the product and prevent abuse.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">3. Sharing</h2>
      <p>
        We share data only with the processors required to run the service: payment providers,
        cloud hosting, email delivery, and KYC partners. We never sell personal data.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">4. Your rights</h2>
      <p>
        Depending on your jurisdiction, you may have the right to access, correct, export, or
        delete your personal data. Email <span className="text-foreground">privacy@epiclotto.com</span> to
        exercise any of these rights.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">5. Retention</h2>
      <p>
        Account and transaction records are retained for as long as required by anti-money-laundering
        rules (typically 5 years after account closure). Marketing data is deleted within 30 days of
        unsubscribe.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">6. Security</h2>
      <p>
        Data is encrypted in transit (TLS 1.2+) and at rest. Passwords are hashed using industry
        standard algorithms. Access to production systems is restricted and audited.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">7. Contact</h2>
      <p>
        Privacy questions? Email our Data Protection Officer at <span className="text-foreground">privacy@epiclotto.com</span>.
      </p>
    </section>
  </LegalPageLayout>
);

export default Privacy;

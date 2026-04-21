import LegalPageLayout from "@/components/LegalPageLayout";

const Terms = () => (
  <LegalPageLayout
    title="Terms of Service"
    subtitle="The rules that govern your use of EpicLotto."
    updatedAt="April 2026"
  >
    <section>
      <h2 className="text-lg font-semibold text-foreground">1. About EpicLotto</h2>
      <p>
        EpicLotto is a ticket messenger service. We purchase official lottery tickets on your
        behalf from licensed retailers and hold them in trust until the draw is completed. We are
        not a lottery operator and do not run any draws ourselves.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">2. Eligibility</h2>
      <p>
        You must be at least 18 years old (or the legal gambling age in your jurisdiction,
        whichever is higher) and reside in a country where our service is permitted. By using
        EpicLotto you confirm that you meet these requirements.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">3. Orders and tickets</h2>
      <p>
        When you place an order, you authorize us to purchase the corresponding ticket(s) on your
        behalf. A scan or image of every ticket is uploaded to your account before the draw cut-off
        time. Orders cannot be cancelled once a ticket has been purchased.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">4. Group tickets and shares</h2>
      <p>
        When you join a syndicate or group ticket, you purchase a defined number of shares. Any
        prize is split pro-rata across all shareholders, less the platform fee disclosed at
        checkout.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">5. Payouts</h2>
      <p>
        Winnings are credited to your EpicLotto balance after the operator publishes official
        results and we receive funds. Withdrawals are subject to identity verification and any
        applicable tax withholding required in the lottery's jurisdiction.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">6. Fees</h2>
      <p>
        Our service fee is included in the displayed ticket or share price. A platform fee may
        apply to prizes above defined thresholds; this is always disclosed before purchase.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">7. Liability</h2>
      <p>
        EpicLotto is not liable for changes to lottery rules, jackpots, or operator decisions. Our
        maximum liability for any claim related to a ticket is limited to the amount you paid for
        that ticket.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">8. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. Material changes will be communicated via
        email or in-app notice at least 14 days before they take effect.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">9. Contact</h2>
      <p>
        Questions about these terms? Reach us at <span className="text-foreground">support@epiclotto.com</span>.
      </p>
    </section>
  </LegalPageLayout>
);

export default Terms;

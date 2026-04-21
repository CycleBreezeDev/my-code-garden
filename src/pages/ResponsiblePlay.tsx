import LegalPageLayout from "@/components/LegalPageLayout";
import { ShieldCheck, Clock, Wallet, LifeBuoy } from "lucide-react";

const Pillar = ({ icon: Icon, title, desc }: { icon: typeof ShieldCheck; title: string; desc: string }) => (
  <div className="rounded-xl border border-border bg-card p-5">
    <Icon className="h-5 w-5 text-primary" />
    <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
  </div>
);

const ResponsiblePlay = () => (
  <LegalPageLayout
    title="Responsible Play"
    subtitle="Lotteries should be fun. Here's how we help you stay in control."
    updatedAt="April 2026"
  >
    <div className="not-prose grid gap-4 sm:grid-cols-2">
      <Pillar
        icon={Wallet}
        title="Set a budget"
        desc="Decide what you can afford to lose before you play and stick to it."
      />
      <Pillar
        icon={Clock}
        title="Set time limits"
        desc="Use account limits to cap how often and how long you play each week."
      />
      <Pillar
        icon={ShieldCheck}
        title="Self-exclude"
        desc="Pause your account for 30, 90, or 180 days at any time from settings."
      />
      <Pillar
        icon={LifeBuoy}
        title="Get help"
        desc="If gambling stops being fun, free confidential support is available 24/7."
      />
    </div>

    <section>
      <h2 className="text-lg font-semibold text-foreground">Warning signs</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Spending more than you planned or chasing losses.</li>
        <li>Hiding play activity from family or friends.</li>
        <li>Borrowing money to fund tickets or shares.</li>
        <li>Feeling anxious, irritable, or low when not playing.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">Tools we provide</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li><strong className="text-foreground">Deposit limits</strong> — daily, weekly, monthly caps.</li>
        <li><strong className="text-foreground">Reality checks</strong> — periodic on-screen reminders of session length.</li>
        <li><strong className="text-foreground">Cool-off periods</strong> — temporary lockouts of 24h to 6 weeks.</li>
        <li><strong className="text-foreground">Self-exclusion</strong> — long-term account closure.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-lg font-semibold text-foreground">Support organisations</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>BeGambleAware — <span className="text-foreground">begambleaware.org</span></li>
        <li>Gamblers Anonymous — <span className="text-foreground">gamblersanonymous.org</span></li>
        <li>National Council on Problem Gambling (US) — <span className="text-foreground">1-800-522-4700</span></li>
      </ul>
    </section>

    <p className="text-xs text-muted-foreground">
      You must be 18+ to use EpicLotto. Underage play is strictly prohibited.
    </p>
  </LegalPageLayout>
);

export default ResponsiblePlay;

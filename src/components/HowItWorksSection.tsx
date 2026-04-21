import { Search, CreditCard, ScanLine, Trophy } from "lucide-react";

const steps = [
  {
    icon: Search,
    step: "01",
    title: "Choose Lottery",
    description: "Browse Powerball, Mega Millions, EuroMillions and more.",
  },
  {
    icon: CreditCard,
    step: "02",
    title: "Purchase Tickets",
    description: "Buy real tickets with up to 20% multi-draw discount.",
  },
  {
    icon: ScanLine,
    step: "03",
    title: "View Scans",
    description: "Every ticket is scanned and uploaded to your panel.",
  },
  {
    icon: Trophy,
    step: "04",
    title: "Collect Winnings",
    description: "Winnings deposited automatically to your account.",
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 text-center">
          <h2 className="mb-3 font-heading text-3xl font-bold lg:text-4xl">
            How It <span className="text-gradient-gold">Works</span>
          </h2>
          <p className="mx-auto max-w-xl text-base text-muted-foreground">
            Four simple steps to playing the world's biggest lotteries.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.step} className="relative">
              {index < steps.length - 1 && (
                <div className="absolute right-0 top-10 hidden h-px w-full translate-x-1/2 lg:block"
                  style={{ background: 'linear-gradient(90deg, hsl(var(--primary) / 0.3), transparent)' }}
                />
              )}
              <div className="rounded-2xl border border-border bg-card p-6 text-center transition-all hover:border-primary/20">
                <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                  <step.icon className="h-8 w-8 text-primary" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {step.step}
                  </span>
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-foreground">{step.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;

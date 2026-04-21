import { Link } from "react-router-dom";

const Footer = () => {
  const links = {
    Lotteries: [
      { label: "Powerball", href: "/lottery/powerball" },
      { label: "Mega Millions", href: "/lottery/mega-millions" },
      { label: "EuroMillions", href: "/lottery/euromillions" },
      { label: "All Lotteries", href: "/lotteries" },
    ],
    Company: [
      { label: "How It Works", href: "/#how-it-works" },
      { label: "Syndicates", href: "/syndicates" },
      { label: "Results", href: "/results" },
      { label: "Contact", href: "/contact" },
    ],
    Legal: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Responsible Play", href: "/responsible-play" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
  };

  return (
    <footer className="border-t border-border bg-card/30">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-black text-primary-foreground">E</span>
              </div>
              <span className="font-heading text-lg font-bold text-foreground">
                Epic<span className="text-primary">Lotto</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Your trusted lottery ticket messenger service. Real tickets, real transparency.
            </p>
          </div>

          {Object.entries(links).map(([title, items]) => (
            <div key={title}>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link to={item.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-8 text-center text-xs text-muted-foreground">
          <p>© 2026 EpicLotto. All rights reserved. Play responsibly. Must be 18+.</p>
          <p className="mt-1.5">Lottery results and jackpot amounts are estimates. EpicLotto is a ticket messenger service.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

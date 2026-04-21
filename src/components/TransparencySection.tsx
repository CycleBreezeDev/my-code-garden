import { Button } from "@/components/ui/button";
import { ShieldCheck, Eye, Lock, CheckCircle } from "lucide-react";

const TransparencySection = () => {
  return (
    <section id="transparency" className="border-t border-border/50 bg-secondary/20 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/20">
              <div className="border-b border-border bg-secondary/50 px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-primary/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                  <span className="ml-3 text-xs text-muted-foreground font-medium">My Tickets — Control Panel</span>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { name: "Powerball — Draw #892", date: "Apr 10, 2026", status: "Scanned", statusColor: "text-primary" },
                  { name: "Mega Millions — Draw #445", date: "Apr 11, 2026", status: "Verified", statusColor: "text-green-400" },
                  { name: "EuroMillions — Draw #1621", date: "Apr 12, 2026", status: "Pending", statusColor: "text-muted-foreground" },
                ].map((ticket, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-4">
                    <div>
                      <div className="text-sm font-medium text-card-foreground">{ticket.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{ticket.date}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${ticket.statusColor}`}>{ticket.status}</span>
                      <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <h2 className="mb-5 font-heading text-3xl font-bold lg:text-4xl">
              100% <span className="text-gradient-gold">Transparent</span>
            </h2>
            <p className="mb-8 text-base leading-relaxed text-muted-foreground">
              Every ticket is scanned and uploaded to your personal control panel. View, verify, and track at any time.
            </p>

            <div className="mb-8 space-y-3">
              {[
                { icon: ShieldCheck, text: "Scanned images of every ticket" },
                { icon: Eye, text: "Real-time draw result tracking" },
                { icon: Lock, text: "Encrypted personal dashboard" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{text}</span>
                </div>
              ))}
            </div>

            <Button size="lg" className="bg-primary px-8 font-semibold text-primary-foreground shadow-lg shadow-primary/20">
              View Demo Panel
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TransparencySection;

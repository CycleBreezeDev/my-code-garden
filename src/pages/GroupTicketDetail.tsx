import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Users, Ticket, Shield, ArrowRight, CheckCircle, TrendingUp, HelpCircle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SyndicateChat } from "@/components/social/SyndicateChat";
import { SyndicateMembers } from "@/components/social/SyndicateMembers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet, formatMoney } from "@/contexts/WalletContext";
import { SyndicatePayConfirm } from "@/components/wallet/SyndicatePayConfirm";
import { toast } from "@/hooks/use-toast";
import { getColor, getLogo, formatJackpot, formatPrice, secondsUntil, dayName } from "@/lib/lotteryAssets";
import { Wallet as WalletIcon, Sparkles, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LuckyPicksEditor } from "@/components/syndicate/LuckyPicksEditor";
import { MyPicksCard } from "@/components/syndicate/MyPicksCard";
import MyTicketsSection from "@/components/MyTicketsSection";
import { parseFormat, type LuckyPick, type NumberFormat } from "@/lib/numberFormat";
import { useRef } from "react";

const faqs = [
  { q: "Do I pick my own numbers?", a: "It's optional. Each share you buy gives you one Lucky Pick line we'll add to the group's ticket bundle. Skip it and we use a Quick Pick. Either way, prizes are split 50/50." },
  { q: "How does a syndicate (group ticket) actually work?", a: "Members each buy one or more shares. The combined funds purchase a large pool of official lottery tickets for the next draw. Any prizes won by those tickets are split between the ticket buyer and the rest of the group based on the 50/50 rule." },
  { q: "How are winnings distributed?", a: "50% of any prize goes to the share holder linked to the winning ticket, and the remaining 50% is split equally among all members of the group — including the ticket holder." },
  { q: "Can I buy more than one share?", a: "Yes. You can join with 1x, 2x, or 5x shares. Each additional share gives you more tickets in the pool and a larger portion of the 50% group split." },
  { q: "Are the tickets real and verifiable?", a: "Absolutely. Every ticket purchased for the group is officially scanned and uploaded to your control panel before the draw." },
  { q: "Can I leave a group after joining?", a: "Shares are locked once the next draw begins because the tickets are already purchased. You can choose not to renew for the following draw." },
];

type SyndicateDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  total_shares: number;
  sold_shares: number;
  price_per_share: number;
  currency: string;
  status: string;
  picks_lock_offset_minutes: number;
  draw: {
    id: string;
    draw_date: string;
    jackpot_amount: number;
    currency: string;
    lottery: { slug: string; name: string; color: string | null; icon: string | null; draw_days: string | null; logo_url: string | null; number_format: unknown };
  };
};

const CountdownTimer = ({ totalSeconds }: { totalSeconds: number }) => {
  const [remaining, setRemaining] = useState(totalSeconds);
  useEffect(() => {
    setRemaining(totalSeconds);
    const interval = setInterval(() => setRemaining((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, [totalSeconds]);
  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const pad = (n: number) => String(n).padStart(2, "0").split("");
  const units = [{ label: "DAYS", digits: pad(d) }, { label: "HRS", digits: pad(h) }, { label: "MIN", digits: pad(m) }, { label: "SEC", digits: pad(s) }];
  return (
    <div className="flex items-center gap-3">
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center gap-1">
          <div className="flex gap-0.5">
            {u.digits.map((digit, j) => (
              <span key={j} className="flex h-10 w-8 items-center justify-center rounded-lg bg-secondary border border-border text-sm font-bold text-foreground">{digit}</span>
            ))}
          </div>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{u.label}</span>
        </div>
      ))}
    </div>
  );
};

const GroupTicketDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { wallets, refresh: refreshWallet } = useWallet();
  const queryClient = useQueryClient();
  const [shares, setShares] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [picksOpen, setPicksOpen] = useState(false);
  const [picks, setPicks] = useState<LuckyPick[]>([]);
  const [myMembershipId, setMyMembershipId] = useState<string | null>(null);
  const ticketsRef = useRef<HTMLDivElement | null>(null);
  const [verifyShare, setVerifyShare] = useState<number | null>(null);
  const handleVerifyShare = (shareIndex: number) => {
    setVerifyShare(shareIndex);
    // Smooth scroll then nudge so the highlighted scan sits below the sticky navbar
    requestAnimationFrame(() => {
      ticketsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const { data: group, isLoading } = useQuery({
    queryKey: ["syndicate", slug],
    queryFn: async (): Promise<SyndicateDetail | null> => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("syndicates")
        .select("id, slug, name, description, total_shares, sold_shares, price_per_share, currency, status, picks_lock_offset_minutes, draw:lottery_draws!inner(id, draw_date, jackpot_amount, currency, lottery:lotteries!inner(slug, name, color, icon, draw_days, logo_url, number_format))")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SyndicateDetail | null;
    },
    enabled: !!slug,
  });

  const joinMutation = useMutation({
    mutationFn: async (sharesAmount: number) => {
      const callback_url = `${window.location.origin}/payment/callback`;
      const { data, error } = await supabase.functions.invoke("paystack-init", {
        body: { syndicate_id: group!.id, shares: sharesAmount, callback_url },
      });
      if (error) throw error;
      if (!data?.authorization_url) throw new Error(data?.error || "Could not start payment");
      // Stash picks for the callback page to forward to paystack-verify
      try {
        const cleaned = (picks ?? []).filter((p) => p.main.length > 0).slice(0, sharesAmount);
        if (data.reference && cleaned.length > 0) {
          sessionStorage.setItem(`picks:${data.reference}`, JSON.stringify(cleaned));
        }
      } catch {
        /* ignore storage errors */
      }
      return data.authorization_url as string;
    },
    onSuccess: (authorization_url) => {
      window.location.href = authorization_url;
    },
    onError: (err: Error) => {
      toast({ title: "Could not start payment", description: err.message, variant: "destructive" });
    },
  });

  // Existing membership (so member sees MyPicksCard + edits picks after joining)
  const { data: membership } = useQuery({
    queryKey: ["my-membership", group?.id, user?.id],
    enabled: !!user && !!group?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("syndicate_memberships")
        .select("id, shares")
        .eq("syndicate_id", group!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // wallet pay (incl. cross-currency) is handled inside SyndicatePayConfirm

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center pt-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-32 text-center text-muted-foreground">Group not found.</div>
      </div>
    );
  }

  const spotsLeft = group.total_shares - group.sold_shares;
  const lottery = group.draw.lottery;
  const color = getColor(lottery);
  const logo = getLogo(lottery);
  const shareOptions = [1, 2, 5].filter((n) => n <= spotsLeft);
  const totalPrice = (group.price_per_share * shares).toFixed(2);
  const currencySymbol = group.currency === "EUR" ? "€" : group.currency === "GBP" ? "£" : "$";
  const numberFormat: NumberFormat = parseFormat(lottery.number_format);
  const lockHours = Math.round((group.picks_lock_offset_minutes ?? 120) / 60);

  const handleJoinClick = () => {
    if (!user) {
      navigate("/login", { state: { from: { pathname: `/group/${slug}` } } });
      return;
    }
    setShowConfirm(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <span>/</span>
            <Link to="/syndicates" className="hover:text-primary transition-colors">Group Tickets</Link>
            <span>/</span>
            <span className="text-foreground">{group.name}</span>
          </div>

          <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-5">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2"
                style={{ borderColor: `${color}40`, background: `radial-gradient(circle, ${color}15, ${color}05)` }}
              >
                {logo ? (
                  <img src={logo} alt={lottery.name} className="h-14 w-14 object-contain" loading="lazy" />
                ) : (
                  <Users className="h-8 w-8" style={{ color }} />
                )}
              </div>
              <div>
                <h1 className="font-heading text-3xl font-bold mb-1">{group.name}</h1>
                <p className="text-sm text-muted-foreground mb-2">{group.draw.lottery.name} Syndicate</p>
                <p className="text-sm text-muted-foreground max-w-md">{group.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Jackpot</div>
                <div className="font-heading text-3xl font-bold text-primary">
                  {formatJackpot(group.draw.jackpot_amount, group.draw.currency)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid gap-4 sm:grid-cols-4">
                {[
                  { label: "Total Shares", value: group.total_shares.toString(), icon: Ticket },
                  { label: "Members", value: `${group.sold_shares}/${group.total_shares}`, icon: Users },
                  { label: "Spots Left", value: spotsLeft.toString(), icon: CheckCircle },
                  { label: "Per Share", value: formatPrice(group.price_per_share, group.currency), icon: TrendingUp },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-border bg-card p-4 text-center">
                    <stat.icon className="mx-auto mb-2 h-5 w-5 text-primary" />
                    <div className="text-xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>

              <Tabs defaultValue="about" className="w-full">
                <TabsList>
                  <TabsTrigger value="about">About</TabsTrigger>
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                </TabsList>
                <TabsContent value="members" className="mt-4">
                  <SyndicateMembers syndicateId={group.id} />
                </TabsContent>
                <TabsContent value="chat" className="mt-4">
                  <SyndicateChat syndicateId={group.id} />
                </TabsContent>
                <TabsContent value="about" className="mt-4 space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">How the 50/50 Split Works</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
                    <div className="text-sm font-semibold text-primary mb-1">50% — Ticket Buyer</div>
                    <p className="text-xs text-muted-foreground">Half of all winnings go directly to the person whose ticket matched the winning numbers.</p>
                  </div>
                  <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
                    <div className="text-sm font-semibold text-primary mb-1">50% — Shared Pool</div>
                    <p className="text-xs text-muted-foreground">The other half is divided equally among all group members, including the ticket buyer.</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span>All tickets are scanned and visible in your control panel for full transparency.</span>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4 flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Frequently Asked Questions</h2>
                </div>
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((item, i) => (
                    <AccordionItem key={i} value={`faq-${i}`} className="border-border">
                      <AccordionTrigger className="text-left text-sm font-medium text-foreground hover:no-underline hover:text-primary">{item.q}</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{item.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
                </TabsContent>
              </Tabs>

              {membership && (
                <MyPicksCard
                  membershipId={membership.id}
                  syndicateId={group.id}
                  shares={membership.shares}
                  format={numberFormat}
                  drawDate={group.draw.draw_date}
                  picksLockOffsetMinutes={group.picks_lock_offset_minutes ?? 120}
                  syndicateName={group.name}
                  lotteryColor={color}
                  onVerifyOnTicket={handleVerifyShare}
                />
              )}

              {membership && (
                <div ref={ticketsRef} id="ticket-scans">
                  <MyTicketsSection
                    syndicateFilter={group.id}
                    highlightSyndicateId={group.id}
                    highlightShareIndex={verifyShare}
                    onHighlightConsumed={() => setVerifyShare(null)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="sticky top-24 rounded-2xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Join This Group</h3>

                <div className="mb-5">
                  <div className="text-xs text-muted-foreground mb-2">Time left to join</div>
                  <CountdownTimer totalSeconds={secondsUntil(group.draw.draw_date)} />
                  <div className="mt-2 text-xs text-muted-foreground">Draws on <span className="font-medium text-foreground">{dayName(group.draw.draw_date)}</span></div>
                </div>

                <div className="mb-5">
                  <div className="text-xs text-muted-foreground mb-2">Members joined</div>
                  <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(group.sold_shares / group.total_shares) * 100}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                    <span>{group.sold_shares} joined</span>
                    <span>{spotsLeft} spots left</span>
                  </div>
                </div>

                {spotsLeft > 0 ? (
                  <>
                    <div className="mb-4">
                      <div className="text-xs text-muted-foreground mb-2">Choose shares</div>
                      <div className="grid grid-cols-3 gap-2">
                        {shareOptions.map((n) => (
                          <button
                            key={n}
                            onClick={() => setShares(n)}
                            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                              shares === n ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-foreground hover:border-primary/40"
                            }`}
                          >
                            {n}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-primary">
                        <Info className="h-3.5 w-3.5" /> How numbers work
                      </div>
                      <p>This is a <span className="text-foreground">pooled</span> group — we buy a bundle of official tickets for everyone. Most lines are Quick Picks. You can optionally pick your own numbers (1 line per share). Whichever ticket wins, prizes split 50/50.</p>
                    </div>

                    <Collapsible open={picksOpen} onOpenChange={setPicksOpen}>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="mb-3 flex w-full items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-sm font-medium text-foreground hover:border-primary/40"
                        >
                          <span className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            Add my Lucky Picks <span className="text-xs text-muted-foreground">(optional)</span>
                          </span>
                          <span className="text-xs text-muted-foreground">{picksOpen ? "Hide" : "Show"}</span>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mb-4">
                        <LuckyPicksEditor
                          shares={shares}
                          format={numberFormat}
                          picks={picks}
                          onChange={setPicks}
                        />
                      </CollapsibleContent>
                    </Collapsible>

                    <div className="mb-5 flex items-center justify-between rounded-xl bg-secondary/30 border border-border p-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Total</div>
                        <div className="font-heading text-xl font-bold text-foreground">{currencySymbol}{totalPrice}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">{shares} share{shares > 1 ? "s" : ""}</div>
                        <div className="text-xs text-primary">{currencySymbol}{group.price_per_share.toFixed(2)} each</div>
                      </div>
                    </div>

                    <Button onClick={handleJoinClick} className="w-full bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20">
                      {user ? "Join Group" : "Sign in to Join"} <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">Picks lock {lockHours}h before draw — you can edit later.</p>
                  </>
                ) : (
                  <div className="rounded-xl bg-secondary/30 border border-border p-4 text-center text-sm text-muted-foreground">This group is full.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={showConfirm} onOpenChange={(o) => !joinMutation.isPending && setShowConfirm(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm your purchase</DialogTitle>
          </DialogHeader>
          <SyndicatePayConfirm
            syndicateId={group.id}
            syndicateName={group.name}
            syndicateCurrency={group.currency}
            pricePerShare={group.price_per_share}
            shares={shares}
            picks={picks}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ["syndicate", slug] });
              await queryClient.invalidateQueries({ queryKey: ["my-membership", group.id, user?.id] });
              setShowConfirm(false);
              toast({ title: "You're in!", description: "Your shares have been purchased from your wallet." });
              navigate("/dashboard");
            }}
            onCancel={() => setShowConfirm(false)}
            onCardFallback={() => joinMutation.mutate(shares)}
            cardFallbackLabel="Pay with card (Paystack)"
            cardFallbackPending={joinMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default GroupTicketDetail;

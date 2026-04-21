import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/lotteryAssets";

type Payout = {
  id: string;
  shares: number;
  gross_prize: number;
  platform_fee: number;
  net_amount: number;
  created_at: string;
  syndicate: { name: string; currency: string } | null;
};

const MyPayoutsSection = () => {
  const { user } = useAuth();

  const { data: payouts, isLoading } = useQuery({
    queryKey: ["my-payouts", user?.id],
    queryFn: async (): Promise<Payout[]> => {
      const { data, error } = await supabase
        .from("payouts")
        .select("id, shares, gross_prize, platform_fee, net_amount, created_at, syndicate:syndicates(name, currency)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Payout[]) ?? [];
    },
    enabled: !!user,
  });

  const totalNet = payouts?.reduce((s, p) => s + Number(p.net_amount), 0) ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">My Winnings</h2>
        </div>
        {payouts && payouts.length > 0 && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-sm font-semibold text-primary">{formatPrice(totalNet)}</div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : payouts && payouts.length > 0 ? (
        <div className="space-y-2">
          {payouts.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-border bg-secondary/20 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {p.syndicate?.name ?? "Syndicate"}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {p.shares} share{p.shares > 1 ? "s" : ""} · fee{" "}
                  {formatPrice(Number(p.platform_fee), p.syndicate?.currency)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-primary">
                  +{formatPrice(Number(p.net_amount), p.syndicate?.currency)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No winnings yet — good luck on the next draw!</p>
        </div>
      )}
    </div>
  );
};

export default MyPayoutsSection;

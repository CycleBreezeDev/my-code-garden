import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWallet, formatMoney } from "@/contexts/WalletContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDownLeft, ArrowUpRight, Trophy, Users, ExternalLink } from "lucide-react";

const KIND_LABEL: Record<string, { label: string; icon: any; color: string }> = {
  deposit: { label: "Top-up", icon: ArrowDownLeft, color: "text-primary" },
  withdrawal: { label: "Withdrawal", icon: ArrowUpRight, color: "text-destructive" },
  payout_in: { label: "Lottery payout", icon: Trophy, color: "text-primary" },
  syndicate_purchase: { label: "Group ticket", icon: Users, color: "text-destructive" },
  syndicate_spend: { label: "Group ticket", icon: Users, color: "text-destructive" },
  refund: { label: "Refund", icon: ArrowDownLeft, color: "text-primary" },
  fee: { label: "Fee", icon: ArrowUpRight, color: "text-muted-foreground" },
  adjustment: { label: "Adjustment", icon: ArrowUpRight, color: "text-muted-foreground" },
  hold: { label: "Hold", icon: ArrowUpRight, color: "text-muted-foreground" },
  release: { label: "Release", icon: ArrowDownLeft, color: "text-muted-foreground" },
};

type SynInfo = { name: string; slug: string };
type DrawInfo = { draw_date: string; lottery_name: string; lottery_slug: string };
type WdInfo = {
  source_amount: number | null;
  source_currency: string | null;
  fx_rate: number | null;
  fx_markup_percent: number | null;
  amount: number;
  currency: string;
};

export const TransactionsList = () => {
  const { transactions } = useWallet();
  const [syndicateMap, setSyndicateMap] = useState<Record<string, SynInfo>>({});
  const [drawMap, setDrawMap] = useState<Record<string, DrawInfo>>({});
  const [wdMap, setWdMap] = useState<Record<string, WdInfo>>({});

  const syndicateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of transactions) {
      if (t.kind === "syndicate_purchase" || t.kind === "syndicate_spend") {
        const sid = (t.metadata as { syndicate_id?: string })?.syndicate_id;
        if (sid) ids.add(sid);
      }
    }
    return Array.from(ids);
  }, [transactions]);

  const drawIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of transactions) {
      if (t.kind === "payout_in") {
        const did = (t.metadata as { draw_id?: string })?.draw_id;
        if (did) ids.add(did);
      }
    }
    return Array.from(ids);
  }, [transactions]);

  const withdrawalIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of transactions) {
      if (t.kind === "withdrawal" || t.kind === "hold" || t.kind === "refund") {
        const wid = (t.metadata as { withdrawal_id?: string })?.withdrawal_id;
        if (wid) ids.add(wid);
      }
    }
    return Array.from(ids);
  }, [transactions]);

  useEffect(() => {
    const missing = syndicateIds.filter((id) => !syndicateMap[id]);
    if (missing.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("syndicates")
        .select("id, name, slug")
        .in("id", missing);
      if (!data) return;
      setSyndicateMap((m) => {
        const next = { ...m };
        for (const s of data) next[s.id] = { name: s.name, slug: s.slug };
        return next;
      });
    })();
  }, [syndicateIds, syndicateMap]);

  useEffect(() => {
    const missing = drawIds.filter((id) => !drawMap[id]);
    if (missing.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("lottery_draws")
        .select("id, draw_date, lotteries:lottery_id(name, slug)")
        .in("id", missing);
      if (!data) return;
      setDrawMap((m) => {
        const next = { ...m };
        for (const d of data as any[]) {
          next[d.id] = {
            draw_date: d.draw_date,
            lottery_name: d.lotteries?.name ?? "Lottery",
            lottery_slug: d.lotteries?.slug ?? "",
          };
        }
        return next;
      });
    })();
  }, [drawIds, drawMap]);

  useEffect(() => {
    const missing = withdrawalIds.filter((id) => !wdMap[id]);
    if (missing.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("withdrawal_requests")
        .select("id, amount, currency, source_amount, source_currency, fx_rate, fx_markup_percent")
        .in("id", missing);
      if (!data) return;
      setWdMap((m) => {
        const next = { ...m };
        for (const w of data as any[]) {
          next[w.id] = {
            amount: Number(w.amount),
            currency: w.currency,
            source_amount: w.source_amount,
            source_currency: w.source_currency,
            fx_rate: w.fx_rate,
            fx_markup_percent: w.fx_markup_percent,
          };
        }
        return next;
      });
    })();
  }, [withdrawalIds, wdMap]);


  return (
    <Card>
      <CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {transactions.map((t) => {
              const meta = KIND_LABEL[t.kind] || { label: t.kind, icon: ArrowUpRight, color: "text-muted-foreground" };
              const Icon = meta.icon;
              const sign = t.amount >= 0 ? "+" : "−";
              const isSyndicate = t.kind === "syndicate_purchase" || t.kind === "syndicate_spend";
              const sid = isSyndicate ? (t.metadata as { syndicate_id?: string })?.syndicate_id : undefined;
              const syn = sid ? syndicateMap[sid] : undefined;
              const isPayout = t.kind === "payout_in";
              const did = isPayout ? (t.metadata as { draw_id?: string })?.draw_id : undefined;
              const draw = did ? drawMap[did] : undefined;
              const md = (t.metadata || {}) as Record<string, any>;
              const isWithdrawal = t.kind === "withdrawal" || t.kind === "hold" || t.kind === "refund";
              const wid = isWithdrawal ? (md.withdrawal_id as string | undefined) : undefined;
              const wd = wid ? wdMap[wid] : undefined;
              const fxRate = md.fx_rate ?? md.rate ?? wd?.fx_rate ?? undefined;
              const fxMarkup = md.fx_markup_percent ?? md.markup_percent ?? wd?.fx_markup_percent ?? undefined;
              const srcAmt = md.source_amount ?? wd?.source_amount ?? undefined;
              const srcCur = md.source_currency ?? wd?.source_currency ?? undefined;
              const dstAmt = md.target_amount ?? md.destination_amount ?? (wd ? wd.amount : undefined);
              const dstCur = md.target_currency ?? md.destination_currency ?? (wd ? wd.currency : undefined);
              const hasFx = (fxRate != null || srcAmt != null) && srcCur && dstCur && srcCur !== dstCur;
              return (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-secondary ${meta.color} shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {isSyndicate && syn ? (
                          <Link
                            to={`/group/${syn.slug}`}
                            className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                          >
                            {syn.name}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </Link>
                        ) : isPayout && draw ? (
                          draw.lottery_slug ? (
                            <Link
                              to={`/lottery/${draw.lottery_slug}`}
                              className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                            >
                              {draw.lottery_name}
                              <ExternalLink className="h-3 w-3 opacity-60" />
                            </Link>
                          ) : (
                            draw.lottery_name
                          )
                        ) : (
                          meta.label
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isSyndicate && syn ? `${meta.label} · ` : ""}
                        {isPayout && draw ? `${meta.label} · Draw ${new Date(draw.draw_date).toLocaleDateString()} · ` : ""}
                        {new Date(t.created_at).toLocaleString()}
                        {t.provider ? ` · ${t.provider}` : ""}
                      </div>
                      {hasFx && (
                        <div className="mt-1 text-[11px] text-muted-foreground tabular-nums space-x-2">
                          {srcAmt != null && srcCur && (
                            <span>From {formatMoney(Number(srcAmt), srcCur)}</span>
                          )}
                          {dstAmt != null && dstCur && (
                            <span>→ {formatMoney(Number(dstAmt), dstCur)}</span>
                          )}
                          {fxRate != null && srcCur && dstCur && (
                            <span>· 1 {srcCur} = {Number(fxRate).toFixed(4)} {dstCur}</span>
                          )}
                          {fxMarkup != null && (
                            <span>· markup {Number(fxMarkup).toFixed(2)}%</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-3">
                    <div className={`text-sm font-semibold tabular-nums ${t.amount >= 0 ? "text-primary" : "text-foreground"}`}>
                      {sign}{formatMoney(Math.abs(t.amount), t.currency)}
                    </div>
                    {t.status !== "completed" && <Badge variant="outline" className="text-[10px]">{t.status}</Badge>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

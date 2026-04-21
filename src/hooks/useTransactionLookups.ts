import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { WalletTransaction } from "@/contexts/WalletContext";
import type { SynInfo, DrawInfo, WdInfo } from "@/components/wallet/TransactionRow";

export const useTransactionLookups = (transactions: WalletTransaction[]) => {
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
      const { data } = await supabase.from("syndicates").select("id, name, slug").in("id", missing);
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

  return { syndicateMap, drawMap, wdMap };
};

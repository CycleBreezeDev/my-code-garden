import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { formatMoney, type WalletTransaction } from "@/contexts/WalletContext";
import { ArrowDownLeft, ArrowUpRight, Trophy, Users, ExternalLink } from "lucide-react";

export const KIND_LABEL: Record<string, { label: string; icon: any; color: string }> = {
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

export type SynInfo = { name: string; slug: string };
export type DrawInfo = { draw_date: string; lottery_name: string; lottery_slug: string };
export type WdInfo = {
  source_amount: number | null;
  source_currency: string | null;
  fx_rate: number | null;
  fx_markup_percent: number | null;
  amount: number;
  currency: string;
};

interface Props {
  t: WalletTransaction;
  syndicateMap: Record<string, SynInfo>;
  drawMap: Record<string, DrawInfo>;
  wdMap: Record<string, WdInfo>;
}

export const TransactionRow = ({ t, syndicateMap, drawMap, wdMap }: Props) => {
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
    <li className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-secondary ${meta.color} shrink-0`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {isSyndicate && syn ? (
              <Link to={`/group/${syn.slug}`} className="inline-flex items-center gap-1 hover:text-primary hover:underline">
                {syn.name}
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            ) : isPayout && draw ? (
              draw.lottery_slug ? (
                <Link to={`/lottery/${draw.lottery_slug}`} className="inline-flex items-center gap-1 hover:text-primary hover:underline">
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
              {srcAmt != null && srcCur && <span>From {formatMoney(Number(srcAmt), srcCur)}</span>}
              {dstAmt != null && dstCur && <span>→ {formatMoney(Number(dstAmt), dstCur)}</span>}
              {fxRate != null && srcCur && dstCur && (
                <span>· 1 {srcCur} = {Number(fxRate).toFixed(4)} {dstCur}</span>
              )}
              {fxMarkup != null && <span>· markup {Number(fxMarkup).toFixed(2)}%</span>}
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
};

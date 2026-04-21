import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  lotteryId: string;
  lotteryName: string;
  currentSyndicateId: string;
}

type DrawOption = {
  syndicate_id: string;
  slug: string;
  name: string;
  draw_date: string;
  is_member: boolean;
};

/**
 * Draw selector for a group page.
 *
 * One syndicate is bound to exactly one draw (`syndicates.draw_id`), so we
 * surface every *other* syndicate for the same lottery the user is a member of,
 * plus the currently viewed one. Selecting a chip routes to that syndicate's
 * page, which automatically rescopes `MyPicksCard` and the ticket scans to the
 * chosen draw.
 */
export const DrawSelector = ({ lotteryId, lotteryName, currentSyndicateId }: Props) => {
  const { user } = useAuth();

  const { data: options, isLoading } = useQuery({
    queryKey: ["draw-selector", lotteryId, user?.id, currentSyndicateId],
    enabled: !!user && !!lotteryId,
    queryFn: async (): Promise<DrawOption[]> => {
      // Pull memberships in syndicates for this lottery
      const { data, error } = await supabase
        .from("syndicate_memberships")
        .select(
          "syndicate:syndicates!inner(id, slug, name, draw:lottery_draws!inner(draw_date, lottery_id))"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;

      type Row = {
        syndicate: {
          id: string;
          slug: string;
          name: string;
          draw: { draw_date: string; lottery_id: string };
        };
      };
      const rows = (data as unknown as Row[]) ?? [];
      const seen = new Set<string>();
      const out: DrawOption[] = [];
      for (const r of rows) {
        const s = r.syndicate;
        if (!s || s.draw.lottery_id !== lotteryId) continue;
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        out.push({
          syndicate_id: s.id,
          slug: s.slug,
          name: s.name,
          draw_date: s.draw.draw_date,
          is_member: true,
        });
      }
      // Ensure the current syndicate is in the list even if not a member yet
      if (!seen.has(currentSyndicateId)) {
        const { data: cur } = await supabase
          .from("syndicates")
          .select("id, slug, name, draw:lottery_draws!inner(draw_date)")
          .eq("id", currentSyndicateId)
          .maybeSingle();
        if (cur) {
          type Cur = {
            id: string;
            slug: string;
            name: string;
            draw: { draw_date: string };
          };
          const c = cur as unknown as Cur;
          out.push({
            syndicate_id: c.id,
            slug: c.slug,
            name: c.name,
            draw_date: c.draw.draw_date,
            is_member: false,
          });
        }
      }
      // Newest draws first
      out.sort((a, b) => +new Date(b.draw_date) - +new Date(a.draw_date));
      return out;
    },
  });

  if (isLoading || !options || options.length <= 1) {
    // Hide entirely if there's only one (or zero) draws to choose from
    return null;
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {lotteryName} draw
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {options.length} draw{options.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {options.map((opt) => {
          const active = opt.syndicate_id === currentSyndicateId;
          const future = +new Date(opt.draw_date) > Date.now();
          const baseClasses =
            "snap-start shrink-0 rounded-xl border px-3 py-2 text-left transition-colors";
          if (active) {
            return (
              <div
                key={opt.syndicate_id}
                className={`${baseClasses} border-primary bg-primary/10`}
                aria-current="page"
              >
                <div className="text-[10px] font-bold uppercase tracking-wide text-primary">
                  {future ? "Upcoming" : "Past"} · viewing
                </div>
                <div className="text-sm font-semibold text-foreground whitespace-nowrap">
                  {fmt(opt.draw_date)}
                </div>
              </div>
            );
          }
          return (
            <Link
              key={opt.syndicate_id}
              to={`/group/${opt.slug}`}
              className={`${baseClasses} border-border bg-secondary/30 hover:border-primary/40 hover:bg-secondary/50`}
              title={opt.name}
            >
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {future ? "Upcoming" : "Past"}
                {opt.is_member ? " · joined" : ""}
              </div>
              <div className="flex items-center gap-1 text-sm font-semibold text-foreground whitespace-nowrap">
                {fmt(opt.draw_date)} <ChevronRight className="h-3 w-3 opacity-60" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

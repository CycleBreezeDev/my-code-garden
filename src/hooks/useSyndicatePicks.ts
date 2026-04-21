import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { LuckyPick } from "@/lib/numberFormat";

export type SyndicatePickRow = {
  id: string;
  syndicate_id: string;
  membership_id: string;
  user_id: string;
  share_index: number;
  main_numbers: number[];
  bonus_numbers: number[];
  status: "pending" | "included" | "quick_picked";
  created_at: string;
  updated_at: string;
};

export const useMyPicks = (membershipId: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-picks", membershipId],
    enabled: !!user && !!membershipId,
    queryFn: async (): Promise<SyndicatePickRow[]> => {
      const { data, error } = await supabase
        .from("syndicate_picks")
        .select("*")
        .eq("membership_id", membershipId!)
        .order("share_index");
      if (error) throw error;
      return (data ?? []) as SyndicatePickRow[];
    },
  });
};

export const useUpsertPicks = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      membershipId,
      picks,
    }: {
      membershipId: string;
      picks: LuckyPick[];
    }) => {
      // Only send complete picks; incomplete ones default to operator Quick Pick
      const payload = picks.filter((p) => p.main.length > 0);
      const { data, error } = await supabase.rpc("upsert_syndicate_picks", {
        _membership_id: membershipId,
        _picks: payload as unknown as never,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["my-picks", vars.membershipId] });
    },
  });
};

export type LockState = {
  locked: boolean;
  locksAt: Date | null;
};

export const computeLockState = (
  drawDate: string | Date,
  offsetMinutes: number
): LockState => {
  const draw = typeof drawDate === "string" ? new Date(drawDate) : drawDate;
  const locksAt = new Date(draw.getTime() - offsetMinutes * 60_000);
  return { locked: Date.now() >= locksAt.getTime(), locksAt };
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type TicketPickVerification = {
  id: string;
  user_id: string;
  ticket_image_id: string;
  syndicate_id: string;
  membership_id: string;
  share_index: number;
  verified_at: string;
};

/**
 * Per-user, per-(ticket_image × share_index) verification rows for a syndicate.
 * Backed by `public.ticket_pick_verifications` (RLS scoped to the owner).
 *
 * The table is loosely typed via `from(...) as any` because the generated
 * Supabase types are codegen'd and may not yet include this table on first
 * deploy. The shape is stable and safe to cast.
 */
export const useTicketPickVerifications = (syndicateId: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ticket-pick-verifications", syndicateId, user?.id],
    enabled: !!user && !!syndicateId,
    queryFn: async (): Promise<TicketPickVerification[]> => {
      const fromAny = supabase.from as unknown as (
        table: string
      ) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string
          ) => Promise<{ data: TicketPickVerification[] | null; error: { message: string } | null }>;
        };
      };
      const { data, error } = await fromAny("ticket_pick_verifications")
        .select("*")
        .eq("syndicate_id", syndicateId!);
      if (error) {
        // Table may not exist yet — return empty so UI degrades gracefully.
        if (/relation .* does not exist|schema cache/i.test(error.message)) {
          return [];
        }
        throw new Error(error.message);
      }
      return data ?? [];
    },
  });
};

type ToggleArgs = {
  ticketImageId: string;
  syndicateId: string;
  membershipId: string;
  shareIndex: number;
  /** true = mark verified, false = un-verify */
  verified: boolean;
};

export const useToggleTicketPickVerification = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (args: ToggleArgs) => {
      if (!user) throw new Error("Not signed in");
      const fromAny = supabase.from as unknown as (
        table: string
      ) => {
        insert: (
          row: Record<string, unknown>
        ) => Promise<{ error: { message: string } | null }>;
        delete: () => {
          eq: (col: string, val: string) => {
            eq: (col: string, val: string | number) => {
              eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        };
      };
      const tbl = fromAny("ticket_pick_verifications");
      if (args.verified) {
        const { error } = await tbl.insert({
          user_id: user.id,
          ticket_image_id: args.ticketImageId,
          syndicate_id: args.syndicateId,
          membership_id: args.membershipId,
          share_index: args.shareIndex,
        });
        // Ignore unique-violation duplicates (already verified)
        if (error && !/duplicate key|unique constraint/i.test(error.message)) {
          throw new Error(error.message);
        }
      } else {
        const { error } = await tbl
          .delete()
          .eq("user_id", user.id)
          .eq("share_index", args.shareIndex)
          .eq("ticket_image_id", args.ticketImageId);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["ticket-pick-verifications", vars.syndicateId, user?.id] });
    },
  });
};

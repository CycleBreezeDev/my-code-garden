import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the count of contact_submissions with status='new'.
 * Only fetches when `enabled` is true (i.e. user is admin).
 * Subscribes to realtime changes so the badge stays fresh.
 */
export const useUnreadContactCount = (enabled: boolean) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["unread-contact-count"],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("contact_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (error) throw error;
      return count ?? 0;
    },
    enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("contact-submissions-unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contact_submissions" },
        () => {
          qc.invalidateQueries({ queryKey: ["unread-contact-count"] });
          qc.invalidateQueries({ queryKey: ["admin-contact-submissions"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);

  return query.data ?? 0;
};

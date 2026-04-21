import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SyndicateTicketImage = {
  id: string;
  syndicate_id: string;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
};

/** Lightweight reusable hook for syndicate ticket scans (RLS scoped to members). */
export const useSyndicateTicketImages = (syndicateId: string | undefined) => {
  return useQuery({
    queryKey: ["ticket-images", syndicateId],
    enabled: !!syndicateId,
    queryFn: async (): Promise<SyndicateTicketImage[]> => {
      const { data, error } = await supabase
        .from("ticket_images")
        .select("*")
        .eq("syndicate_id", syndicateId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

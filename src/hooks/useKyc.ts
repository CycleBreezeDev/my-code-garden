import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type KycProfile = {
  id: string;
  user_id: string;
  tier: number;
  status: string;
  country: string | null;
  id_type: string | null;
  id_number: string | null;
  full_name: string | null;
  dob: string | null;
  rejection_reason: string | null;
  por_verified_at: string | null;
  selfie_verified_at: string | null;
};

export type KycTier = {
  tier: number;
  name: string;
  description: string | null;
  daily_limit_usd: number;
  monthly_limit_usd: number;
  requires_id: boolean;
  requires_selfie: boolean;
  requires_por: boolean;
};

export const useKyc = () => {
  const { user } = useAuth();
  const profileQ = useQuery({
    queryKey: ["kyc-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("kyc_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      return (data as KycProfile | null) ?? null;
    },
  });
  const tiersQ = useQuery({
    queryKey: ["kyc-tiers"],
    queryFn: async () => {
      const { data } = await supabase.from("kyc_tiers").select("*").order("tier", { ascending: true });
      return (data as KycTier[] | null) ?? [];
    },
  });
  const profile = profileQ.data;
  const currentTier = tiersQ.data?.find((t) => t.tier === (profile?.tier ?? 0));
  return {
    profile,
    tiers: tiersQ.data ?? [],
    currentTier,
    loading: profileQ.isLoading || tiersQ.isLoading,
    refetch: profileQ.refetch,
  };
};

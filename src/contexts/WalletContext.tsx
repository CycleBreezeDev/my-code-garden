import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface Wallet {
  id: string;
  currency: string;
  available_balance: number;
  pending_balance: number;
  lifetime_deposit: number;
  lifetime_withdrawn: number;
}

export interface WalletTransaction {
  id: string;
  currency: string;
  kind: string;
  amount: number;
  balance_after: number | null;
  status: string;
  provider: string | null;
  reference: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface WalletContextValue {
  wallets: Wallet[];
  transactions: WalletTransaction[];
  primary: Wallet | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setWallets([]);
      setTransactions([]);
      return;
    }
    setLoading(true);
    const [{ data: w }, { data: t }] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", user.id).order("currency"),
      supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    ]);
    setWallets((w as Wallet[]) || []);
    setTransactions((t as WalletTransaction[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`wallet-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  const primary = wallets.find((w) => w.available_balance > 0) || wallets[0] || null;

  return (
    <WalletContext.Provider value={{ wallets, transactions, primary, loading, refresh }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
};

export const formatMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

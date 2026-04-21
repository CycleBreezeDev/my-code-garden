import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const FLW_SECRET = Deno.env.get("FLUTTERWAVE_SECRET_KEY") ?? "";

const ALLOWED_CURRENCIES = ["USD", "NGN", "GHS", "ZAR", "KES"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const currency = String(body.currency || "").toUpperCase();
    const amount = Number(body.amount);
    const provider = String(body.provider || "");

    if (!ALLOWED_CURRENCIES.includes(currency)) return json({ error: "Invalid currency" }, 400);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return json({ error: "Invalid amount" }, 400);
    if (!["paystack", "flutterwave"].includes(provider)) return json({ error: "Invalid provider" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // KYC limit check (convert amount to USD via fx-quote when needed)
    let amountUsd = amount;
    if (currency !== "USD") {
      const q = await admin.functions.invoke("fx-quote", { body: { from: "USD", to: currency, to_amount: amount } });
      const qd = q.data as { from_amount?: number } | null;
      if (qd?.from_amount) amountUsd = Number(qd.from_amount);
    }
    const { data: gate } = await admin.rpc("kyc_can_transact", {
      _user_id: user.id, _amount_usd: amountUsd, _kind: "deposit",
    });
    const g = gate as { allowed?: boolean; reason?: string; remaining_monthly_usd?: number } | null;
    if (g && g.allowed === false) {
      return json({ error: g.reason || "KYC limit exceeded", kyc: g }, 403);
    }
    const reference = `topup_${user.id.slice(0, 8)}_${Date.now()}`;
    const callback = `${req.headers.get("origin") || ""}/payment/callback?type=topup`;

    let checkoutUrl = "";
    let providerRef = reference;

    if (provider === "paystack") {
      if (!PAYSTACK_SECRET) return json({ error: "Paystack not configured" }, 500);
      const res = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount: Math.round(amount * 100),
          currency,
          reference,
          callback_url: callback,
          metadata: { type: "wallet_topup", user_id: user.id, currency },
        }),
      });
      const data = await res.json();
      if (!data.status) return json({ error: data.message || "Paystack init failed" }, 400);
      checkoutUrl = data.data.authorization_url;
      providerRef = data.data.reference;
    } else {
      if (!FLW_SECRET) return json({ error: "Flutterwave not configured" }, 500);
      const res = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: { Authorization: `Bearer ${FLW_SECRET}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_ref: reference,
          amount,
          currency,
          redirect_url: callback,
          customer: { email: user.email, name: user.user_metadata?.full_name || user.email },
          meta: { type: "wallet_topup", user_id: user.id, currency },
        }),
      });
      const data = await res.json();
      if (data.status !== "success") return json({ error: data.message || "Flutterwave init failed" }, 400);
      checkoutUrl = data.data.link;
    }

    // Record pending tx
    await admin.from("wallet_transactions").insert({
      user_id: user.id,
      currency,
      kind: "deposit",
      amount,
      status: "pending",
      provider,
      provider_ref: providerRef,
      reference,
      metadata: { initiated: true },
    });

    return json({ checkout_url: checkoutUrl, reference });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

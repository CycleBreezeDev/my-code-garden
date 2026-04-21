import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const FLW_SECRET = Deno.env.get("FLUTTERWAVE_SECRET_KEY") ?? "";

type Destination = Record<string, unknown>;

Deno.serve(async (req) => {
  // GET /health — public liveness probe (no auth, no side effects)
  if (req.method === "GET" && new URL(req.url).pathname.endsWith("/health")) {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const currency = String(body.currency || "").toUpperCase(); // destination currency
    const amount = Number(body.amount); // destination amount
    const destination_type = String(body.destination_type || "");
    const destination: Destination = body.destination || {};
    const sourceCurrency = String(body.source_currency || currency).toUpperCase(); // wallet to debit

    const validDest = ["ng_bank","gh_bank","ke_bank","za_bank","intl_bank","paypal","paystack_account","flutterwave_account"];
    if (!validDest.includes(destination_type)) return json({ error: "Invalid destination" }, 400);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Invalid amount" }, 400);
    if (!currency) return json({ error: "Invalid currency" }, 400);

    let provider: "paystack" | "flutterwave" | "manual" = "manual";
    if (["ng_bank","gh_bank","ke_bank","paystack_account"].includes(destination_type)) provider = "paystack";
    else if (["za_bank","intl_bank","flutterwave_account"].includes(destination_type)) provider = "flutterwave";
    else if (destination_type === "paypal") provider = "manual";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: cfg } = await admin
      .from("withdrawal_configs")
      .select("min_amount, max_amount, fee_flat, fee_percent, enabled, daily_limit")
      .eq("currency", currency)
      .eq("destination_type", destination_type)
      .maybeSingle();

    if (!cfg) return json({ error: `Withdrawals to ${destination_type} in ${currency} are not configured` }, 400);
    if (cfg.enabled === false) return json({ error: "This withdrawal method is currently disabled" }, 400);
    if (amount < Number(cfg.min_amount)) return json({ error: `Minimum withdrawal is ${cfg.min_amount} ${currency}` }, 400);
    if (cfg.max_amount && amount > Number(cfg.max_amount)) return json({ error: `Maximum withdrawal is ${cfg.max_amount} ${currency}` }, 400);

    // Daily cap (per user, per destination currency, rolling 24h, counts pending+processing+paid)
    if (cfg.daily_limit && Number(cfg.daily_limit) > 0) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await admin
        .from("withdrawal_requests")
        .select("destination, amount, currency, status, created_at")
        .eq("user_id", user.id)
        .gte("created_at", since)
        .in("status", ["pending", "processing", "paid"]);
      const usedToday = (recent || []).reduce((sum, r) => {
        const destCur = ((r.destination as any)?.fx?.dest_currency as string | undefined) || r.currency;
        const destAmt = Number(((r.destination as any)?.fx?.dest_amount as number | undefined) ?? r.amount);
        return destCur === currency ? sum + destAmt : sum;
      }, 0);
      const remaining = Number(cfg.daily_limit) - usedToday;
      if (amount > remaining) {
        return json({
          error: `Daily limit exceeded. You can withdraw up to ${remaining.toFixed(2)} ${currency} more today.`,
          daily_limit: Number(cfg.daily_limit),
          used_today: usedToday,
          remaining: Math.max(0, remaining),
        }, 400);
      }
    }

    const fee = Math.round((Number(cfg.fee_flat) + (Number(cfg.fee_percent) / 100) * amount) * 100) / 100;
    if (fee >= amount) return json({ error: "Amount must exceed the fee" }, 400);

    // KYC limit check (convert destination amount to USD)
    let amountUsd = amount;
    if (currency !== "USD") {
      const q = await admin.functions.invoke("fx-quote", { body: { from: "USD", to: currency, to_amount: amount } });
      const qd = q.data as { from_amount?: number } | null;
      if (qd?.from_amount) amountUsd = Number(qd.from_amount);
    }
    const { data: gate } = await admin.rpc("kyc_can_transact", {
      _user_id: user.id, _amount_usd: amountUsd, _kind: "withdrawal",
    });
    const g = gate as { allowed?: boolean; reason?: string } | null;
    if (g && g.allowed === false) {
      return json({ error: g.reason || "KYC limit exceeded", kyc: g }, 403);
    }


    // FX
    let sourceAmount = amount;
    let fxRate = 1;
    let markup = 0;
    if (sourceCurrency !== currency) {
      const quoteRes = await admin.functions.invoke("fx-quote", {
        body: { from: sourceCurrency, to: currency, to_amount: amount },
      });
      if (quoteRes.error || (quoteRes.data as any)?.error) {
        return json({ error: `FX quote failed: ${quoteRes.error?.message || (quoteRes.data as any)?.error}` }, 400);
      }
      const q = quoteRes.data as { rate: number; markup_percent: number; from_amount: number };
      sourceAmount = Number(q.from_amount);
      fxRate = Number(q.rate);
      markup = Number(q.markup_percent);
      if (!Number.isFinite(sourceAmount) || sourceAmount <= 0) return json({ error: "FX conversion produced invalid amount" }, 400);
    }

    const { data: withdrawalId, error: rpcErr } = await admin.rpc("wallet_debit_for_withdrawal", {
      _user_id: user.id,
      _currency: sourceCurrency,
      _amount: sourceAmount,
      _fee: 0,
      _destination_type: destination_type,
      _destination: { ...destination, fx: { rate: fxRate, markup_percent: markup, dest_currency: currency, dest_amount: amount, dest_fee: fee } },
      _provider: provider,
    });
    if (rpcErr) return json({ error: rpcErr.message }, 400);

    await admin.from("withdrawal_requests").update({
      source_currency: sourceCurrency,
      source_amount: sourceAmount,
      fx_rate: fxRate,
      fx_markup_percent: markup,
    }).eq("id", withdrawalId);

    // Dispatch
    if (provider === "manual") {
      return json({ withdrawal_id: withdrawalId, status: "pending" });
    }

    try {
      if (provider === "paystack") {
        // Create transfer recipient
        const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
          method: "POST",
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            type: destination_type === "paystack_account" ? "nuban" : "nuban",
            name: destination.account_name || destination.email || "Beneficiary",
            account_number: destination.account_number,
            bank_code: destination.bank_code,
            currency,
          }),
        });
        const recip = await recipientRes.json();
        if (!recip.status) throw new Error(recip.message || "Recipient failed");

        const transferRes = await fetch("https://api.paystack.co/transfer", {
          method: "POST",
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "balance",
            amount: Math.round(amount * 100),
            recipient: recip.data.recipient_code,
            reason: "Wallet withdrawal",
            reference: `wd_${withdrawalId}`,
          }),
        });
        const tr = await transferRes.json();
        if (!tr.status) throw new Error(tr.message || "Transfer failed");

        await admin.from("withdrawal_requests").update({
          status: "processing",
          provider_ref: tr.data.reference || tr.data.transfer_code,
        }).eq("id", withdrawalId);
      } else {
        // Flutterwave transfer
        const transferRes = await fetch("https://api.flutterwave.com/v3/transfers", {
          method: "POST",
          headers: { Authorization: `Bearer ${FLW_SECRET}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            account_bank: destination.bank_code,
            account_number: destination.account_number,
            amount,
            narration: "Wallet withdrawal",
            currency,
            reference: `wd_${withdrawalId}`,
            beneficiary_name: destination.account_name,
          }),
        });
        const tr = await transferRes.json();
        if (tr.status !== "success") throw new Error(tr.message || "Transfer failed");

        await admin.from("withdrawal_requests").update({
          status: "processing",
          provider_ref: String(tr.data?.id || tr.data?.reference),
        }).eq("id", withdrawalId);
      }

      return json({ withdrawal_id: withdrawalId, status: "processing" });
    } catch (dispatchErr) {
      // Keep as pending — admin can manually process
      await admin.from("withdrawal_requests").update({
        failure_reason: `Auto-dispatch failed: ${String(dispatchErr?.message || dispatchErr)}. Awaiting admin.`,
      }).eq("id", withdrawalId);
      return json({ withdrawal_id: withdrawalId, status: "pending", note: "Queued for admin review" });
    }
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature, verif-hash",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const FLW_HASH = Deno.env.get("FLUTTERWAVE_WEBHOOK_HASH") ?? "";
const FLW_SECRET = Deno.env.get("FLUTTERWAVE_SECRET_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Detect provider
  const pSig = req.headers.get("x-paystack-signature");
  const fSig = req.headers.get("verif-hash");

  try {
    if (pSig) {
      const expected = createHmac("sha512", PAYSTACK_SECRET).update(raw).digest("hex");
      if (expected !== pSig) return new Response("Invalid signature", { status: 401 });
      const evt = JSON.parse(raw);
      if (evt.event === "charge.success" && evt.data?.metadata?.type === "wallet_topup") {
        const userId = evt.data.metadata.user_id;
        const currency = (evt.data.metadata.currency || evt.data.currency || "USD").toUpperCase();
        const amount = Number(evt.data.amount) / 100;
        await admin.rpc("wallet_credit", {
          _user_id: userId,
          _currency: currency,
          _amount: amount,
          _kind: "deposit",
          _reference: evt.data.reference,
          _provider: "paystack",
          _provider_ref: evt.data.reference,
          _metadata: { source: "paystack_webhook" },
        });
      }
      return new Response("ok", { headers: corsHeaders });
    }

    if (fSig) {
      if (fSig !== FLW_HASH) return new Response("Invalid signature", { status: 401 });
      const evt = JSON.parse(raw);
      const data = evt.data;
      if (evt.event?.includes("charge.completed") && data?.status === "successful" && data?.meta?.type === "wallet_topup") {
        // Verify with Flutterwave
        const verify = await fetch(`https://api.flutterwave.com/v3/transactions/${data.id}/verify`, {
          headers: { Authorization: `Bearer ${FLW_SECRET}` },
        });
        const v = await verify.json();
        if (v.status === "success" && v.data?.status === "successful") {
          await admin.rpc("wallet_credit", {
            _user_id: data.meta.user_id,
            _currency: (data.meta.currency || data.currency).toUpperCase(),
            _amount: Number(v.data.amount),
            _kind: "deposit",
            _reference: data.tx_ref,
            _provider: "flutterwave",
            _provider_ref: String(data.id),
            _metadata: { source: "flutterwave_webhook" },
          });
        }
      }
      return new Response("ok", { headers: corsHeaders });
    }

    return new Response("No signature", { status: 400 });
  } catch (e) {
    console.error("webhook error", e);
    return new Response("error", { status: 500 });
  }
});

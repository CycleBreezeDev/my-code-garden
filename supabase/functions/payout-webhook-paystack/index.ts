import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createHmac } from "node:crypto";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const raw = await req.text();
  const sig = req.headers.get("x-paystack-signature");
  const expected = createHmac("sha512", PAYSTACK_SECRET).update(raw).digest("hex");
  if (sig !== expected) return new Response("Invalid signature", { status: 401 });

  try {
    const evt = JSON.parse(raw);
    const ref = evt.data?.reference || "";
    if (!ref.startsWith("wd_")) return new Response("ok");
    const withdrawalId = ref.slice(3);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (evt.event === "transfer.success") {
      await admin.rpc("wallet_finalize_withdrawal", {
        _withdrawal_id: withdrawalId, _status: "paid", _provider_ref: ref, _failure_reason: null,
      });
    } else if (evt.event === "transfer.failed" || evt.event === "transfer.reversed") {
      await admin.rpc("wallet_finalize_withdrawal", {
        _withdrawal_id: withdrawalId, _status: "failed", _provider_ref: ref,
        _failure_reason: evt.data?.reason || evt.event,
      });
    }
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});

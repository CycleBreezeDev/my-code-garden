import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FLW_HASH = Deno.env.get("FLUTTERWAVE_WEBHOOK_HASH") ?? "";

Deno.serve(async (req) => {
  // GET /health — public liveness probe (no auth, no side effects)
  if (req.method === "GET" && new URL(req.url).pathname.endsWith("/health")) {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const sig = req.headers.get("verif-hash");
  if (sig !== FLW_HASH) return new Response("Invalid signature", { status: 401 });

  try {
    const evt = await req.json();
    const ref = evt.data?.reference || evt.transfer?.reference || "";
    if (!ref.startsWith("wd_")) return new Response("ok");
    const withdrawalId = ref.slice(3);
    const status = evt.data?.status || evt.transfer?.status;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (status === "SUCCESSFUL") {
      await admin.rpc("wallet_finalize_withdrawal", {
        _withdrawal_id: withdrawalId, _status: "paid", _provider_ref: ref, _failure_reason: null,
      });
    } else if (status === "FAILED") {
      await admin.rpc("wallet_finalize_withdrawal", {
        _withdrawal_id: withdrawalId, _status: "failed", _provider_ref: ref,
        _failure_reason: evt.data?.complete_message || "Failed",
      });
    }
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});

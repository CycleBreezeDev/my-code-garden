// Admin: approve / reject KYC, set tier
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles || []).some((r) => r.role === "admin")) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const target_user_id = String(body.user_id || "");
    const action = String(body.action || "");
    const tier = Number(body.tier ?? -1);
    const reason = body.reason ? String(body.reason) : null;

    if (!target_user_id) return json({ error: "user_id required" }, 400);

    if (action === "approve") {
      if (![1, 2, 3].includes(tier)) return json({ error: "tier must be 1, 2 or 3" }, 400);
      await admin.from("kyc_profiles").update({
        status: "approved", tier, rejection_reason: null,
      }).eq("user_id", target_user_id);
      await admin.rpc("kyc_bump_tier", { _user_id: target_user_id, _tier: tier, _reason: reason || "admin approval" });
    } else if (action === "reject") {
      await admin.from("kyc_profiles").update({
        status: "rejected", tier: 0, rejection_reason: reason || "Rejected by admin",
      }).eq("user_id", target_user_id);
    } else {
      return json({ error: "Invalid action" }, 400);
    }

    const { data: checkRow } = await admin.from("kyc_checks").insert({
      user_id: target_user_id,
      provider: "manual",
      job_type: action,
      status: action === "approve" ? "approved" : "rejected",
      initiated_by: user.id,
      response_payload: { tier, reason },
    }).select("id").maybeSingle();

    // Email the user with the decision (best-effort)
    try {
      const { data: targetUser } = await admin.auth.admin.getUserById(target_user_id);
      const recipientEmail = targetUser?.user?.email;
      const { data: profile } = await admin
        .from("kyc_profiles")
        .select("full_name")
        .eq("user_id", target_user_id)
        .maybeSingle();
      const fullName = (profile as { full_name?: string } | null)?.full_name ?? undefined;
      const origin = req.headers.get("origin") ?? "";
      const idemBase = checkRow?.id ?? `${target_user_id}-${Date.now()}`;

      if (recipientEmail) {
        if (action === "approve") {
          await admin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "kyc-approved",
              recipientEmail,
              idempotencyKey: `kyc-approved-${idemBase}`,
              templateData: { fullName, tier, dashboardUrl: origin ? `${origin}/dashboard` : undefined },
            },
          });
        } else {
          await admin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "kyc-rejected",
              recipientEmail,
              idempotencyKey: `kyc-rejected-${idemBase}`,
              templateData: { fullName, reason: reason || "Rejected by admin", kycUrl: origin ? `${origin}/kyc` : undefined },
            },
          });
        }
      }
    } catch (emailErr) {
      console.error("KYC user decision email failed", emailErr);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

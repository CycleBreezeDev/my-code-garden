// Manual KYC submission: stores profile data + document references; admin reviews.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ID_TYPES = ["passport", "national_id", "drivers_license", "bvn", "nin", "voters_card"];

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
    const full_name = String(body.full_name || "").trim();
    const country = String(body.country || "").trim().toUpperCase();
    const id_type = String(body.id_type || "").trim();
    const id_number = String(body.id_number || "").trim();
    const dob = body.dob ? String(body.dob) : null;
    const id_doc_path = body.id_doc_path ? String(body.id_doc_path) : null;
    const selfie_path = body.selfie_path ? String(body.selfie_path) : null;
    const por_path = body.por_path ? String(body.por_path) : null;

    if (!full_name || full_name.length < 2) return json({ error: "Full name required" }, 400);
    if (!country || country.length !== 2) return json({ error: "Country (ISO-2) required" }, 400);
    if (!ID_TYPES.includes(id_type)) return json({ error: "Invalid id_type" }, 400);
    if (!id_number) return json({ error: "ID number required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Upsert profile to "pending" review
    await admin.from("kyc_profiles").upsert({
      user_id: user.id,
      full_name,
      country,
      id_type,
      id_number,
      dob,
      status: "pending",
      last_provider: "manual",
      rejection_reason: null,
    }, { onConflict: "user_id" });

    // Insert any provided documents
    const docs: { user_id: string; doc_type: string; storage_path: string; status: string }[] = [];
    if (id_doc_path) docs.push({ user_id: user.id, doc_type: "id_document", storage_path: id_doc_path, status: "uploaded" });
    if (selfie_path) docs.push({ user_id: user.id, doc_type: "selfie", storage_path: selfie_path, status: "uploaded" });
    if (por_path) docs.push({ user_id: user.id, doc_type: "proof_of_residence", storage_path: por_path, status: "uploaded" });
    if (docs.length) await admin.from("kyc_documents").insert(docs);

    const { data: checkRow } = await admin.from("kyc_checks").insert({
      user_id: user.id,
      provider: "manual",
      job_type: "submission",
      status: "submitted",
      request_payload: { full_name, country, id_type, id_number, dob, has_id_doc: !!id_doc_path, has_selfie: !!selfie_path, has_por: !!por_path },
    }).select("id").maybeSingle();

    // Notify admins by email (best-effort, don't block submission on failure)
    try {
      const { data: admins } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const adminIds = (admins ?? []).map((a: { user_id: string }) => a.user_id);
      const adminEmails: string[] = [];
      for (const id of adminIds) {
        const { data: u } = await admin.auth.admin.getUserById(id);
        if (u?.user?.email) adminEmails.push(u.user.email);
      }

      const origin = req.headers.get("origin") ?? "";
      const adminUrl = origin ? `${origin}/admin` : undefined;
      const idemBase = checkRow?.id ?? `${user.id}-${Date.now()}`;

      for (const email of adminEmails) {
        await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "kyc-submission-admin",
            recipientEmail: email,
            idempotencyKey: `kyc-submit-${idemBase}-${email}`,
            templateData: {
              userEmail: user.email,
              fullName: full_name,
              country,
              idType: id_type,
              hasIdDoc: !!id_doc_path,
              hasSelfie: !!selfie_path,
              hasPor: !!por_path,
              adminUrl,
            },
          },
        });
      }
    } catch (notifyErr) {
      console.error("KYC admin notification failed", notifyErr);
    }

    // Confirmation email to the user (best-effort)
    try {
      if (user.email) {
        const idemBase = `${user.id}-${Date.now()}`;
        await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "kyc-submission-user",
            recipientEmail: user.email,
            idempotencyKey: `kyc-submit-user-${idemBase}`,
            templateData: { fullName: full_name },
          },
        });
      }
    } catch (userNotifyErr) {
      console.error("KYC user confirmation failed", userNotifyErr);
    }

    return json({ ok: true, status: "pending" });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

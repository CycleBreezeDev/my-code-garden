import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

// Paystack webhook — no JWT, called by Paystack servers.
// Verified via HMAC-SHA512 signature with the secret key.

Deno.serve(async (req) => {
  // GET /health — public liveness probe (no auth, no side effects)
  if (req.method === "GET" && new URL(req.url).pathname.endsWith("/health")) {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!PAYSTACK_SECRET_KEY) {
      console.error("PAYSTACK_SECRET_KEY missing");
      return new Response("Misconfigured", { status: 500 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") ?? "";
    const expected = createHmac("sha512", PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");

    if (signature !== expected) {
      console.warn("Invalid Paystack signature");
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(rawBody);
    console.log("Paystack event:", event?.event, "ref:", event?.data?.reference);

    if (event?.event !== "charge.success") {
      // Acknowledge other events without doing anything
      return new Response("ok", { status: 200 });
    }

    const data = event.data ?? {};
    const reference: string | undefined = data.reference;
    const status: string | undefined = data.status;
    const metadata = data.metadata ?? {};
    const syndicate_id: string | undefined = metadata.syndicate_id;
    const shares = Number(metadata.shares);
    const user_id: string | undefined = metadata.user_id;

    if (status !== "success" || !reference || !syndicate_id || !shares || !user_id) {
      console.warn("Webhook missing required fields", { reference, status, syndicate_id, shares, user_id });
      return new Response("ok", { status: 200 }); // 200 so Paystack stops retrying garbage
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: membershipId, error } = await admin.rpc("join_syndicate_for_user", {
      _user_id: user_id,
      _syndicate_id: syndicate_id,
      _shares: shares,
      _reference: reference,
    });

    if (error) {
      console.error("join_syndicate_for_user failed", error, { reference });
      // Return 500 so Paystack retries
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    console.log("Membership created/idempotent for ref", reference, "id:", membershipId);
    return new Response(JSON.stringify({ ok: true, membership_id: membershipId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("paystack-webhook error", e);
    return new Response("error", { status: 500 });
  }
});

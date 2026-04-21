import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  syndicate_id: z.string().uuid(),
  shares: z.number().int().min(1).max(100),
  callback_url: z.string().url(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { syndicate_id, shares, callback_url } = parsed.data;

    // Look up syndicate to compute amount
    const { data: syndicate, error: synErr } = await supabase
      .from("syndicates")
      .select("id, name, price_per_share, total_shares, sold_shares, status")
      .eq("id", syndicate_id)
      .maybeSingle();

    if (synErr || !syndicate) {
      return new Response(JSON.stringify({ error: "Syndicate not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (syndicate.status !== "open") {
      return new Response(JSON.stringify({ error: "Syndicate is not open" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (syndicate.sold_shares + shares > syndicate.total_shares) {
      return new Response(JSON.stringify({ error: "Not enough shares available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountUsd = Number(syndicate.price_per_share) * shares;
    const amountInCents = Math.round(amountUsd * 100);

    // Initialize Paystack transaction (USD)
    const psResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: userData.user.email,
        amount: amountInCents,
        currency: "USD",
        callback_url,
        metadata: {
          syndicate_id,
          shares,
          user_id: userData.user.id,
          syndicate_name: syndicate.name,
        },
      }),
    });

    const psData = await psResponse.json();

    if (!psResponse.ok || !psData.status) {
      console.error("Paystack init failed", psData);
      return new Response(
        JSON.stringify({ error: psData.message || "Failed to initialize payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        authorization_url: psData.data.authorization_url,
        reference: psData.data.reference,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("paystack-init error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

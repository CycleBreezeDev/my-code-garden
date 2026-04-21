import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PickSchema = z.object({
  share_index: z.number().int().min(1),
  main: z.array(z.number().int()).min(1),
  bonus: z.array(z.number().int()).default([]),
});

const BodySchema = z.object({
  reference: z.string().min(1),
  picks: z.array(PickSchema).optional(),
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
    const { reference, picks } = parsed.data;

    // Verify with Paystack
    const psResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
    );
    const psData = await psResponse.json();

    if (!psResponse.ok || !psData.status || psData.data?.status !== "success") {
      return new Response(
        JSON.stringify({ error: psData.data?.gateway_response || "Payment not successful" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const metadata = psData.data.metadata || {};
    const syndicate_id = metadata.syndicate_id as string;
    const shares = Number(metadata.shares);
    const metaUserId = metadata.user_id as string;

    if (!syndicate_id || !shares || metaUserId !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Invalid payment metadata" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call join_syndicate as the authenticated user (RLS enforced).
    // Passing the reference makes this idempotent — if the webhook already
    // processed this payment, we return the existing membership instead of duplicating.
    const { data: membershipId, error: joinErr } = await supabase.rpc("join_syndicate", {
      _syndicate_id: syndicate_id,
      _shares: shares,
      _reference: reference,
    });

    if (joinErr) {
      console.error("join_syndicate failed after payment", joinErr);
      return new Response(
        JSON.stringify({
          error: `Payment received but joining failed: ${joinErr.message}. Contact support with reference ${reference}.`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Optionally save Lucky Picks (best-effort — don't fail the verify if picks fail)
    let picks_saved = 0;
    if (membershipId && picks && picks.length > 0) {
      try {
        const cleaned = picks.filter((p) => p.main.length > 0);
        if (cleaned.length > 0) {
          const { data: count, error: picksErr } = await supabase.rpc("upsert_syndicate_picks", {
            _membership_id: membershipId,
            _picks: cleaned as unknown as never,
          });
          if (picksErr) {
            console.warn("upsert_syndicate_picks failed", picksErr);
          } else {
            picks_saved = (count as number) ?? cleaned.length;
          }
        }
      } catch (e) {
        console.warn("Saving picks failed", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, membership_id: membershipId, reference, picks_saved }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("paystack-verify error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

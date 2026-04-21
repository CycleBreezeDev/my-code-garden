import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RATE_TTL_MS = 60 * 60 * 1000; // 1h

async function fetchRate(base: string, quote: string): Promise<number> {
  const url = `https://api.exchangerate.host/latest?base=${base}&symbols=${quote}`;
  const r = await fetch(url);
  const d = await r.json();
  const rate = d?.rates?.[quote];
  if (!rate || !Number.isFinite(rate)) throw new Error(`Rate ${base}->${quote} unavailable`);
  return Number(rate);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const from = String(body.from || "").toUpperCase();
    const to = String(body.to || "").toUpperCase();
    const fromAmount = body.from_amount != null ? Number(body.from_amount) : null;
    const toAmount = body.to_amount != null ? Number(body.to_amount) : null;
    if (!from || !to) return json({ error: "from and to required" }, 400);
    if (fromAmount == null && toAmount == null) return json({ error: "Provide from_amount or to_amount" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (from === to) {
      const amt = fromAmount ?? toAmount ?? 0;
      return json({ rate: 1, markup_percent: 0, effective_rate: 1, from_amount: amt, to_amount: amt, source: "identity" });
    }

    // Try cache
    let rate: number | null = null;
    const { data: cached } = await admin.from("fx_rates")
      .select("rate, fetched_at").eq("base_currency", from).eq("quote_currency", to).maybeSingle();
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < RATE_TTL_MS) {
      rate = Number(cached.rate);
    }
    if (rate == null) {
      rate = await fetchRate(from, to);
      await admin.from("fx_rates").upsert(
        { base_currency: from, quote_currency: to, rate, fetched_at: new Date().toISOString(), source: "exchangerate.host" },
        { onConflict: "base_currency,quote_currency" }
      );
    }

    // Markup
    const { data: pair } = await admin.from("fx_pairs")
      .select("markup_percent, enabled").eq("base_currency", from).eq("quote_currency", to).maybeSingle();
    if (pair && pair.enabled === false) return json({ error: "Pair disabled" }, 400);
    const markup = Number(pair?.markup_percent ?? 2.0);

    // Effective rate: user gets less of the destination (markup reduces what they receive)
    const effective = rate * (1 - markup / 100);

    let outFrom = fromAmount;
    let outTo = toAmount;
    if (outFrom != null && outTo == null) outTo = Math.round(outFrom * effective * 100) / 100;
    else if (outTo != null && outFrom == null) outFrom = Math.round((outTo / effective) * 100) / 100;

    return json({
      rate, markup_percent: markup, effective_rate: effective,
      from, to, from_amount: outFrom, to_amount: outTo,
      source: "exchangerate.host",
    });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

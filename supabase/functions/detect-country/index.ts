// Detect the caller's country/currency from their IP address.
// Uses the free ipapi.co endpoint (no API key required, ~1k req/day per IP).
// Falls back gracefully to USD when geolocation fails.
//
// IMPORTANT: This function runs server-side so we can read the real client
// IP from request headers — the browser cannot reliably know its own
// geolocation without a permission prompt that most users decline.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map ISO-3166 alpha-2 country codes to the currency we display in.
// Keep this list in sync with SUPPORTED_CURRENCIES on the client.
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  GH: "GHS",
  ZA: "ZAR",
  KE: "KES",
  NG: "NGN",
  // West African CFA (XOF) zone
  CI: "XOF", SN: "XOF", BJ: "XOF", TG: "XOF", BF: "XOF",
  ML: "XOF", NE: "XOF", GW: "XOF",
  // Central African CFA (XAF) zone
  CM: "XAF", CF: "XAF", TD: "XAF", CG: "XAF", GQ: "XAF", GA: "XAF",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Preferred: x-forwarded-for (set by Supabase edge runtime, comma-separated list).
  // Fallback: x-real-ip. We take the first entry which is the original client.
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = (fwd.split(",")[0] || req.headers.get("x-real-ip") || "").trim();

  // No IP → respond with default rather than failing; the client will
  // simply keep its current currency.
  if (!ip) {
    return json({ country: null, currency: "USD", source: "fallback" });
  }

  try {
    // ipapi.co supports unauthenticated lookups by IP path.
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    if (!r.ok) throw new Error(`ipapi ${r.status}`);
    const data = await r.json();
    const country: string | null = (data?.country_code || data?.country || null);
    const currency = country && COUNTRY_TO_CURRENCY[country] ? COUNTRY_TO_CURRENCY[country] : "USD";
    return json({ country, currency, source: "ipapi.co" });
  } catch (e) {
    // Network or rate-limit failures should not block the UI — return USD.
    return json({ country: null, currency: "USD", source: "fallback", error: String((e as Error).message) });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

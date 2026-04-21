const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const FLW_SECRET = Deno.env.get("FLUTTERWAVE_SECRET_KEY") ?? "";

const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 24 * 60 * 60 * 1000;

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
    const url = new URL(req.url);
    const country = (url.searchParams.get("country") || "NG").toUpperCase();
    const provider = url.searchParams.get("provider") || "paystack";
    const key = `${provider}:${country}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < TTL) return json(cached.data);

    let banks: { code: string; name: string }[] = [];

    if (provider === "paystack") {
      const c = country === "NG" ? "nigeria" : country === "GH" ? "ghana" : country === "KE" ? "kenya" : country === "ZA" ? "south africa" : "nigeria";
      const r = await fetch(`https://api.paystack.co/bank?country=${encodeURIComponent(c)}&perPage=100`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      });
      const d = await r.json();
      banks = (d.data || []).map((b: any) => ({ code: b.code, name: b.name }));
    } else {
      const r = await fetch(`https://api.flutterwave.com/v3/banks/${country}`, {
        headers: { Authorization: `Bearer ${FLW_SECRET}` },
      });
      const d = await r.json();
      banks = (d.data || []).map((b: any) => ({ code: b.code, name: b.name }));
    }

    cache.set(key, { at: Date.now(), data: { banks } });
    return json({ banks });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

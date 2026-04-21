const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const FLW_SECRET = Deno.env.get("FLUTTERWAVE_SECRET_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const account_number = String(body.account_number || "").trim();
    const bank_code = String(body.bank_code || "").trim();
    const provider = String(body.provider || "paystack");
    if (!account_number || !bank_code) return json({ error: "Missing fields" }, 400);

    if (provider === "paystack") {
      const r = await fetch(`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      });
      const d = await r.json();
      if (!d.status) return json({ error: d.message || "Unable to resolve" }, 400);
      return json({ account_name: d.data.account_name, account_number: d.data.account_number });
    } else {
      const r = await fetch("https://api.flutterwave.com/v3/accounts/resolve", {
        method: "POST",
        headers: { Authorization: `Bearer ${FLW_SECRET}`, "Content-Type": "application/json" },
        body: JSON.stringify({ account_number, account_bank: bank_code }),
      });
      const d = await r.json();
      if (d.status !== "success") return json({ error: d.message || "Unable to resolve" }, 400);
      return json({ account_name: d.data.account_name, account_number: d.data.account_number });
    }
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

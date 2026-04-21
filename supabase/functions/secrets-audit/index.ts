import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Secrets we expect for this project, grouped by category.
// IMPORTANT: only NAMES are listed — values never leave the function.
const SECRET_GROUPS: { category: string; description: string; required: boolean; names: string[] }[] = [
  {
    category: "Lovable Platform",
    description: "Required for email sending and webhooks.",
    required: true,
    names: ["LOVABLE_API_KEY"],
  },
  {
    category: "Paystack",
    description: "Card payments, top-ups, payouts (Nigeria, Ghana, etc.).",
    required: true,
    names: ["PAYSTACK_SECRET_KEY", "PAYSTACK_PUBLIC_KEY"],
  },
  {
    category: "Flutterwave",
    description: "Alternative payout provider and bank resolution.",
    required: false,
    names: ["FLUTTERWAVE_SECRET_KEY", "FLUTTERWAVE_WEBHOOK_HASH"],
  },
  {
    category: "Supabase (auto-injected)",
    description: "Provided automatically by Lovable Cloud.",
    required: true,
    names: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"],
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Authenticate the caller and verify admin role.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleRow) {
    return json({ error: "Forbidden — admin only" }, 403);
  }

  // Build the audit. Only booleans (and a length hint) are returned.
  const groups = SECRET_GROUPS.map((g) => ({
    category: g.category,
    description: g.description,
    required: g.required,
    secrets: g.names.map((name) => {
      const v = Deno.env.get(name);
      return {
        name,
        present: typeof v === "string" && v.length > 0,
        length: typeof v === "string" ? v.length : 0,
      };
    }),
  }));

  const missingRequired = groups
    .filter((g) => g.required)
    .flatMap((g) => g.secrets.filter((s) => !s.present).map((s) => s.name));

  return json({ groups, missingRequired, checkedAt: new Date().toISOString() });

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

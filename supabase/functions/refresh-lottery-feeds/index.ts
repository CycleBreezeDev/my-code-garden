// Refreshes lottery_feeds by scraping each official lottery site via Firecrawl JSON extraction.
// Triggered by pg_cron every 30 minutes. Public endpoint (no JWT) — protected by REFRESH_SECRET.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-refresh-secret",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

const extractionSchema = {
  type: "object",
  properties: {
    estimated_jackpot_amount: {
      type: "number",
      description: "The estimated jackpot as a plain number in the lottery's local currency (no symbols, no commas, no 'million'). E.g. for '$120 million' return 120000000.",
    },
    jackpot_display: {
      type: "string",
      description: "The estimated jackpot exactly as displayed on the page, e.g. '$120 Million' or '€17M' or 'R 50 000 000'.",
    },
    next_draw_iso: {
      type: "string",
      description: "The next scheduled draw date and time in ISO 8601 format (UTC if possible). Empty string if not visible.",
    },
    next_draw_display: {
      type: "string",
      description: "The next draw date as displayed on the page, e.g. 'Sat, Apr 19, 2025 10:59 PM ET'.",
    },
  },
  required: ["estimated_jackpot_amount", "jackpot_display"],
};

async function scrapeLottery(url: string, apiKey: string) {
  const res = await fetch(`${FIRECRAWL_V2}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: [
        {
          type: "json",
          schema: extractionSchema,
          prompt:
            "Extract the current ESTIMATED JACKPOT for the upcoming draw and the NEXT DRAW date/time. Return numbers only for the jackpot amount, in the page's local currency.",
        },
      ],
      onlyMainContent: true,
      waitFor: 1500,
    }),
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`Firecrawl ${res.status}: ${(data as { error?: string }).error ?? text.slice(0, 200)}`);
  }
  // v2 returns { success, data: { json: {...} } }
  const inner = (data as { data?: { json?: Record<string, unknown> } }).data ?? data;
  const json = (inner as { json?: Record<string, unknown> }).json ?? {};
  return json as {
    estimated_jackpot_amount?: number;
    jackpot_display?: string;
    next_draw_iso?: string;
    next_draw_display?: string;
  };
}

Deno.serve(async (req) => {
  // GET /health — public liveness probe (no auth, no side effects)
  if (req.method === "GET" && new URL(req.url).pathname.endsWith("/health")) {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!FIRECRAWL_API_KEY) {
    return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "Supabase env not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: feeds, error: fetchErr } = await admin
    .from("lottery_feeds")
    .select("id, slug, name, source_url, currency");
  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: { slug: string; ok: boolean; error?: string; jackpot?: string }[] = [];

  // Process serially to avoid Firecrawl rate limits and reduce memory
  for (const feed of feeds ?? []) {
    try {
      const extracted = await scrapeLottery(feed.source_url, FIRECRAWL_API_KEY);

      const updates: Record<string, unknown> = {
        last_refreshed_at: new Date().toISOString(),
        last_error: null,
      };
      if (typeof extracted.estimated_jackpot_amount === "number" && extracted.estimated_jackpot_amount > 0) {
        updates.estimated_jackpot = extracted.estimated_jackpot_amount;
      }
      if (extracted.jackpot_display) updates.jackpot_display = extracted.jackpot_display;
      if (extracted.next_draw_iso) {
        const d = new Date(extracted.next_draw_iso);
        if (!isNaN(d.getTime())) updates.next_draw_at = d.toISOString();
      }

      const { error: updErr } = await admin
        .from("lottery_feeds")
        .update(updates)
        .eq("id", feed.id);
      if (updErr) throw updErr;

      // Snapshot for sparkline history (only if we got a real amount)
      if (typeof updates.estimated_jackpot === "number") {
        await admin.from("lottery_jackpot_history").insert({
          feed_id: feed.id,
          slug: feed.slug,
          amount: updates.estimated_jackpot,
          jackpot_display: (updates.jackpot_display as string) ?? null,
          currency: (feed as { currency?: string }).currency ?? "USD",
        });
      }

      results.push({ slug: feed.slug, ok: true, jackpot: extracted.jackpot_display });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${feed.slug}] failed:`, msg);
      await admin
        .from("lottery_feeds")
        .update({ last_error: msg, last_refreshed_at: new Date().toISOString() })
        .eq("id", feed.id);
      results.push({ slug: feed.slug, ok: false, error: msg });
    }
  }

  return new Response(
    JSON.stringify({ refreshed: results.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

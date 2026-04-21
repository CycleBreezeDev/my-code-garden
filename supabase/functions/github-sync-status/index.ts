import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GITHUB_API = "https://api.github.com";

interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string | null;
  date: string;
  url: string;
}

interface PullInfo {
  number: number;
  title: string;
  url: string;
  author: string | null;
  draft: boolean;
  mergeable: boolean | null;
  mergeable_state: string | null;
  updated_at: string;
}

Deno.serve(async (req) => {
  // GET /health — public liveness probe (no auth, no side effects)
  if (req.method === "GET" && new URL(req.url).pathname.endsWith("/health")) {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const GITHUB_PAT = Deno.env.get("GITHUB_PAT");
  const GITHUB_REPO = Deno.env.get("GITHUB_REPO");

  // Authenticate caller and require admin role.
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

  if (!GITHUB_PAT || !GITHUB_REPO) {
    return json(
      {
        configured: false,
        error:
          "GITHUB_PAT and/or GITHUB_REPO secrets are not set. Expected GITHUB_REPO format: 'owner/repo'.",
      },
      200,
    );
  }

  if (!/^[^/\s]+\/[^/\s]+$/.test(GITHUB_REPO)) {
    return json(
      {
        configured: false,
        error: `GITHUB_REPO must be 'owner/repo' (got: ${GITHUB_REPO}).`,
      },
      200,
    );
  }

  const headers = {
    Authorization: `Bearer ${GITHUB_PAT}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "lovable-sync-status",
  };

  try {
    // 1. Repo metadata (default branch, html_url)
    const repoResp = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}`, {
      headers,
    });
    if (!repoResp.ok) {
      const body = await repoResp.text();
      return json(
        {
          configured: true,
          error: `GitHub API ${repoResp.status}: ${body.slice(0, 300)}`,
        },
        200,
      );
    }
    const repo = await repoResp.json();
    const defaultBranch: string = repo.default_branch;

    // 2. Latest commit on default branch
    const branchResp = await fetch(
      `${GITHUB_API}/repos/${GITHUB_REPO}/branches/${encodeURIComponent(defaultBranch)}`,
      { headers },
    );
    const branch = branchResp.ok ? await branchResp.json() : null;
    const latestCommit: CommitInfo | null = branch?.commit
      ? {
          sha: branch.commit.sha,
          shortSha: String(branch.commit.sha).slice(0, 7),
          message: branch.commit.commit?.message ?? "",
          author:
            branch.commit.commit?.author?.name ??
            branch.commit.author?.login ??
            null,
          date: branch.commit.commit?.author?.date ?? "",
          url: branch.commit.html_url,
        }
      : null;

    // 3. Open PRs (we'll re-fetch each to get mergeable state)
    const prsResp = await fetch(
      `${GITHUB_API}/repos/${GITHUB_REPO}/pulls?state=open&per_page=20&sort=updated&direction=desc`,
      { headers },
    );
    const prsList = prsResp.ok ? await prsResp.json() : [];

    // Detail-fetch up to 10 PRs in parallel for mergeable status
    const detailed = await Promise.all(
      (prsList as any[]).slice(0, 10).map(async (pr): Promise<PullInfo> => {
        try {
          const r = await fetch(
            `${GITHUB_API}/repos/${GITHUB_REPO}/pulls/${pr.number}`,
            { headers },
          );
          const d = r.ok ? await r.json() : pr;
          return {
            number: d.number,
            title: d.title,
            url: d.html_url,
            author: d.user?.login ?? null,
            draft: !!d.draft,
            mergeable: d.mergeable ?? null,
            mergeable_state: d.mergeable_state ?? null,
            updated_at: d.updated_at,
          };
        } catch {
          return {
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            author: pr.user?.login ?? null,
            draft: !!pr.draft,
            mergeable: null,
            mergeable_state: null,
            updated_at: pr.updated_at,
          };
        }
      }),
    );

    const conflicts = detailed.filter(
      (p) => p.mergeable === false || p.mergeable_state === "dirty",
    );

    // 4. Compare current build commit (if exposed via env) with latest
    const buildSha = Deno.env.get("VERCEL_GIT_COMMIT_SHA") ?? null;
    const inSync = buildSha && latestCommit
      ? buildSha === latestCommit.sha
      : null;

    return json({
      configured: true,
      repo: {
        fullName: GITHUB_REPO,
        url: repo.html_url,
        defaultBranch,
        private: repo.private,
        pushedAt: repo.pushed_at,
      },
      latestCommit,
      buildSha,
      inSync,
      openPullCount: Array.isArray(prsList) ? prsList.length : 0,
      pulls: detailed,
      conflicts: conflicts.map((c) => c.number),
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ configured: true, error: msg }, 200);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

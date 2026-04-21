import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Github,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  GitPullRequest,
  GitBranch,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

interface SyncStatus {
  configured: boolean;
  error?: string;
  repo?: {
    fullName: string;
    url: string;
    defaultBranch: string;
    private: boolean;
    pushedAt: string;
  };
  latestCommit?: CommitInfo | null;
  buildSha?: string | null;
  inSync?: boolean | null;
  openPullCount?: number;
  pulls?: PullInfo[];
  conflicts?: number[];
  checkedAt?: string;
}

const GitHubSyncStatus = () => {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["github-sync-status"],
    queryFn: async (): Promise<SyncStatus> => {
      const { data, error } = await supabase.functions.invoke(
        "github-sync-status",
      );
      if (error) throw error;
      return data as SyncStatus;
    },
    staleTime: 60 * 1000,
  });

  const conflictPRs =
    data?.pulls?.filter(
      (p) => p.mergeable === false || p.mergeable_state === "dirty",
    ) ?? [];

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Github className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              GitHub Sync Status
            </h2>
            <p className="text-sm text-muted-foreground">
              Latest commit, open pull requests, and merge conflicts on the
              connected repository.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking GitHub…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Failed to load: {(error as Error).message}</span>
        </div>
      )}

      {data && !data.configured && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{data.error}</span>
        </div>
      )}

      {data?.configured && data.error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{data.error}</span>
        </div>
      )}

      {data?.configured && data.repo && (
        <>
          {/* Repo header */}
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <a
              href={data.repo.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono font-semibold text-foreground hover:text-primary"
            >
              {data.repo.fullName}
              <ExternalLink className="h-3 w-3" />
            </a>
            <Badge variant="outline" className="text-[10px]">
              <GitBranch className="mr-1 h-3 w-3" />
              {data.repo.defaultBranch}
            </Badge>
            {data.repo.private && (
              <Badge variant="secondary" className="text-[10px]">
                Private
              </Badge>
            )}
          </div>

          {/* Conflict banner */}
          {conflictPRs.length > 0 ? (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">
                  {conflictPRs.length} pull request
                  {conflictPRs.length === 1 ? "" : "s"} with merge conflicts
                </div>
                <div className="text-xs opacity-90">
                  #{conflictPRs.map((p) => p.number).join(", #")}
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              No merge conflicts detected on open pull requests.
            </div>
          )}

          {/* Build sync */}
          {data.inSync !== null && data.inSync !== undefined && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-md border p-3 text-sm ${
                data.inSync
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
              }`}
            >
              {data.inSync ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>
                {data.inSync
                  ? "Current build matches latest commit on default branch."
                  : `Build is behind: ${data.buildSha?.slice(0, 7)} vs ${data.latestCommit?.shortSha}`}
              </span>
            </div>
          )}

          {/* Latest commit */}
          {data.latestCommit && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                Latest commit on {data.repo.defaultBranch}
              </h3>
              <a
                href={data.latestCommit.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md border border-border p-3 text-sm hover:border-primary/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-xs text-primary">
                    {data.latestCommit.shortSha}
                  </code>
                  <span className="text-[11px] text-muted-foreground">
                    {data.latestCommit.date
                      ? new Date(data.latestCommit.date).toLocaleString()
                      : ""}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-foreground">
                  {data.latestCommit.message.split("\n")[0]}
                </p>
                {data.latestCommit.author && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    by {data.latestCommit.author}
                  </p>
                )}
              </a>
            </div>
          )}

          {/* Open PRs */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Open pull requests
              </h3>
              <Badge variant="outline" className="text-[10px]">
                {data.openPullCount ?? 0}
              </Badge>
            </div>
            {data.pulls && data.pulls.length > 0 ? (
              <div className="divide-y divide-border rounded-md border border-border">
                {data.pulls.map((pr) => {
                  const conflict =
                    pr.mergeable === false || pr.mergeable_state === "dirty";
                  return (
                    <a
                      key={pr.number}
                      href={pr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start justify-between gap-3 p-3 text-sm hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="font-mono text-xs text-muted-foreground">
                            #{pr.number}
                          </span>
                          {pr.draft && (
                            <Badge variant="outline" className="text-[10px]">
                              Draft
                            </Badge>
                          )}
                          {conflict && (
                            <Badge variant="destructive" className="text-[10px]">
                              Conflicts
                            </Badge>
                          )}
                          {pr.mergeable === true &&
                            pr.mergeable_state === "clean" && (
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                              >
                                Mergeable
                              </Badge>
                            )}
                        </div>
                        <p className="mt-1 line-clamp-1 text-foreground">
                          {pr.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {pr.author ? `by ${pr.author} · ` : ""}
                          {new Date(pr.updated_at).toLocaleString()}
                        </p>
                      </div>
                      <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-md border border-border p-3 text-xs text-muted-foreground">
                No open pull requests.
              </p>
            )}
          </div>

          {data.checkedAt && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Last checked: {new Date(data.checkedAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </section>
  );
};

export default GitHubSyncStatus;

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, AlertCircle, KeyRound, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SecretInfo = { name: string; present: boolean; length: number };
type Group = {
  category: string;
  description: string;
  required: boolean;
  secrets: SecretInfo[];
};
type AuditResponse = {
  groups: Group[];
  missingRequired: string[];
  checkedAt: string;
};

export const SecretsAudit = () => {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["secrets-audit"],
    queryFn: async (): Promise<AuditResponse> => {
      const { data, error } = await supabase.functions.invoke("secrets-audit");
      if (error) throw error;
      return data as AuditResponse;
    },
    staleTime: 60 * 1000,
  });

  const missing = data?.missingRequired ?? [];

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Environment Secrets Audit</h2>
            <p className="text-sm text-muted-foreground">
              Server-side check of which secrets are configured. Values never leave the function.
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
          Auditing secrets…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Failed to load audit: {(error as Error).message}</span>
        </div>
      )}

      {data && missing.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">{missing.length} required secret(s) missing</div>
            <div className="text-xs opacity-90">{missing.join(", ")}</div>
          </div>
        </div>
      )}

      {data && missing.length === 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          All required secrets are configured.
        </div>
      )}

      {data?.groups.map((g) => (
        <div key={g.category} className="mb-4 last:mb-0">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{g.category}</h3>
            {g.required ? (
              <Badge variant="secondary" className="text-[10px]">Required</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Optional</Badge>
            )}
          </div>
          <p className="mb-2 text-xs text-muted-foreground">{g.description}</p>
          <div className="divide-y divide-border rounded-md border border-border">
            {g.secrets.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <code className="font-mono text-xs text-foreground">{s.name}</code>
                <div className="flex items-center gap-2">
                  {s.present ? (
                    <>
                      <span className="text-[11px] text-muted-foreground">
                        {s.length} chars
                      </span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] text-destructive">Missing</span>
                      <XCircle className="h-4 w-4 text-destructive" />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {data?.checkedAt && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Last checked: {new Date(data.checkedAt).toLocaleString()}
        </p>
      )}
    </section>
  );
};

export default SecretsAudit;

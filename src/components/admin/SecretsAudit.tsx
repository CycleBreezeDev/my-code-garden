import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  KeyRound,
  RefreshCw,
  Loader2,
} from "lucide-react";
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

type QueueTestState =
  | { phase: "idle" }
  | { phase: "enqueueing" }
  | { phase: "polling"; messageId: string; startedAt: number; lastStatus?: string }
  | {
      phase: "done";
      messageId: string;
      finalStatus: string;
      durationMs: number;
      errorMessage?: string;
    }
  | { phase: "error"; message: string; messageId?: string };

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;
const TERMINAL_STATUSES = new Set([
  "sent",
  "failed",
  "dlq",
  "bounced",
  "complained",
  "suppressed",
]);

export const SecretsAudit = () => {
  const { user } = useAuth();
  const [recipient, setRecipient] = useState(user?.email ?? "");
  const [test, setTest] = useState<QueueTestState>({ phase: "idle" });

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

  const runQueueTest = async () => {
    const to = recipient.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast.error("Enter a valid recipient email");
      return;
    }

    setTest({ phase: "enqueueing" });
    const messageId = `queue-test-${crypto.randomUUID()}`;
    const startedAt = Date.now();

    try {
      const { error: invokeErr } = await supabase.functions.invoke(
        "send-transactional-email",
        {
          body: {
            templateName: "queue-test",
            recipientEmail: to,
            idempotencyKey: messageId,
            templateData: { triggeredAt: new Date().toISOString() },
          },
        }
      );
      if (invokeErr) throw invokeErr;
    } catch (e: any) {
      setTest({
        phase: "error",
        message: e?.message ?? "Failed to enqueue test email",
      });
      toast.error("Failed to enqueue test email");
      return;
    }

    setTest({ phase: "polling", messageId, startedAt });

    // Poll email_send_log until we see a terminal status or time out.
    const deadline = startedAt + POLL_TIMEOUT_MS;
    let finalStatus: string | null = null;
    let finalError: string | null = null;
    let lastStatus: string | undefined;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const { data: rows, error: logErr } = await supabase
        .from("email_send_log")
        .select("status,error_message,created_at")
        .eq("message_id", messageId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (logErr) continue;
      const latest = rows?.[0];
      if (!latest) continue;

      lastStatus = latest.status;
      setTest({ phase: "polling", messageId, startedAt, lastStatus });

      if (TERMINAL_STATUSES.has(latest.status)) {
        finalStatus = latest.status;
        finalError = latest.error_message ?? null;
        break;
      }
    }

    if (!finalStatus) {
      setTest({
        phase: "error",
        messageId,
        message: `Timed out after ${POLL_TIMEOUT_MS / 1000}s — last status: ${
          lastStatus ?? "no log row yet"
        }`,
      });
      toast.error("Queue test timed out");
      return;
    }

    setTest({
      phase: "done",
      messageId,
      finalStatus,
      durationMs: Date.now() - startedAt,
      errorMessage: finalError ?? undefined,
    });

    if (finalStatus === "sent") {
      toast.success("Email queue verified — message processed and sent");
    } else {
      toast.error(`Queue ran but final status was "${finalStatus}"`);
    }
  };

  const isRunning = test.phase === "enqueueing" || test.phase === "polling";

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Environment Secrets Audit
            </h2>
            <p className="text-sm text-muted-foreground">
              Server-side check of which secrets are configured. Values never
              leave the function.
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
            <div className="font-semibold">
              {missing.length} required secret(s) missing
            </div>
            <div className="text-xs opacity-90">{missing.join(", ")}</div>
          </div>
        </div>
      )}

      {data && missing.length === 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          All required secrets are configured.
        </div>
      )}

      {data?.groups.map((g) => (
        <div key={g.category} className="mb-4 last:mb-0">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {g.category}
            </h3>
            {g.required ? (
              <Badge variant="secondary" className="text-[10px]">
                Required
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Optional
              </Badge>
            )}
          </div>
          <p className="mb-2 text-xs text-muted-foreground">{g.description}</p>
          <div className="divide-y divide-border rounded-md border border-border">
            {g.secrets.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <code className="font-mono text-xs text-foreground">
                  {s.name}
                </code>
                <div className="flex items-center gap-2">
                  {s.present ? (
                    <>
                      <span className="text-[11px] text-muted-foreground">
                        {s.length} chars
                      </span>
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] text-destructive">
                        Missing
                      </span>
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

      {/* Queue end-to-end test */}
      <div className="mt-6 rounded-md border border-border bg-background/50 p-4">
        <div className="mb-3 flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Test email queue
            </h3>
            <p className="text-xs text-muted-foreground">
              Enqueues a sample email and polls{" "}
              <code className="font-mono">email_send_log</code> until a terminal
              status (sent / failed / dlq) is recorded.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="queue-test-recipient" className="text-xs">
              Recipient
            </Label>
            <Input
              id="queue-test-recipient"
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="you@example.com"
              disabled={isRunning}
              className="h-9"
            />
          </div>
          <Button
            onClick={runQueueTest}
            disabled={isRunning || !recipient}
            className="h-9"
          >
            {isRunning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {test.phase === "enqueueing"
              ? "Enqueueing…"
              : test.phase === "polling"
              ? "Waiting for queue…"
              : "Run test"}
          </Button>
        </div>

        {test.phase === "polling" && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>
              Message <code className="font-mono">{test.messageId}</code>{" "}
              enqueued. Polling logs
              {test.lastStatus ? ` — last status: ${test.lastStatus}` : "…"}
            </span>
          </div>
        )}

        {test.phase === "done" && (
          <div
            className={`mt-3 flex items-start gap-2 rounded-md border p-3 text-xs ${
              test.finalStatus === "sent"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {test.finalStatus === "sent" ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <div className="space-y-1">
              <div>
                Final status: <span className="font-semibold">{test.finalStatus}</span>{" "}
                in {(test.durationMs / 1000).toFixed(1)}s
              </div>
              <div className="opacity-80">
                message_id: <code className="font-mono">{test.messageId}</code>
              </div>
              {test.errorMessage && (
                <div className="opacity-80">Error: {test.errorMessage}</div>
              )}
            </div>
          </div>
        )}

        {test.phase === "error" && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="space-y-1">
              <div>{test.message}</div>
              {test.messageId && (
                <div className="opacity-80">
                  message_id: <code className="font-mono">{test.messageId}</code>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default SecretsAudit;

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Trash2, Archive, MailOpen, Inbox } from "lucide-react";
import { toast } from "sonner";

type Submission = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "new" | "read" | "archived";
  created_at: string;
};

const statusStyles: Record<Submission["status"], string> = {
  new: "bg-primary/15 text-primary",
  read: "bg-secondary text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
};

const ContactSubmissions = () => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | Submission["status"]>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["admin-contact-submissions"],
    queryFn: async (): Promise<Submission[]> => {
      const { data, error } = await supabase
        .from("contact_submissions")
        .select("id, name, email, subject, message, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Submission[];
    },
  });

  const updateStatus = async (id: string, status: Submission["status"]) => {
    const { error } = await supabase
      .from("contact_submissions")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-contact-submissions"] });
  };

  const deleteSubmission = async (id: string) => {
    if (!confirm("Delete this submission permanently?")) return;
    const { error } = await supabase.from("contact_submissions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (openId === id) setOpenId(null);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-contact-submissions"] });
  };

  const filtered = (submissions ?? []).filter((s) => filter === "all" || s.status === filter);
  const newCount = (submissions ?? []).filter((s) => s.status === "new").length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Contact submissions</h2>
          {newCount > 0 && (
            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
              {newCount} new
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {(["all", "new", "read", "archived"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <Mail className="h-8 w-8 opacity-50" />
          No submissions {filter !== "all" ? `with status "${filter}"` : "yet"}.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const isOpen = openId === s.id;
            return (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-secondary/10 transition-colors"
              >
                <button
                  onClick={() => {
                    const next = isOpen ? null : s.id;
                    setOpenId(next);
                    if (next && s.status === "new") {
                      void updateStatus(s.id, "read");
                    }
                  }}
                  className="flex w-full items-start gap-3 p-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{s.subject}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${statusStyles[s.status]}`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {s.name} · {s.email} · {new Date(s.created_at).toLocaleString()}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border px-3 py-3">
                    <p className="whitespace-pre-wrap text-sm text-foreground/90">{s.message}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                        <a href={`mailto:${s.email}?subject=Re: ${encodeURIComponent(s.subject)}`}>
                          <Mail className="h-3.5 w-3.5" /> Reply
                        </a>
                      </Button>
                      {s.status !== "read" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => updateStatus(s.id, "read")}
                        >
                          <MailOpen className="h-3.5 w-3.5" /> Mark read
                        </Button>
                      )}
                      {s.status !== "archived" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => updateStatus(s.id, "archived")}
                        >
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                        onClick={() => deleteSubmission(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContactSubmissions;

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Smile, X } from "lucide-react";
import { useSyndicateChat, ChatMessage } from "@/hooks/useSyndicateChat";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Lock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ReportDialog } from "./ReportDialog";

const REACTIONS = ["👍", "❤️", "🎉", "🔥"];

const Bubble = ({ m, mine, onReact, onReply, onReport }: {
  m: ChatMessage; mine: boolean;
  onReact: (id: string, e: string) => void;
  onReply: (m: ChatMessage) => void;
  onReport: (id: string) => void;
}) => {
  if (m.kind === "system") {
    return (
      <div className="my-2 text-center text-xs text-muted-foreground">
        <span className="rounded-full bg-secondary px-3 py-1">{m.body}</span>
      </div>
    );
  }
  const initial = (m.author?.full_name || m.author?.username || "?").charAt(0).toUpperCase();
  return (
    <div className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
      <Link to={m.author?.username ? `/u/${m.author.username}` : "#"}>
        <Avatar className="h-7 w-7 shrink-0">
          {m.author?.avatar_url && <AvatarImage src={m.author.avatar_url} />}
          <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
        </Avatar>
      </Link>
      <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
        <div className="mb-0.5 flex items-center gap-1.5 px-1">
          <Link to={m.author?.username ? `/u/${m.author.username}` : "#"} className="text-xs font-medium hover:underline">
            {m.author?.full_name || m.author?.username || "Member"}
          </Link>
          <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
        </div>
        <div className={`group relative rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
          {m.body}
          <div className="absolute -top-3 right-0 hidden gap-0.5 group-hover:flex">
            <Popover>
              <PopoverTrigger asChild>
                <button className="rounded-full bg-background p-1 shadow-md hover:bg-secondary">
                  <Smile className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1" align="end">
                <div className="flex gap-1">
                  {REACTIONS.map((e) => (
                    <button key={e} onClick={() => onReact(m.id, e)} className="rounded p-1 hover:bg-secondary">{e}</button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <button onClick={() => onReply(m)} className="rounded-full bg-background px-2 py-1 text-[10px] shadow-md hover:bg-secondary">Reply</button>
            {!mine && <button onClick={() => onReport(m.id)} className="rounded-full bg-background px-2 py-1 text-[10px] shadow-md hover:bg-secondary">Report</button>}
          </div>
        </div>
        {!!m.reactions?.length && (
          <div className="mt-1 flex gap-1 px-1">
            {m.reactions.map((r) => (
              <button key={r.emoji} onClick={() => onReact(m.id, r.emoji)}
                className={`rounded-full px-2 py-0.5 text-xs ${r.mine ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const SyndicateChat = ({ syndicateId }: { syndicateId: string }) => {
  const { user } = useAuth();
  const { messages, loading, hasAccess, send, react } = useSyndicateChat(syndicateId);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (loading) return <Card className="p-6 text-center text-sm text-muted-foreground">Loading chat…</Card>;
  if (!hasAccess) {
    return (
      <Card className="p-8 text-center">
        <Lock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <div className="text-sm font-medium">Members-only chat</div>
        <div className="mt-1 text-xs text-muted-foreground">Buy a share to join the conversation.</div>
      </Card>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await send(text, reply?.id);
      setText("");
      setReply(null);
    } catch (err: any) {
      // toast handled in hook would be ideal; show alert-like:
      console.error(err.message);
    }
  };

  return (
    <Card className="flex h-[600px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Be the first to say hi 👋</div>
        ) : (
          messages.map((m) => (
            <Bubble key={m.id} m={m} mine={m.user_id === user?.id} onReact={react} onReply={setReply} onReport={setReportId} />
          ))
        )}
        <div ref={endRef} />
      </div>
      {reply && (
        <div className="flex items-center justify-between border-t border-border bg-secondary/50 px-3 py-1.5 text-xs">
          <span className="truncate text-muted-foreground">Replying to: <span className="text-foreground">{reply.body}</span></span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReply(null)}><X className="h-3 w-3" /></Button>
        </div>
      )}
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-3">
        <Input
          placeholder="Write a message… use @username to mention"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
        />
        <Button type="submit" size="icon" disabled={!text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <ReportDialog
        open={!!reportId}
        onOpenChange={(o) => !o && setReportId(null)}
        targetType="message"
        targetId={reportId ?? ""}
      />
    </Card>
  );
};

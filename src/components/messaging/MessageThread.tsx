import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImageIcon, Loader2, Send, Smile, X, Check, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useDMChat, DMMessage } from "@/hooks/useDMChat";
import { toast } from "sonner";

const REACTIONS = ["👍", "❤️", "🎉", "🔥"];

const Bubble = ({
  m,
  mine,
  onReact,
  onReply,
  read,
}: {
  m: DMMessage;
  mine: boolean;
  onReact: (id: string, e: string) => void;
  onReply: (m: DMMessage) => void;
  read: boolean;
}) => (
  <div className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
    <div className={`max-w-[78%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`group relative rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
        {m.kind === "image" && m.image_url && (
          <img src={m.image_url} alt={m.body ?? "Attachment"} className="mb-1 max-h-72 rounded-lg object-cover" loading="lazy" />
        )}
        {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
        <div className="absolute -top-3 right-0 hidden gap-0.5 group-hover:flex">
          <Popover>
            <PopoverTrigger asChild>
              <button className="rounded-full bg-background p-1 shadow-md hover:bg-secondary" aria-label="React">
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
        </div>
      </div>
      <div className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
        <span>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
        {mine && (read ? <CheckCheck className="h-3 w-3 text-primary" /> : <Check className="h-3 w-3" />)}
      </div>
      {!!m.reactions?.length && (
        <div className="mt-1 flex gap-1 px-1">
          {m.reactions.map((r) => (
            <button
              key={r.emoji}
              onClick={() => onReact(m.id, r.emoji)}
              className={`rounded-full px-2 py-0.5 text-xs ${r.mine ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}
            >
              {r.emoji} {r.count}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

export const MessageThread = ({ threadId }: { threadId: string }) => {
  const { user } = useAuth();
  const { thread, messages, loading, otherTyping, send, sendImage, react, ping } = useDMChat(threadId);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<DMMessage | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastTypingPing = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, otherTyping]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!thread) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Conversation not found.</div>;
  }

  const initial = (thread.other_full_name || thread.other_username || "?").charAt(0).toUpperCase();
  const otherReadAt = thread.other_last_read_at ? new Date(thread.other_last_read_at).getTime() : 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await send(text, reply?.id);
      setText("");
      setReply(null);
    } catch (err: any) {
      toast.error(err.message ?? "Could not send");
    }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      await sendImage(f, text || undefined);
      setText("");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onType = (v: string) => {
    setText(v);
    const now = Date.now();
    if (now - lastTypingPing.current > 1500) {
      lastTypingPing.current = now;
      ping();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link to={thread.other_username ? `/u/${thread.other_username}` : "#"} className="flex items-center gap-2">
          <Avatar className="h-9 w-9">
            {thread.other_avatar_url && <AvatarImage src={thread.other_avatar_url} />}
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-semibold">{thread.other_full_name || thread.other_username || "Member"}</div>
            <div className="text-xs text-muted-foreground">@{thread.other_username ?? "—"}</div>
          </div>
        </Link>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Say hi 👋 — you both follow each other.</div>
        ) : (
          messages.map((m) => (
            <Bubble
              key={m.id}
              m={m}
              mine={m.sender_id === user?.id}
              onReact={react}
              onReply={setReply}
              read={m.sender_id === user?.id && new Date(m.created_at).getTime() <= otherReadAt}
            />
          ))
        )}
        {otherTyping && (
          <div className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
            typing…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {reply && (
        <div className="flex items-center justify-between border-t border-border bg-secondary/50 px-3 py-1.5 text-xs">
          <span className="truncate text-muted-foreground">
            Replying to: <span className="text-foreground">{reply.body ?? "📷 Photo"}</span>
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReply(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-3">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
        <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Attach image">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        </Button>
        <Input
          placeholder="Type a message…"
          value={text}
          onChange={(e) => onType(e.target.value)}
          maxLength={1000}
        />
        <Button type="submit" size="icon" disabled={!text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

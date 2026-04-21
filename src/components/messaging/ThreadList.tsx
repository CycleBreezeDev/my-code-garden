import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { DMThreadSummary } from "@/hooks/useDMThreads";
import { cn } from "@/lib/utils";

export const ThreadList = ({
  threads,
  activeId,
  onSelect,
  emptyText = "No conversations yet.",
}: {
  threads: DMThreadSummary[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  emptyText?: string;
}) => {
  if (!threads.length) {
    return <div className="p-6 text-center text-sm text-muted-foreground">{emptyText}</div>;
  }
  return (
    <ScrollArea className="h-full">
      <ul className="divide-y divide-border">
        {threads.map((t) => {
          const initial = (t.other_full_name || t.other_username || "?").charAt(0).toUpperCase();
          const isActive = activeId === t.id;
          return (
            <li key={t.id}>
              <button
                onClick={() => onSelect(t.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-secondary/60",
                  isActive && "bg-secondary",
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  {t.other_avatar_url && <AvatarImage src={t.other_avatar_url} />}
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">
                      {t.other_full_name || t.other_username || "Member"}
                    </div>
                    <div className="shrink-0 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className={cn("truncate text-xs", t.unread_count > 0 ? "font-medium text-foreground" : "text-muted-foreground")}>
                      {t.last_message_preview ?? "—"}
                    </div>
                    {t.unread_count > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {t.unread_count > 99 ? "99+" : t.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
};

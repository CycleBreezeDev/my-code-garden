import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageCircle } from "lucide-react";
import { ThreadList } from "./ThreadList";
import { useDMThreads } from "@/hooks/useDMThreads";
import { useDMUnread } from "@/hooks/useDMUnread";
import { Button } from "@/components/ui/button";

export const MessagesPeek = () => {
  const [open, setOpen] = useState(false);
  const { threads } = useDMThreads();
  const { count } = useDMUnread();
  const navigate = useNavigate();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Messages">
          <MessageCircle className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Messages</span>
          <Link to="/messages" onClick={() => setOpen(false)} className="text-xs text-primary hover:underline">
            See all
          </Link>
        </div>
        <div className="max-h-96">
          <ThreadList
            threads={threads.slice(0, 8)}
            onSelect={(id) => {
              setOpen(false);
              navigate(`/messages?t=${id}`);
            }}
            emptyText="No conversations yet. Follow each other to start chatting."
          />
        </div>
        <div className="border-t border-border p-2">
          <Button asChild variant="ghost" size="sm" className="w-full" onClick={() => setOpen(false)}>
            <Link to="/messages">Open inbox</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

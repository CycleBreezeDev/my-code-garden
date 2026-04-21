import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Loader2, MessageCircle } from "lucide-react";
import { useDMThreads } from "@/hooks/useDMThreads";
import { ThreadList } from "@/components/messaging/ThreadList";
import { MessageThread } from "@/components/messaging/MessageThread";

const MessagesPage = () => {
  const { threads, loading } = useDMThreads();
  const [params, setParams] = useSearchParams();
  const initial = params.get("t");
  const [activeId, setActiveId] = useState<string | null>(initial);

  useEffect(() => {
    if (initial && initial !== activeId) setActiveId(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // Default-select first thread on desktop when none chosen
  useEffect(() => {
    if (!activeId && threads.length > 0 && window.innerWidth >= 768) {
      setActiveId(threads[0].id);
    }
  }, [threads, activeId]);

  const select = (id: string) => {
    setActiveId(id);
    setParams({ t: id }, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
          <h1 className="mb-4 font-heading text-2xl font-bold">Messages</h1>
          <Card className="grid h-[70vh] grid-cols-1 overflow-hidden md:grid-cols-[320px_1fr]">
            {/* Thread list */}
            <aside className={`border-r border-border ${activeId ? "hidden md:block" : "block"}`}>
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (
                <ThreadList
                  threads={threads}
                  activeId={activeId}
                  onSelect={select}
                  emptyText="No conversations yet. Follow someone who follows you back, then tap Message on their profile."
                />
              )}
            </aside>

            {/* Active thread */}
            <section className={`min-h-0 ${activeId ? "block" : "hidden md:flex md:items-center md:justify-center"}`}>
              {activeId ? (
                <div className="flex h-full flex-col">
                  <button
                    className="border-b border-border px-4 py-2 text-left text-xs text-muted-foreground hover:bg-secondary md:hidden"
                    onClick={() => {
                      setActiveId(null);
                      setParams({}, { replace: true });
                    }}
                  >
                    ← Back to inbox
                  </button>
                  <div className="min-h-0 flex-1">
                    <MessageThread threadId={activeId} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <MessageCircle className="h-10 w-10" />
                  <div className="text-sm">Pick a conversation to start chatting.</div>
                </div>
              )}
            </section>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MessagesPage;

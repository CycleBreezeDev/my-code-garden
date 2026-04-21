import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, ImageIcon, Trash2, Ticket } from "lucide-react";
import { toast } from "sonner";

type TicketImage = {
  id: string;
  syndicate_id: string;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
};

type SyndicateLite = { id: string; name: string };

const SignedImage = ({ path }: { path: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    supabase.storage
      .from("ticket-images")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (active && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-secondary/40">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt="Scanned lottery ticket"
      loading="lazy"
      className="aspect-[4/3] w-full rounded-lg object-cover border border-border"
    />
  );
};

const SyndicateTickets = ({ syndicate }: { syndicate: SyndicateLite }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: images, isLoading } = useQuery({
    queryKey: ["ticket-images", syndicate.id],
    queryFn: async (): Promise<TicketImage[]> => {
      const { data, error } = await supabase
        .from("ticket_images")
        .select("*")
        .eq("syndicate_id", syndicate.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (img: TicketImage) => {
      await supabase.storage.from("ticket-images").remove([img.storage_path]);
      const { error } = await supabase.from("ticket_images").delete().eq("id", img.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-images", syndicate.id] });
      toast.success("Ticket removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${syndicate.id}/${user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("ticket-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("ticket_images").insert({
        syndicate_id: syndicate.id,
        uploaded_by: user.id,
        storage_path: path,
      });
      if (insErr) throw insErr;

      qc.invalidateQueries({ queryKey: ["ticket-images", syndicate.id] });
      toast.success("Ticket uploaded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">{syndicate.name}</div>
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            Upload
          </span>
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : images && images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <div key={img.id} className="group relative">
              <SignedImage path={img.storage_path} />
              {img.uploaded_by === user?.id && (
                <button
                  onClick={() => deleteMutation.mutate(img)}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete ticket"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No tickets uploaded yet</p>
        </div>
      )}
    </div>
  );
};

const MyTicketsSection = () => {
  const { user } = useAuth();

  const { data: syndicates, isLoading } = useQuery({
    queryKey: ["my-syndicates-for-tickets", user?.id],
    queryFn: async (): Promise<SyndicateLite[]> => {
      const { data, error } = await supabase
        .from("syndicate_memberships")
        .select("syndicate:syndicates!inner(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const seen = new Set<string>();
      const out: SyndicateLite[] = [];
      for (const row of (data as unknown as { syndicate: SyndicateLite }[]) ?? []) {
        if (row.syndicate && !seen.has(row.syndicate.id)) {
          seen.add(row.syndicate.id);
          out.push(row.syndicate);
        }
      }
      return out;
    },
    enabled: !!user,
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">My Tickets</h2>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : syndicates && syndicates.length > 0 ? (
        <div className="space-y-4">
          {syndicates.map((s) => (
            <SyndicateTickets key={s.id} syndicate={s} />
          ))}
        </div>
      ) : (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Join a syndicate to upload and view scanned tickets.
          </p>
        </div>
      )}
    </div>
  );
};

export default MyTicketsSection;

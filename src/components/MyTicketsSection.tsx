import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Upload, ImageIcon, Trash2, Ticket, Eye, EyeOff, ShieldCheck, Circle } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useMyPicks, type SyndicatePickRow } from "@/hooks/useSyndicatePicks";
import { NumberBalls } from "@/components/syndicate/NumberBalls";
import {
  useTicketPickVerifications,
  useToggleTicketPickVerification,
} from "@/hooks/useTicketPickVerifications";

type TicketImage = {
  id: string;
  syndicate_id: string;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
};

type SyndicateLite = {
  id: string;
  name: string;
  membership_id: string;
  shares: number;
  lottery_color: string | null;
};

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

const MyNumbersOverlay = ({
  picks,
  color,
  highlightShareIndex,
  ticketImageId,
  syndicateId,
  membershipId,
  verifiedShareIndexes,
  onToggle,
  toggleBusy,
}: {
  picks: SyndicatePickRow[];
  color: string;
  highlightShareIndex?: number | null;
  ticketImageId: string;
  syndicateId: string;
  membershipId: string;
  verifiedShareIndexes: Set<number>;
  onToggle: (shareIndex: number, next: boolean) => void;
  toggleBusy: number | null;
}) => {
  const verifiedCount = picks.reduce(
    (n, p) => (verifiedShareIndexes.has(p.share_index) ? n + 1 : n),
    0
  );
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
          My allocated lines ({picks.length})
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
          <ShieldCheck className="h-3 w-3" />
          {verifiedCount}/{picks.length} verified
        </span>
      </div>
      <ul className="space-y-1.5">
        {picks.map((p) => {
          const isMatch = highlightShareIndex === p.share_index;
          const isVerified = verifiedShareIndexes.has(p.share_index);
          const isBusy = toggleBusy === p.share_index;
          return (
            <li
              key={p.id}
              className={
                isMatch
                  ? "flex flex-wrap items-center gap-2 rounded-md bg-primary/15 px-2 py-1.5 ring-2 ring-primary animate-pulse"
                  : "flex flex-wrap items-center gap-2"
              }
            >
              <span
                className={
                  isMatch
                    ? "text-[10px] font-mono font-bold text-primary w-12 shrink-0"
                    : "text-[10px] font-mono text-muted-foreground w-12 shrink-0"
                }
              >
                #{p.share_index}
              </span>
              <NumberBalls main={p.main_numbers} bonus={p.bonus_numbers} color={color} size="sm" />
              <button
                type="button"
                onClick={() => onToggle(p.share_index, !isVerified)}
                disabled={isBusy}
                aria-pressed={isVerified}
                aria-label={
                  isVerified
                    ? `Mark share ${p.share_index} as unverified on this scan`
                    : `Mark share ${p.share_index} as verified on this scan`
                }
                title={isVerified ? "Verified — click to undo" : "Tick to confirm these numbers appear on the scan"}
                className={`ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors disabled:opacity-60 ${
                  isVerified
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {isBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isVerified ? (
                  <ShieldCheck className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                {isVerified ? "Verified" : "Verify"}
              </button>
            </li>
          );
        })}
      </ul>
      {/* Required to silence unused-prop lint when nothing changes */}
      <span hidden aria-hidden data-image={ticketImageId} data-syn={syndicateId} data-mem={membershipId} />
    </div>
  );
};

const SyndicateTickets = ({
  syndicate,
  defaultExpanded = false,
  highlightShareIndex = null,
  onHighlightConsumed,
}: {
  syndicate: SyndicateLite;
  defaultExpanded?: boolean;
  highlightShareIndex?: number | null;
  onHighlightConsumed?: () => void;
}) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [matchMode, setMatchMode] = useState(defaultExpanded);
  const firstScanRef = useRef<HTMLDivElement | null>(null);

  // When parent asks us to highlight a share, force match-mode + scroll into view.
  useEffect(() => {
    if (highlightShareIndex == null) return;
    setMatchMode(true);
    requestAnimationFrame(() => {
      firstScanRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const t = setTimeout(() => onHighlightConsumed?.(), 3500);
    return () => clearTimeout(t);
  }, [highlightShareIndex, onHighlightConsumed]);

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

  const { data: myPicks } = useMyPicks(syndicate.membership_id);
  const myAllocated = (myPicks ?? []).filter(
    (p) => p.main_numbers.length > 0 && (p.status === "included" || p.status === "quick_picked")
  );
  const lotteryColor = syndicate.lottery_color || "hsl(var(--primary))";

  // Per-user verification rows for every ticket image in this syndicate
  const {
    data: verifications,
    error: verificationsError,
    isFetching: verificationsFetching,
    refetch: refetchVerifications,
  } = useTicketPickVerifications(syndicate.id);
  const verificationsErrorCode = (verificationsError as (Error & { code?: string }) | null)?.code;
  const isPermissionError = verificationsErrorCode === "PERMISSION";
  const verifyMutation = useToggleTicketPickVerification();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // image_id -> Set<share_index>
  const verifiedByImage = useMemo(() => {
    const m = new Map<string, Set<number>>();
    for (const v of verifications ?? []) {
      const set = m.get(v.ticket_image_id) ?? new Set<number>();
      set.add(v.share_index);
      m.set(v.ticket_image_id, set);
    }
    return m;
  }, [verifications]);

  const handleToggle = (
    ticketImageId: string,
    shareIndex: number,
    verified: boolean
  ) => {
    const key = `${ticketImageId}:${shareIndex}`;
    setBusyKey(key);
    verifyMutation.mutate(
      {
        ticketImageId,
        syndicateId: syndicate.id,
        membershipId: syndicate.membership_id,
        shareIndex,
        verified,
      },
      {
        onSuccess: () => {
          toast.success(verified ? "Marked verified" : "Verification removed");
        },
        onError: (e: Error) => {
          if (/relation .* does not exist/i.test(e.message)) {
            toast.error("Verification table not deployed yet — apply the latest migration.");
          } else {
            toast.error(e.message);
          }
        },
        onSettled: () => setBusyKey(null),
      }
    );
  };


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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-medium text-foreground">{syndicate.name}</div>
        <div className="flex items-center gap-3">
          {myAllocated.length > 0 && (
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
              <Switch
                checked={matchMode}
                onCheckedChange={setMatchMode}
                aria-label="Match my numbers"
              />
              <span className="inline-flex items-center gap-1">
                {matchMode ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                Match my numbers
              </span>
            </label>
          )}
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
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : images && images.length > 0 ? (
        <div className="space-y-3">
          {images.map((img, i) => (
            <div
              key={img.id}
              ref={i === 0 ? firstScanRef : undefined}
              className={
                matchMode
                  ? `grid gap-3 sm:grid-cols-[1.2fr_1fr] rounded-lg p-1 transition-all ${
                      highlightShareIndex != null && i === 0
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
                        : ""
                    }`
                  : "grid grid-cols-2 gap-3 sm:grid-cols-3"
              }
            >
              <div className="group relative">
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
              {matchMode && (
                <MyNumbersOverlay
                  picks={myAllocated}
                  color={lotteryColor}
                  highlightShareIndex={highlightShareIndex}
                  ticketImageId={img.id}
                  syndicateId={syndicate.id}
                  membershipId={syndicate.membership_id}
                  verifiedShareIndexes={verifiedByImage.get(img.id) ?? new Set<number>()}
                  onToggle={(shareIndex, next) => handleToggle(img.id, shareIndex, next)}
                  toggleBusy={
                    busyKey?.startsWith(`${img.id}:`)
                      ? Number(busyKey.split(":")[1])
                      : null
                  }
                />
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

interface MyTicketsSectionProps {
  /** Restrict to a single syndicate id (used on group detail page). */
  syndicateFilter?: string;
  /** Default-open match-mode for this syndicate. */
  highlightSyndicateId?: string;
  /** When set, the matching share row is pulsed and the scan is scrolled into view. */
  highlightShareIndex?: number | null;
  /** Called once the highlight has been applied so parent can reset its state. */
  onHighlightConsumed?: () => void;
}

const MyTicketsSection = ({
  syndicateFilter,
  highlightSyndicateId,
  highlightShareIndex = null,
  onHighlightConsumed,
}: MyTicketsSectionProps = {}) => {
  const { user } = useAuth();

  const { data: syndicates, isLoading } = useQuery({
    queryKey: ["my-syndicates-for-tickets", user?.id, syndicateFilter ?? "all"],
    queryFn: async (): Promise<SyndicateLite[]> => {
      let query = supabase
        .from("syndicate_memberships")
        .select(
          "id, shares, syndicate:syndicates!inner(id, name, draw:lottery_draws!inner(lottery:lotteries!inner(color)))"
        )
        .order("created_at", { ascending: false });
      if (syndicateFilter) {
        query = query.eq("syndicate_id", syndicateFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      const seen = new Set<string>();
      const out: SyndicateLite[] = [];
      type Row = {
        id: string;
        shares: number;
        syndicate: {
          id: string;
          name: string;
          draw: { lottery: { color: string | null } };
        };
      };
      for (const row of (data as unknown as Row[]) ?? []) {
        if (row.syndicate && !seen.has(row.syndicate.id)) {
          seen.add(row.syndicate.id);
          out.push({
            id: row.syndicate.id,
            name: row.syndicate.name,
            membership_id: row.id,
            shares: row.shares,
            lottery_color: row.syndicate.draw?.lottery?.color ?? null,
          });
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
          <h2 className="text-lg font-semibold text-foreground">
            {syndicateFilter ? "Ticket Scans" : "My Tickets"}
          </h2>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : syndicates && syndicates.length > 0 ? (
        <div className="space-y-4">
          {syndicates.map((s) => {
            const isHighlighted = s.id === highlightSyndicateId;
            return (
              <SyndicateTickets
                key={s.id}
                syndicate={s}
                defaultExpanded={isHighlighted}
                highlightShareIndex={isHighlighted ? highlightShareIndex : null}
                onHighlightConsumed={isHighlighted ? onHighlightConsumed : undefined}
              />
            );
          })}
        </div>
      ) : (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {syndicateFilter
              ? "No tickets uploaded yet for this group."
              : "Join a syndicate to upload and view scanned tickets."}
          </p>
        </div>
      )}
    </div>
  );
};

export default MyTicketsSection;

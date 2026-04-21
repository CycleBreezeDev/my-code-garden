import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ImageCropDialog } from "./ImageCropDialog";

interface CoverUploaderProps {
  currentUrl: string | null;
  onChange: (newUrl: string | null) => Promise<void> | void;
}

// 3:1 banner — wide enough for hero, short enough to leave room for the
// avatar overlap. Output 1500×500 keeps things crisp on retina without
// blowing up storage.
const COVER_ASPECT = 3;
const COVER_OUTPUT_WIDTH = 1500;

/**
 * Cover/banner picker — opens a 3:1 center-crop dialog (with zoom/pan) before
 * uploading to the public `avatars` bucket under
 * `<auth.uid()>/cover-<ts>.jpg`.
 */
export const CoverUploader = ({ currentUrl, onChange }: CoverUploaderProps) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);

  useEffect(() => () => {
    if (pendingSrc) URL.revokeObjectURL(pendingSrc);
  }, [pendingSrc]);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Cover must be under 15 MB");
      return;
    }
    setPendingSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!user) return;
    setUploading(true);
    const path = `${user.id}/cover-${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, {
      upsert: false,
      contentType: "image/jpeg",
    });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    await onChange(pub.publicUrl);
    setUploading(false);
    setPendingSrc(null);
    toast.success("Cover updated");
  };

  return (
    <div className="space-y-3">
      <div className="relative h-32 w-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20">
        {currentUrl && (
          <img src={currentUrl} alt="Cover banner preview" className="h-full w-full object-cover" />
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
          )}
          {currentUrl ? "Change cover" : "Upload cover"}
        </Button>
        {currentUrl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            disabled={uploading}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>
      <ImageCropDialog
        open={!!pendingSrc}
        imageSrc={pendingSrc}
        aspect={COVER_ASPECT}
        cropShape="rect"
        outputWidth={COVER_OUTPUT_WIDTH}
        title="Position your cover"
        description="Drag to recenter and use the slider to zoom. The banner uses a 3:1 ratio."
        busy={uploading}
        onCancel={() => setPendingSrc(null)}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
};

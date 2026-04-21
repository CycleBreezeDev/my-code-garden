import { ChangeEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CoverUploaderProps {
  currentUrl: string | null;
  onChange: (newUrl: string | null) => Promise<void> | void;
}

/**
 * Cover/banner picker — uploads to the same public `avatars` bucket but under
 * `<auth.uid()>/cover-<ts>.<ext>` so a single storage policy covers both.
 */
export const CoverUploader = ({ currentUrl, onChange }: CoverUploaderProps) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Cover must be under 8 MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/cover-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    await onChange(pub.publicUrl);
    setUploading(false);
    toast.success("Cover updated");
  };

  return (
    <div className="space-y-3">
      <div
        className="relative h-32 w-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20"
      >
        {currentUrl && (
          <img
            src={currentUrl}
            alt="Cover banner preview"
            className="h-full w-full object-cover"
          />
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
    </div>
  );
};

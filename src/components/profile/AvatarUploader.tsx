import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ImageCropDialog } from "./ImageCropDialog";

interface AvatarUploaderProps {
  currentUrl: string | null;
  fallback: string;
  onChange: (newUrl: string | null) => Promise<void> | void;
}

/**
 * Avatar picker — opens a square crop+zoom dialog before uploading the
 * resulting 512×512 JPEG to the public `avatars` bucket under
 * `<auth.uid()>/avatar-<ts>.jpg`.
 */
export const AvatarUploader = ({ currentUrl, fallback, onChange }: AvatarUploaderProps) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);

  // Revoke object URL when the dialog closes to avoid memory leaks.
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
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }
    setPendingSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!user) return;
    setUploading(true);
    const path = `${user.id}/avatar-${Date.now()}.jpg`;
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
    toast.success("Avatar updated");
  };

  const handleRemove = async () => {
    if (!currentUrl) return;
    setUploading(true);
    await onChange(null);
    setUploading(false);
    toast.success("Avatar removed");
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-20 w-20 border-2 border-background shadow">
        {currentUrl && <AvatarImage src={currentUrl} />}
        <AvatarFallback className="text-2xl">{fallback}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="mr-1.5 h-3.5 w-3.5" />
          )}
          {currentUrl ? "Change avatar" : "Upload avatar"}
        </Button>
        {currentUrl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
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
        aspect={1}
        cropShape="round"
        outputWidth={512}
        title="Crop your avatar"
        description="Drag to reposition and use the slider to zoom. Avatars are saved as a square."
        busy={uploading}
        onCancel={() => setPendingSrc(null)}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
};

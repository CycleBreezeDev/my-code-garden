import { ChangeEvent, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AvatarUploaderProps {
  currentUrl: string | null;
  fallback: string;
  onChange: (newUrl: string | null) => Promise<void> | void;
}

/**
 * Avatar picker — uploads to the public `avatars` bucket under
 * `<auth.uid()>/avatar-<ts>.<ext>` (storage RLS scopes writes to the user's
 * own folder). The generated public URL is handed back via `onChange` so the
 * parent can persist it on `profiles.avatar_url` and rollback on failure.
 */
export const AvatarUploader = ({ currentUrl, fallback, onChange }: AvatarUploaderProps) => {
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
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
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
    </div>
  );
};

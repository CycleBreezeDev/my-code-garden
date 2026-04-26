import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { MyProfileData } from "@/hooks/useMyProfile";
import { supabase } from "@/integrations/supabase/client";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: MyProfileData;
  onSaved: (next: { full_name: string | null; username: string; bio: string | null; country_code: string | null; is_public: boolean }) => void;
}

const schema = z.object({
  full_name: z.string().trim().max(80, "Name must be 80 characters or fewer").optional(),
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{3,24}$/, "3-24 chars, letters/numbers/underscore only"),
  bio: z.string().trim().max(280, "Bio must be 280 characters or fewer").optional(),
  country_code: z
    .string()
    .trim()
    .max(3, "ISO country code (e.g. NG)")
    .optional(),
  is_public: z.boolean(),
});

/**
 * Centralized "edit profile" modal — covers the fields a user changes most
 * often (name, handle, bio, country, public toggle). Avatar/cover uploads
 * stay inline in Settings since they are async file pickers, not text input.
 */
export const EditProfileDialog = ({ open, onOpenChange, data, onSaved }: EditProfileDialogProps) => {
  const [fullName, setFullName] = useState(data.full_name ?? "");
  const [username, setUsername] = useState(data.username);
  const [bio, setBio] = useState(data.bio ?? "");
  const [country, setCountry] = useState(data.country_code ?? "");
  const [isPublic, setIsPublic] = useState(data.is_public);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset whenever the dialog opens so a discarded edit doesn't bleed through.
  useEffect(() => {
    if (open) {
      setFullName(data.full_name ?? "");
      setUsername(data.username);
      setBio(data.bio ?? "");
      setCountry(data.country_code ?? "");
      setIsPublic(data.is_public);
      setErrors({});
    }
  }, [open, data]);

  const handleSave = async () => {
    const parsed = schema.safeParse({
      full_name: fullName,
      username,
      bio,
      country_code: country,
      is_public: isPublic,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        next[i.path[0] as string] = i.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);

    const trimmedName = fullName.trim();
    const trimmedBio = bio.trim();
    const trimmedCountry = country.trim().toUpperCase();

    // Update the private `profiles` row (full_name only).
    const { error: privErr } = await supabase
      .from("profiles")
      .update({ full_name: trimmedName || null })
      .eq("user_id", data.user_id);
    if (privErr) {
      toast.error("Couldn't save settings", {
        description: privErr.message || "We couldn't update your profile. Please try again.",
        action: { label: "Retry", onClick: () => { void handleSave(); } },
      });
      setSaving(false);
      return;
    }

    // Update the public/social row.
    const { error: pubErr } = await supabase
      .from("user_profiles_public")
      .update({
        username,
        bio: trimmedBio || null,
        country_code: trimmedCountry || null,
        is_public: isPublic,
      })
      .eq("user_id", data.user_id);
    if (pubErr) {
      // Username uniqueness violations come back as 23505 — surface inline,
      // not as a retry toast (retrying the same handle won't help).
      if (pubErr.code === "23505") {
        setErrors({ username: "That username is already taken" });
      } else {
        toast.error("Couldn't save settings", {
          description: pubErr.message || "We couldn't update your profile. Please try again.",
          action: { label: "Retry", onClick: () => { void handleSave(); } },
        });
      }
      setSaving(false);
      return;
    }

    onSaved({
      full_name: trimmedName || null,
      username,
      bio: trimmedBio || null,
      country_code: trimmedCountry || null,
      is_public: isPublic,
    });
    toast.success("Profile updated");
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Your name and bio appear across the platform.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Display name</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={80}
              placeholder="Your full name"
            />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">@</span>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={24}
                placeholder="handle"
              />
            </div>
            {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Tell people about yourself"
            />
            <p className="text-right text-xs text-muted-foreground">{bio.length}/280</p>
            {errors.bio && <p className="text-xs text-destructive">{errors.bio}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="country">Country code</Label>
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="e.g. NG"
            />
            {errors.country_code && <p className="text-xs text-destructive">{errors.country_code}</p>}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="is_public" className="text-sm font-medium">Public profile</Label>
              <p className="text-xs text-muted-foreground">Let anyone view your /u/{username || "handle"} page.</p>
            </div>
            <Switch id="is_public" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

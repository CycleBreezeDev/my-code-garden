import { useState } from "react";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AtSign, KeyRound, Loader2, LogOut, Mail, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { MyProfileData } from "@/hooks/useMyProfile";

interface AccountSettingsCardProps {
  data: MyProfileData;
  onDigestChange: (enabled: boolean) => void;
}

const passwordSchema = z
  .object({
    next: z
      .string()
      .min(8, "At least 8 characters")
      .max(72, "At most 72 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

const emailSchema = z.string().email("Enter a valid email").max(255);

/**
 * Email change, password change, notification prefs, and "sign out everywhere".
 * All sensitive flows go straight through `supabase.auth` — no custom RPC —
 * so MFA / rate limiting / session rotation behave normally.
 */
export const AccountSettingsCard = ({ data, onDigestChange }: AccountSettingsCardProps) => {
  const { user } = useAuth();
  const [newEmail, setNewEmail] = useState(user?.email ?? "");
  const [savingEmail, setSavingEmail] = useState(false);
  const [pwNext, setPwNext] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [savingDigest, setSavingDigest] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleEmail = async () => {
    const parsed = emailSchema.safeParse(newEmail.trim());
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (parsed.data === user?.email) {
      toast.info("That's already your email");
      return;
    }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: parsed.data });
    setSavingEmail(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Confirmation email sent — check your inbox");
  };

  const handlePassword = async () => {
    setPwError(null);
    const parsed = passwordSchema.safeParse({ next: pwNext, confirm: pwConfirm });
    if (!parsed.success) {
      setPwError(parsed.error.issues[0].message);
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
    setSavingPw(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    setPwNext("");
    setPwConfirm("");
    toast.success("Password updated");
  };

  const handleDigest = async (enabled: boolean) => {
    setSavingDigest(true);
    const { error } = await supabase
      .from("user_profiles_public")
      .update({ email_digest_enabled: enabled })
      .eq("user_id", data.user_id);
    setSavingDigest(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onDigestChange(enabled);
    toast.success(enabled ? "Digest emails on" : "Digest emails off");
  };

  const handleGlobalSignOut = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    setSigningOut(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed out everywhere");
  };

  return (
    <Card className="space-y-6 p-6">
      {/* Email */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="h-3.5 w-3.5" /> Email address
        </Label>
        <div className="flex gap-2">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Button onClick={handleEmail} disabled={savingEmail} variant="outline">
            {savingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Update"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          You'll receive a confirmation link at the new address.
        </p>
      </div>

      <Separator />

      {/* Password */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-3.5 w-3.5" /> Change password
        </Label>
        <Input
          type="password"
          value={pwNext}
          onChange={(e) => setPwNext(e.target.value)}
          placeholder="New password"
          autoComplete="new-password"
        />
        <Input
          type="password"
          value={pwConfirm}
          onChange={(e) => setPwConfirm(e.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
        />
        {pwError && <p className="text-xs text-destructive">{pwError}</p>}
        <Button onClick={handlePassword} disabled={savingPw || !pwNext || !pwConfirm} className="w-full">
          {savingPw ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Update password
        </Button>
      </div>

      <Separator />

      {/* Notifications */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="flex items-center gap-2 text-sm font-semibold">
            <AtSign className="h-3.5 w-3.5" /> Email digest
          </Label>
          <p className="text-xs text-muted-foreground">Weekly summary of your groups & wins.</p>
        </div>
        <Switch
          checked={data.email_digest_enabled}
          onCheckedChange={handleDigest}
          disabled={savingDigest}
        />
      </div>

      <Separator />

      {/* Danger zone */}
      <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <Label className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <ShieldAlert className="h-3.5 w-3.5" /> Danger zone
        </Label>
        <p className="text-xs text-muted-foreground">
          Sign out of every device where you're currently logged in.
        </p>
        <Button
          variant="outline"
          onClick={handleGlobalSignOut}
          disabled={signingOut}
          className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {signingOut ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
          )}
          Sign out everywhere
        </Button>
      </div>
    </Card>
  );
};

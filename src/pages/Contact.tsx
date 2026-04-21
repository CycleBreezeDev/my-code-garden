import { useState } from "react";
import { z } from "zod";
import LegalPageLayout from "@/components/LegalPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MessageCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .max(255, "Email is too long"),
  subject: z.string().trim().min(1, "Subject is required").max(200, "Subject is too long"),
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(2000, "Message must be 2000 characters or less"),
});

const Contact = () => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const parsed = contactSchema.safeParse({
      name: fd.get("name"),
      email: fd.get("email"),
      subject: fd.get("subject"),
      message: fd.get("message"),
    });

    if (!parsed.success) {
      toast({
        title: "Please check your input",
        description: parsed.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { name, email, subject, message } = parsed.data;
      const { error } = await supabase.from("contact_submissions").insert([
        {
          name,
          email,
          subject,
          message,
          ...(user?.id ? { user_id: user.id } : {}),
        },
      ]);
      if (error) throw error;

      form.reset();
      toast({
        title: "Message sent",
        description: "Our support team will reply within 24 hours.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send message";
      toast({ title: "Something went wrong", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LegalPageLayout
      title="Contact us"
      subtitle="Questions about a ticket, payout, or your account? We're here to help."
    >
      <div className="grid gap-8 md:grid-cols-3 not-prose">
        <div className="rounded-xl border border-border bg-card p-5">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">Email</h3>
          <p className="mt-1 text-sm text-muted-foreground">support@epiclotto.com</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">Live chat</h3>
          <p className="mt-1 text-sm text-muted-foreground">Available in your dashboard.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">Hours</h3>
          <p className="mt-1 text-sm text-muted-foreground">Mon–Sun, 8am–10pm UTC</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="not-prose mt-10 space-y-5 rounded-xl border border-border bg-card/50 p-6"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={100} placeholder="Your name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              maxLength={255}
              placeholder="you@email.com"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" name="subject" required maxLength={200} placeholder="How can we help?" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            name="message"
            required
            rows={6}
            maxLength={2000}
            placeholder="Tell us more..."
          />
        </div>
        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
            </>
          ) : (
            "Send message"
          )}
        </Button>
      </form>
    </LegalPageLayout>
  );
};

export default Contact;

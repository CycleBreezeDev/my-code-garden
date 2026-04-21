CREATE TABLE public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT contact_submissions_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT contact_submissions_email_length CHECK (char_length(email) BETWEEN 3 AND 255),
  CONSTRAINT contact_submissions_subject_length CHECK (char_length(subject) BETWEEN 1 AND 200),
  CONSTRAINT contact_submissions_message_length CHECK (char_length(message) BETWEEN 1 AND 2000),
  CONSTRAINT contact_submissions_status_check CHECK (status IN ('new', 'read', 'archived'))
);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a contact message"
  ON public.contact_submissions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view contact submissions"
  ON public.contact_submissions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update contact submissions"
  ON public.contact_submissions
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete contact submissions"
  ON public.contact_submissions
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_contact_submissions_created_at ON public.contact_submissions (created_at DESC);
CREATE INDEX idx_contact_submissions_status ON public.contact_submissions (status);

CREATE TRIGGER trg_contact_submissions_updated_at
  BEFORE UPDATE ON public.contact_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
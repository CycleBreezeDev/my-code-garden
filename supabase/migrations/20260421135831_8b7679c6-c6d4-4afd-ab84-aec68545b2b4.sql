CREATE TABLE public.ticket_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicate_id UUID NOT NULL REFERENCES public.syndicates(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_images_syndicate ON public.ticket_images(syndicate_id);

ALTER TABLE public.ticket_images ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_syndicate_member(_syndicate_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.syndicate_memberships
    WHERE syndicate_id = _syndicate_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY "Members can view syndicate ticket images"
ON public.ticket_images FOR SELECT
USING (public.is_syndicate_member(syndicate_id));

CREATE POLICY "Members can upload ticket images"
ON public.ticket_images FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by
  AND public.is_syndicate_member(syndicate_id)
);

CREATE POLICY "Uploaders can delete their ticket images"
ON public.ticket_images FOR DELETE
USING (auth.uid() = uploaded_by);

INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-images', 'ticket-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Members can view ticket image files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ticket-images'
  AND public.is_syndicate_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Members can upload ticket image files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ticket-images'
  AND public.is_syndicate_member(((storage.foldername(name))[1])::uuid)
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their own ticket image files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ticket-images'
  AND owner = auth.uid()
);
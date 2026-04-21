INSERT INTO storage.buckets (id, name, public)
VALUES ('lottery-logos', 'lottery-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Lottery logos are publicly viewable" ON storage.objects;
CREATE POLICY "Lottery logos are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'lottery-logos');

DROP POLICY IF EXISTS "Admins can upload lottery logos" ON storage.objects;
CREATE POLICY "Admins can upload lottery logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'lottery-logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update lottery logos" ON storage.objects;
CREATE POLICY "Admins can update lottery logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'lottery-logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete lottery logos" ON storage.objects;
CREATE POLICY "Admins can delete lottery logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'lottery-logos' AND public.has_role(auth.uid(), 'admin'));
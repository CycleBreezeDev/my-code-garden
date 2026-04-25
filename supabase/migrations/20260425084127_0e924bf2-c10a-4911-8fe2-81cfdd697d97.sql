DROP POLICY IF EXISTS "Anyone can submit a contact message" ON public.contact_submissions;

CREATE POLICY "Public can submit a contact message"
ON public.contact_submissions
FOR INSERT
WITH CHECK (
  status = 'new'
  AND (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  )
);
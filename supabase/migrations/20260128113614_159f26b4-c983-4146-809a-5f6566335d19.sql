-- Create storage bucket for driver documents and images
INSERT INTO storage.buckets (id, name, public) VALUES ('driver-images', 'driver-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-images', 'vehicle-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('item-photos', 'item-photos', true);

-- Storage policies for driver-images bucket
CREATE POLICY "Anyone can view driver images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'driver-images');

CREATE POLICY "Authenticated users can upload driver images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'driver-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own driver images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'driver-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own driver images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'driver-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for vehicle-images bucket
CREATE POLICY "Anyone can view vehicle images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-images');

CREATE POLICY "Authenticated users can upload vehicle images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vehicle-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own vehicle images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'vehicle-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own vehicle images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'vehicle-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for documents bucket (private)
CREATE POLICY "Users can view their own documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'));

-- Storage policies for item-photos bucket
CREATE POLICY "Anyone can view item photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'item-photos');

CREATE POLICY "Authenticated users can upload item photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'item-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own item photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'item-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
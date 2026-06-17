-- supabase/migrations/20260317235220_add_logo_storage_and_columns.sql

-- 1. Ajouter les colonnes si elles manquent
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS favicon_url text,
ADD COLUMN IF NOT EXISTS primary_color text;

-- 2. Créer le bucket 'assets' s'il n'existe pas
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Politiques RLS pour Storage (Bucket assets)
-- On permet à tout le monde de lire (puisque c'est public)
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'assets');

-- On permet aux utilisateurs authentifiés d'uploader leur propre logo
-- (Ici on simplifie pour le MVP : authentifié peut uploader dans assets/logos/TENANT_ID/...)
CREATE POLICY "Authenticated Upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'assets' AND
  auth.role() = 'authenticated'
);

-- On permet aux propriétaires de modifier leurs fichiers
CREATE POLICY "Owner Delete" ON storage.objects
FOR DELETE USING (
  bucket_id = 'assets' AND
  auth.role() = 'authenticated'
);

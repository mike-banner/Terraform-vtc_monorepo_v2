-- Autoriser la lecture publique de la table tenants (nécessaire pour le multi-tenant front)
CREATE POLICY "Allow public read of tenants" ON public.tenants FOR SELECT USING (true);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

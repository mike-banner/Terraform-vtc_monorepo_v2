-- Adresse du vendeur, obligatoire sur une facture (14.1-04). Saisie dans Réglages, owner seul.
ALTER TABLE public.tenants
  ADD COLUMN address_line text CHECK (address_line IS NULL OR char_length(address_line) <= 200),
  ADD COLUMN postal_code text CHECK (postal_code IS NULL OR postal_code ~ '^[0-9A-Za-z -]{3,10}$'),
  ADD COLUMN city text CHECK (city IS NULL OR char_length(city) <= 100);

CREATE FUNCTION public.update_tenant_address(p_address_line text, p_postal_code text, p_city text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_addr text := trim(coalesce(p_address_line, ''));
  v_zip text := trim(coalesce(p_postal_code, ''));
  v_city text := trim(coalesce(p_city, ''));
BEGIN
  IF v_tenant IS NULL OR public.current_tenant_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_addr = '' OR v_zip = '' OR v_city = '' THEN
    RAISE EXCEPTION 'Adresse incomplète' USING ERRCODE = '22023';
  END IF;
  UPDATE public.tenants SET address_line = v_addr, postal_code = v_zip, city = v_city WHERE id = v_tenant;
END $$;

REVOKE EXECUTE ON FUNCTION public.update_tenant_address(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_address(text, text, text) TO authenticated;

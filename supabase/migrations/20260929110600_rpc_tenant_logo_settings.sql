-- D-11 Phase 14 : remplace api/tenant/update-logo.ts et update-settings.ts (écritures service_role sur tenants).
-- Owner seul (D-02 Phase 13).
--
-- Logo : le préfixe PUBLIC_SUPABASE_URL n'est pas lisible en SQL ; on valide donc la forme d'une URL Supabase
-- (projet hébergé ou stack locale) et le chemin assets/logos/<tenant_id>/. Défaut retenu (Q4) : le project ref
-- peut être épinglé sur demande.
-- La règle ne s'applique qu'à l'écriture : les logo_url déjà en base ne sont ni relus ni réécrits par cette
-- migration (voir 14-06-SUMMARY : 1 URL existante sur 2 ne respecte pas le motif, elle reste affichable telle quelle).
--
-- Paramètres : legal_form est toujours dans le SET, ce qui déclenche trg_sync_tenant_vat (UPDATE OF legal_form)
-- qui dérive is_vat_exempt et vat_rate. Aucune valeur de TVA n'est écrite ici.

CREATE FUNCTION public.update_tenant_logo(p_url text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tenant uuid := public.current_tenant_id(); v_url text := trim(coalesce(p_url, ''));
BEGIN
  IF v_tenant IS NULL OR public.current_tenant_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_url !~ ('^(https://[a-z0-9]{20}\.supabase\.co|http://(127\.0\.0\.1|localhost):54321)/storage/v1/object/public/assets/logos/'
               || v_tenant::text || '/[^/?#]+(\?t=[0-9]+)?$') THEN
    RAISE EXCEPTION 'URL de logo invalide' USING ERRCODE = '22023';
  END IF;
  UPDATE public.tenants SET logo_url = v_url WHERE id = v_tenant;
  RETURN v_url;
END $$;

CREATE FUNCTION public.update_tenant_settings(p_legal_form text, p_vat_number text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tenant uuid := public.current_tenant_id(); v_form public.legal_form_enum;
BEGIN
  IF v_tenant IS NULL OR public.current_tenant_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_legal_form IS NULL OR p_legal_form NOT IN (SELECT unnest(enum_range(NULL::public.legal_form_enum))::text) THEN
    RAISE EXCEPTION 'Forme juridique invalide' USING ERRCODE = '22023';
  END IF;
  v_form := p_legal_form::public.legal_form_enum;
  UPDATE public.tenants SET
    legal_form = v_form,
    vat_number = CASE WHEN v_form IN ('auto_entrepreneur','ei') THEN NULL ELSE nullif(trim(p_vat_number), '') END
  WHERE id = v_tenant;
END $$;

REVOKE EXECUTE ON FUNCTION public.update_tenant_logo(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_tenant_settings(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_logo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_settings(text, text) TO authenticated;

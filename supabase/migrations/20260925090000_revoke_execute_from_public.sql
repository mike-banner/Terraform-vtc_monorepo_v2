-- Correctif de 20260924120200_functions_hardening.sql.
--
-- Les REVOKE de cette migration ciblaient `anon, authenticated` et n'ont rien
-- changé : Postgres accorde EXECUTE au pseudo-rôle PUBLIC à la création d'une
-- fonction, et révoquer un rôle nommé n'enlève pas un droit hérité de PUBLIC.
-- Le linter continuait donc de signaler ces fonctions comme appelables par anon.
--
-- On révoque depuis PUBLIC, puis on re-accorde au seul rôle qui en a besoin.

-- Fonctions de trigger : aucun appelant direct. Le trigger s'exécute sous le
-- propriétaire de la fonction, il n'a pas besoin d'un GRANT.
REVOKE EXECUTE ON FUNCTION public.auto_create_financial_movement()   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_driver_verification_email() FROM PUBLIC;

-- Appelées uniquement en service_role (edge functions / createAdminClient).
REVOKE EXECUTE ON FUNCTION public.approve_onboarding_tx(uuid)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.initiate_refund(uuid, text)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_onboarding_tx(uuid)    TO service_role;
GRANT EXECUTE ON FUNCTION public.initiate_refund(uuid, text)    TO service_role;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid, int) TO service_role;

-- Appelée par l'edge function delete-tenant-account avec le JWT de l'utilisateur.
REVOKE EXECUTE ON FUNCTION public.delete_tenant_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_tenant_account() TO authenticated, service_role;

-- Dashboard tenant : garde authenticated, la fonction vérifie elle-même que le
-- tenant demandé est celui de l'appelant (20260924120100).
REVOKE EXECUTE ON FUNCTION public.get_fiscal_summary(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fiscal_summary(uuid, int) TO authenticated, service_role;

-- Restent volontairement ouvertes à anon, et donc en WARN au linter :
--   get_available_vehicles(uuid)        -> tunnels de réservation publics
--   get_public_tenant(text, uuid)       -> résolution d'hôte des sites vitrines
--   get_public_booking_result(text)     -> page /success

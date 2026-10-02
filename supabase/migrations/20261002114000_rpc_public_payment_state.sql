-- État d'un paiement pour la page /success : 'confirmed' (course créée), 'failed' (paiement
-- encaissé mais course non créée, le chauffeur est alerté) ou 'pending' (webhook pas encore traité).
CREATE OR REPLACE FUNCTION public.get_public_payment_state(p_session_id text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select case
    when exists (select 1 from public.stripe_events where session_id = p_session_id and booking_id is not null) then 'confirmed'
    when exists (select 1 from public.stripe_events where session_id = p_session_id and status = 'booking_failed') then 'failed'
    else 'pending'
  end;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_payment_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_payment_state(text) TO anon, authenticated;

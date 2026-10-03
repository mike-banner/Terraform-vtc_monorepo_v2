-- Phase 15 (R1, ADR-014) : horodatage de modification des courses. Ordonne les événements temps réel
-- et détecte les écritures concurrentes. Les lignes existantes prennent la date de la migration (pas de rattrapage,
-- qui ferait tirer tous les triggers de bookings).
ALTER TABLE public.bookings ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- clock_timestamp() et non now() (moddatetime) : now() est l'heure de début de transaction, deux écritures
  -- concurrentes pourraient recevoir un ordre inversé.
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Nom en trg_zz_ : Postgres exécute les triggers BEFORE d'un même moment par ordre alphabétique ; celui-ci passe
-- après tous les gardes (trg_prevent_*, trg_protect_*, trg_validate_*), donc son WHEN voit la ligne après qu'un garde
-- a éventuellement remis une colonne à sa valeur : updated_at n'avance pas pour une écriture neutralisée.
CREATE TRIGGER trg_zz_bookings_set_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION public.set_updated_at();

-- 20260927015049_onboarding_status_owner_guard.sql
--
-- Un utilisateur ne peut plus fixer lui-même le statut de son dossier d'onboarding.
--
-- onboarding_insert_own et onboarding_update_own ne contrôlaient que profile_id : un
-- utilisateur pouvait créer ou passer son dossier en `approved`. Aucun tenant n'était
-- créé pour autant (seule approve_onboarding_tx le fait), mais le statut mentait à
-- l'écran d'approbation, qui ne liste que les dossiers `pending`.
--
-- Le seul usage légitime, app signup.astro, écrit toujours status = 'pending', y compris
-- pour renvoyer un dossier rejeté. Un dossier approuvé n'est plus modifiable par son
-- propriétaire. Les policies *_platform restent inchangées.

DROP POLICY IF EXISTS onboarding_insert_own ON public.onboarding;
CREATE POLICY onboarding_insert_own ON public.onboarding
  FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND status = 'pending'
    AND validated_at IS NULL
  );

DROP POLICY IF EXISTS onboarding_update_own ON public.onboarding;
CREATE POLICY onboarding_update_own ON public.onboarding
  FOR UPDATE
  USING (
    profile_id = auth.uid()
    AND status IN ('pending', 'rejected')
  )
  WITH CHECK (
    profile_id = auth.uid()
    AND status = 'pending'
    AND validated_at IS NULL
  );

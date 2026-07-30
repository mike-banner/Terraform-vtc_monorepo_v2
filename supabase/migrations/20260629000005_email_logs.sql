-- email_logs : trace chaque envoi transactionnel (devis, facture)
CREATE TABLE IF NOT EXISTS email_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID        REFERENCES bookings(id) ON DELETE SET NULL,
  email_type      TEXT        NOT NULL CHECK (email_type IN ('devis', 'invoice')),
  recipient_email TEXT        NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT        NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  resend_id       TEXT
);

CREATE INDEX IF NOT EXISTS email_logs_booking_id_idx ON email_logs (booking_id);
CREATE INDEX IF NOT EXISTS email_logs_sent_at_idx    ON email_logs (sent_at DESC);

-- RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- tenant : lecture des logs liés à ses propres réservations
CREATE POLICY "tenant_select_email_logs" ON email_logs
  FOR SELECT
  USING (
    booking_id IN (
      SELECT b.id FROM bookings b
      JOIN profiles p ON p.tenant_id = b.current_tenant_id
      WHERE p.id = auth.uid()
    )
  );

-- superadmin : lecture globale
CREATE POLICY "superadmin_select_email_logs" ON email_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND platform_role = 'super_admin'
    )
  );

-- Le service_role contourne RLS (attribut bypassrls) — pas de policy INSERT nécessaire.
-- Supprimer la policy ouverte qui permettait à anon/authenticated d'insérer.
-- (Si cette policy existait déjà, on la supprime proprement.)
DROP POLICY IF EXISTS "service_role_insert_email_logs" ON email_logs;

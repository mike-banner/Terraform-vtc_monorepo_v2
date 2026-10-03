import { useTenantBookingsRealtime } from '@vtc/realtime';
import { supabase } from '@/lib/supabase/client';

// Îlot rendu dans le navigateur seulement (client:only) : le client Supabase ouvre un WebSocket,
// absent du rendu serveur sous Node < 22.
// Interrupteur par instance (décision du 03/10, faible volume, projet parfois mutualisé) : canal fermé par défaut,
// PUBLIC_REALTIME_ENABLED=true à la compilation pour l'ouvrir. Fermé : sondage 60 s et état en ligne/hors ligne seulement.
const CHANNEL_ENABLED = import.meta.env.PUBLIC_REALTIME_ENABLED === 'true';
export function RealtimeSync({ tenantId }: { tenantId: string }) {
  useTenantBookingsRealtime(supabase, CHANNEL_ENABLED ? tenantId : null);
  return null;
}


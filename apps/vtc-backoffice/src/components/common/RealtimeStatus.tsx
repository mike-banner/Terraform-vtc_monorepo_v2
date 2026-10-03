import { SyncIndicator, useTenantBookingsRealtime } from '@vtc/realtime';
import { supabase } from '@/lib/supabase/client';

// Un seul îlot ouvre le canal du tenant (ADR-014) ; il ne rend rien.
// Interrupteur par instance (décision du 03/10, faible volume, projet parfois mutualisé) : canal fermé par défaut,
// PUBLIC_REALTIME_ENABLED=true à la compilation pour l'ouvrir. Fermé : sondage 60 s et état en ligne/hors ligne seulement.
const CHANNEL_ENABLED = import.meta.env.PUBLIC_REALTIME_ENABLED === 'true';
export function RealtimeSync({ tenantId }: { tenantId: string }) {
  useTenantBookingsRealtime(supabase, CHANNEL_ENABLED ? tenantId : null);
  return null;
}

const DOT = 'inline-block h-2 w-2 rounded-full';

// Pastille d'état : lit le store partagé, peut être posée plusieurs fois sans ouvrir de canal.
export function SyncPill({ compact = false }: { compact?: boolean }) {
  return (
    <SyncIndicator
      className="inline-flex items-center gap-1.5 flex-shrink-0"
      dotClassName={{
        online: `${DOT} bg-primary`,
        reconnecting: `${DOT} bg-muted-foreground animate-pulse`,
        offline: `${DOT} bg-destructive`,
      }}
      labelClassName={compact ? 'sr-only' : 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground'}
    />
  );
}

import { useEffect } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getQueryClient, BOOKINGS_KEYS, DERIVED_KEYS } from './query-client';
import { syncStore, useConnectionState } from './connection';
import { isBookingEvent, shouldApply } from './booking-event.mjs';
import { needsResync } from './sync-state.mjs';
import type { ChannelStatus, SyncSnapshot } from './sync-state.mjs';

type RealtimeHost = Pick<SupabaseClient, 'channel' | 'removeChannel' | 'realtime'>;
type CachedRow = { id: string; updated_at: string };

// Abonnement au canal privé du tenant (ADR-014). Un événement = invalidation (le payload n'a que 5 champs) ;
// ignoré si le cache est déjà au moins aussi récent (D-06). Renvoie l'état de connexion (D-07).
export function useTenantBookingsRealtime(client: RealtimeHost, tenantId: string | null): SyncSnapshot {
  useEffect(() => {
    if (!tenantId) return;
    const qc = getQueryClient();
    let channel: RealtimeChannel | undefined;
    let cancelled = false;
    syncStore.setChannelStatus('joining');
    (async () => {
      try {
        // Obligatoire : avec les cookies @supabase/ssr, supabase-js ne pousse pas le jeton au socket (INITIAL_SESSION).
        await client.realtime.setAuth();
      } catch {
        // Pas de session : pas d'abonnement, la pastille reste sur « Reconnexion… ».
        if (!cancelled) syncStore.setChannelStatus('CHANNEL_ERROR');
        return;
      }
      if (cancelled) return;
      channel = client
        .channel(`tenant:${tenantId}:bookings`, { config: { private: true } })
        .on('broadcast', { event: 'booking_changed' }, ({ payload }) => {
          if (!isBookingEvent(payload)) return;
          syncStore.markEvent();
          // Version en cache : le détail s'il existe, sinon la première liste qui contient la course.
          const cached = qc.getQueryData<CachedRow>(BOOKINGS_KEYS.detail(payload.id))
            ?? qc.getQueriesData<CachedRow[]>({ queryKey: BOOKINGS_KEYS.lists })
                 .flatMap(([, rows]) => (Array.isArray(rows) ? rows : []))
                 .find((row) => row.id === payload.id);
          if (!shouldApply(cached?.updated_at, payload.updated_at)) return;
          void qc.invalidateQueries({ queryKey: BOOKINGS_KEYS.lists });
          void qc.invalidateQueries({ queryKey: BOOKINGS_KEYS.detail(payload.id) });
          // Écrans dérivés : un changement de course bouge le grand livre et les compteurs.
          // Clés sans abonné tant que la phase 16 n'a pas converti ces pages : invalidation sans effet, aucun coût.
          for (const queryKey of DERIVED_KEYS) void qc.invalidateQueries({ queryKey });
        })
        .subscribe((status) => {
          syncStore.setChannelStatus(status as ChannelStatus);
          if (needsResync(status as ChannelStatus)) {
            void qc.invalidateQueries({ queryKey: BOOKINGS_KEYS.all }); // listes ET détails (R5)
            for (const queryKey of DERIVED_KEYS) void qc.invalidateQueries({ queryKey });
          }
        });
    })();
    return () => {
      cancelled = true;
      if (channel) void client.removeChannel(channel); // Piège 2 : pas de canal en double (StrictMode, navigation)
      syncStore.setChannelStatus('idle');
    };
  }, [client, tenantId]);
  return useConnectionState();
}

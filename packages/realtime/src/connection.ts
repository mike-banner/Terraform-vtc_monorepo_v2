import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { createSyncStore } from './sync-state.mjs';
import type { SyncSnapshot } from './sync-state.mjs';

// Source « en ligne » = onlineManager de TanStack : ses écouteurs online/offline se remplacent par
// onlineManager.setEventListener (service worker, phase 17, D-05). Idem focusManager pour visibilitychange.
export const syncStore = createSyncStore({
  isOnline: () => onlineManager.isOnline(),
  subscribe: (listener) => onlineManager.subscribe(listener),
});

// État de connexion consommable partout (D-07) : la phase 16 désactive les écritures quand state !== 'online'.
export function useConnectionState(): SyncSnapshot {
  return useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot, syncStore.getSnapshot);
}

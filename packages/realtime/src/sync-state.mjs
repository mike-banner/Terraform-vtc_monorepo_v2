// État de connexion du canal temps réel (D-07) : online | reconnecting | offline. Pur : la source « en ligne »
// est injectée (onlineManager de TanStack dans le navigateur, autre source dans un service worker, D-05).
export function toConnectionState(channelStatus, online) {
  if (!online) return 'offline';
  return channelStatus === 'SUBSCRIBED' || channelStatus === 'idle' ? 'online' : 'reconnecting';
}

// Chaque SUBSCRIBED (première jointure ou reconnexion) déclenche une resynchronisation complète (R5).
export function needsResync(channelStatus) {
  return channelStatus === 'SUBSCRIBED';
}

export function createSyncStore(source) {
  let channelStatus = 'idle';
  let online = source.isOnline();
  let lastEventAt = null;
  let snapshot = { state: toConnectionState(channelStatus, online), lastEventAt };
  const listeners = new Set();
  let unbind = null;
  const emit = () => {
    const state = toConnectionState(channelStatus, online);
    if (state !== snapshot.state || lastEventAt !== snapshot.lastEventAt) snapshot = { state, lastEventAt };
    listeners.forEach((l) => l());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      if (!unbind) {
        online = source.isOnline();
        unbind = source.subscribe((value) => { online = value; emit(); });
        emit();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && unbind) { unbind(); unbind = null; }
      };
    },
    setChannelStatus(status) { channelStatus = status; emit(); },
    markEvent(at = Date.now()) { lastEventAt = at; emit(); },
  };
}

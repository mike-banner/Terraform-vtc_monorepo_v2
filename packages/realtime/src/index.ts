// @vtc/realtime : socle temps réel partagé (ADR-014). Cœur pur dans *.mjs (sans DOM, D-05) ; hooks et pastille ici.
export { getQueryClient, BOOKINGS_KEYS } from './query-client';
export { syncStore, useConnectionState, useConnectionState as useSyncStatus } from './connection';
export { useTenantBookingsRealtime } from './use-tenant-bookings-realtime';
export { SyncIndicator, CONNECTION_LABELS } from './SyncIndicator';
export { shouldApply, isBookingEvent } from './booking-event.mjs';
export { toConnectionState, needsResync } from './sync-state.mjs';
export type { BookingEvent } from './booking-event.mjs';
export type { ConnectionState, SyncSnapshot, ChannelStatus } from './sync-state.mjs';
export { QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';

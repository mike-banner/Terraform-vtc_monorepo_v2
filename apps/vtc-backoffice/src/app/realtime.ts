// Seul point d'entrée de @vtc/realtime pour la coque React (contrat phase 15, ADR-014).
export {
  getQueryClient,
  BOOKINGS_KEYS,
  QueryClientProvider,
  useTenantBookingsRealtime,
  useSyncStatus,
  SyncIndicator,
} from "@vtc/realtime";

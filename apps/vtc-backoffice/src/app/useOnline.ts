import { useSyncStatus } from "./realtime";

export const OFFLINE_MESSAGE = "Hors ligne : action indisponible, réessayez une fois la connexion revenue.";

/** État de connexion (phase 15) et droit d'écrire : les boutons d'écriture se désactivent hors ligne (D-11). */
export function useOnline() {
  const { state } = useSyncStatus();
  return { status: state, canWrite: state !== "offline", offlineMessage: OFFLINE_MESSAGE };
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { terrainTransition } from "@/features/missions/api";
import { useDialog, useToast } from "@/ui";
import {
  acceptPaid, acceptQuote, cancelBooking, createManualBooking, declineRequest, generateInvoice, issueCreditNote, markAddressVerified, markNoShow,
  retryRefund, sendQuote, updateBookingDetails, updateInstructions,
} from "./api";
import { bookingKeys } from "./keys";
import type { NewBookingValues, UpdatePayload } from "./schemas";

type WithId = { bookingId: string };

/** Mutation de la fiche : aucune mise à jour optimiste (le serveur décide) ; succès = relecture des clés ; erreur = toast. */
function useAction<V extends WithId, R>(fn: (v: V) => Promise<R>, ok?: string | ((r: R) => string | undefined)) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r, v) => {
      await Promise.all([qc.invalidateQueries({ queryKey: bookingKeys.all }), qc.invalidateQueries({ queryKey: bookingKeys.detail(v.bookingId) })]);
      const message = typeof ok === "function" ? ok(r) : ok;
      if (message) toast.show({ message });
    },
    onError: (e) => toast.show({ tone: "error", message: e instanceof Error ? e.message : "Une erreur est survenue." }),
  });
}

export const REFUND_STATUS_MSG: Record<string, string> = {
  succeeded: "Remboursement envoyé",
  pending: "Remboursement en cours",
  failed: "Échec du remboursement : relancez-le",
};
const refundMessage = (r: { refund_status?: string | null }) => (r.refund_status ? (REFUND_STATUS_MSG[r.refund_status] ?? r.refund_status) : "Course annulée.");

export const useUpdateInstructions = () => useAction((v: WithId & { text: string }) => updateInstructions(v.bookingId, v.text), "Instructions enregistrées.");
export const useMarkAddressVerified = () => useAction((v: WithId) => markAddressVerified(v.bookingId), "Adresse marquée comme vérifiée.");
export const useSendQuote = () => useAction((v: WithId) => sendQuote(v.bookingId), "Devis envoyé.");
export const useDeclineRequest = () => useAction((v: WithId & { reason: string }) => declineRequest(v.bookingId, v.reason), "Demande refusée.");
export const useAcceptPaid = () => useAction((v: WithId & { driverId: string }) => acceptPaid(v.bookingId, v.driverId), "Course acceptée.");
export const useTerrainTransition = () =>
  useAction((v: WithId & { action: "en_route" | "completed"; correctedAt?: string }) => terrainTransition(v));
export const useGenerateInvoice = () => useAction((v: WithId) => generateInvoice(v.bookingId));
export const useIssueCreditNote = () => useAction((v: WithId & { amount: number; reason: string }) => issueCreditNote(v), (r) => r.message ?? "Avoir émis.");
export const useCancelBooking = () => useAction((v: WithId & { case: string; rate?: number; note: string }) => cancelBooking(v), refundMessage);
export const useMarkNoShow = () => useAction((v: WithId & { reason: string }) => markNoShow(v.bookingId, v.reason), "Course marquée non réalisée.");
export const useRetryRefund = () => useAction((v: WithId) => retryRefund(v.bookingId), refundMessage);

/**
 * Acceptation d'un devis : confirmation si un conflit est déjà connu, seconde confirmation si le serveur en découvre un
 * (« Conflit de créneau »), puis rappel avec p_force. Renvoie false si l'utilisateur renonce.
 */
export function useAcceptQuote() {
  const dialog = useDialog();
  return useAction(
    async (v: WithId & { conflicts: string[] }): Promise<boolean> => {
      if (v.conflicts.length && !(await dialog.confirm({ title: "Conflit de créneau", message: `Course en conflit avec :\n${v.conflicts.join("\n")}\n\nValider quand même ?`, confirmLabel: "Valider quand même" }))) return false;
      try {
        await acceptQuote(v.bookingId, v.conflicts.length > 0);
      } catch (e) {
        const message = e instanceof Error ? e.message : "";
        if (v.conflicts.length || !message.startsWith("Conflit de créneau")) throw e;
        if (!(await dialog.confirm({ title: "Valider quand même ?", message, confirmLabel: "Valider quand même" }))) return false;
        await acceptQuote(v.bookingId, true);
      }
      return true;
    },
    (done) => (done ? "Devis accepté." : undefined),
  );
}

/** Création : relecture des listes ; l'appelant ouvre la nouvelle fiche. Erreurs affichées par le formulaire. */
export function useCreateManualBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: NewBookingValues) => createManualBooking(v),
    onSuccess: () => qc.invalidateQueries({ queryKey: bookingKeys.all }),
  });
}

export const useUpdateBookingDetails = () => useAction((v: WithId & { payload: UpdatePayload }) => updateBookingDetails(v.bookingId, v.payload), "Course modifiée.");

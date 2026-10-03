import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useProfile } from "@/app/auth/useSession";
import { cancellationPreview, creditNoteRemaining, getBooking, getConflicts, getMyDriverId, listBookings, listCreditNotes, searchBookings } from "./api";
import { bookingKeys } from "./keys";
import type { BookingFilters } from "./types";

export function useBookings(filters: BookingFilters) {
  const { profile } = useProfile();
  return useQuery({
    queryKey: bookingKeys.list(filters),
    enabled: !!profile?.tenantId,
    queryFn: () => listBookings(filters, profile!),
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchInterval: 60_000,
  });
}

/** `q` déjà temporisé par l'appelant ; moins de 2 caractères utiles : aucune requête. */
export function useBookingSearch(q: string) {
  const { profile } = useProfile();
  return useQuery({
    queryKey: bookingKeys.search(q),
    enabled: !!profile?.tenantId && q.trim().length >= 2,
    queryFn: () => searchBookings(q, profile!),
    staleTime: 0,
  });
}

/** Lecture du cache partagé : la fiche suit les évènements temps réel sans copie figée. */
export function useBooking(id: string | null) {
  return useQuery({
    queryKey: bookingKeys.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => getBooking(id!),
    staleTime: 0,
  });
}

export function useConflicts(ids: string[]) {
  const { profile } = useProfile();
  const canSee = profile?.role === "owner" || profile?.role === "manager";
  return useQuery({
    queryKey: [...bookingKeys.all, "conflicts", ids],
    enabled: canSee && ids.length > 0,
    queryFn: () => getConflicts(ids),
    staleTime: 0,
  });
}

export function useMyDriverId() {
  const { profile } = useProfile();
  return useQuery({ queryKey: ["session", "driver-id", profile?.userId], enabled: !!profile?.tenantId, queryFn: () => getMyDriverId(profile!), staleTime: 60_000 });
}

/** Aperçu d'annulation du serveur ; `rate` = fraction. Jamais mis en cache (staleTime 0). */
export function useCancellationPreview(id: string, rate?: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...bookingKeys.detail(id), "cancel-preview", rate ?? null],
    queryFn: () => cancellationPreview(id, rate),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

export function useCreditNotes(id: string, enabled: boolean) {
  return useQuery({ queryKey: [...bookingKeys.detail(id), "credit-notes"], enabled, queryFn: () => listCreditNotes(id), staleTime: 0 });
}

export function useCreditNoteRemaining(id: string, enabled: boolean) {
  return useQuery({ queryKey: [...bookingKeys.detail(id), "credit-remaining"], enabled, queryFn: () => creditNoteRemaining(id), staleTime: 0 });
}

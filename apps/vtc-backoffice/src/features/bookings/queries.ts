import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useProfile } from "@/app/auth/useSession";
import { getBooking, getConflicts, listBookings, searchBookings } from "./api";
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

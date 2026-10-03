import { useQuery } from "@tanstack/react-query";
import type { BookingRow } from "@/features/bookings/types";
import { useProfile } from "@/app/auth/useSession";
import { BOOKINGS_KEYS } from "@/app/realtime";
import { getKpi, getOngoing, getOverdue, getRating, getStripeInfo, getToValidate, getUpcoming } from "./api";

// Listes sous ["bookings","list"] : le temps réel les invalide à chaque évènement ; ["dashboard"] est une clé dérivée, invalidée aussi.
const listKey = (name: string, tenantId: string | null | undefined) => [...BOOKINGS_KEYS.lists, "dashboard", name, tenantId] as const;

function useTenantList(name: string, fn: (tenantId: string) => Promise<BookingRow[]>) {
  const { profile } = useProfile();
  return useQuery({ queryKey: listKey(name, profile?.tenantId), enabled: !!profile?.tenantId, queryFn: () => fn(profile!.tenantId!), staleTime: 0 });
}

export const useOngoing = () => useTenantList("ongoing", getOngoing);
export const useOverdue = () => useTenantList("overdue", getOverdue);
export const useUpcoming = () => useTenantList("upcoming", getUpcoming);
export const useToValidate = () => useTenantList("to-validate", getToValidate);

export function useKpi() {
  const { profile } = useProfile();
  return useQuery({ queryKey: ["dashboard", "kpi", profile?.tenantId], enabled: !!profile?.tenantId, queryFn: () => getKpi(profile!.tenantId!), staleTime: 0 });
}

export function useRating() {
  const { profile } = useProfile();
  return useQuery({
    queryKey: ["dashboard", "rating", profile?.tenantId],
    enabled: !!profile?.tenantId,
    queryFn: () => getRating(profile!.tenantId!, profile!.userId),
    staleTime: 60_000,
  });
}

export function useStripeInfo() {
  const { profile } = useProfile();
  return useQuery({ queryKey: ["dashboard", "stripe", profile?.tenantId], enabled: !!profile?.tenantId, queryFn: () => getStripeInfo(profile!.tenantId!), staleTime: 60_000, retry: false });
}

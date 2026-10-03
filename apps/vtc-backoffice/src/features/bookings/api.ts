import { rpc } from "@/lib/app-error";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/app/auth/useSession";
import { buildSearchFilter, sanitizeSearch } from "./search";
import { BOOKING_COLUMNS, PAGE_SIZE, type BookingFilters, type BookingRow, type Conflict } from "./types";

// Annulées listées à part (onglet « Annulées »), sauf celles qui demandent une action (remboursement en cours ou échoué).
const ACTION_STATUSES = ["cancelled_pending_refund", "refund_failed"];
const CANCELLED_STATUSES = ["cancelled", "cancelled_no_refund", "cancelled_refunded", "deprecated_refunded", "no_show"];
const NO_COURSE = "00000000-0000-0000-0000-000000000000";

/** Un chauffeur ne voit que ses courses (confort : la RLS fait foi) ; null = pas de fiche chauffeur. */
async function driverScope(profile: Profile): Promise<{ driverId: string | null } | null> {
  if (profile.role !== "driver") return null;
  const { data } = await supabase.from("drivers").select("id").eq("user_id", profile.userId).eq("tenant_id", profile.tenantId!).limit(1).maybeSingle();
  return { driverId: data?.id ?? null };
}

export async function listBookings(f: BookingFilters, profile: Profile): Promise<{ rows: BookingRow[]; count: number }> {
  let q = supabase.from("bookings").select(BOOKING_COLUMNS, { count: "exact" }).eq("current_tenant_id", profile.tenantId!);

  if (f.status === "cancelled") q = q.in("status", [...CANCELLED_STATUSES, ...ACTION_STATUSES] as never[]);
  else {
    if (f.status !== "all") q = q.eq("mission_status", f.status);
    q = q.not("status", "in", `(${CANCELLED_STATUSES.join(",")})`);
  }
  if (f.type !== "all") q = q.eq("booking_type", f.type);

  const scope = await driverScope(profile);
  if (scope) q = q.eq(scope.driverId ? "driver_id" : "id", scope.driverId ?? NO_COURSE);

  const from = (f.page - 1) * PAGE_SIZE;
  const { data, error, count } = await q.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as BookingRow[], count: count ?? 0 };
}

export async function searchBookings(raw: string, profile: Profile): Promise<BookingRow[]> {
  const term = sanitizeSearch(raw);
  if (!term) return [];
  const scope = await driverScope(profile);
  if (scope && !scope.driverId) return [];

  // .or() ne traverse pas la relation embarquée : pré-recherche des clients (nom, prénom, téléphone).
  const { data: custs } = await supabase
    .from("customers")
    .select("id")
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%`);

  let q = supabase.from("bookings").select(BOOKING_COLUMNS).eq("current_tenant_id", profile.tenantId!);
  if (scope?.driverId) q = q.eq("driver_id", scope.driverId);
  const { data, error } = await q
    .or(buildSearchFilter(term, (custs ?? []).map((c) => c.id)))
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BookingRow[];
}

export async function getBooking(id: string): Promise<BookingRow | null> {
  const { data, error } = await supabase.from("bookings").select(BOOKING_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as BookingRow | null) ?? null;
}

/** Conflits de créneau (owner/manager) ; une erreur ne casse jamais l'écran. */
export async function getConflicts(ids: string[]): Promise<Conflict[]> {
  try {
    const all = await rpc<Conflict[] | null>("booking_conflicts", {});
    const wanted = new Set(ids);
    return (all ?? []).filter((c) => wanted.has(c.booking_id));
  } catch {
    return [];
  }
}

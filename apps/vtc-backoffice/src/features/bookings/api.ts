import { invokeFn, rpc } from "@/lib/app-error";
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

/** Fiche chauffeur de l'utilisateur connecté (null : aucun profil chauffeur). */
export async function getMyDriverId(profile: Profile): Promise<string | null> {
  const { data } = await supabase.from("drivers").select("id").eq("user_id", profile.userId).eq("tenant_id", profile.tenantId!).limit(1).maybeSingle();
  return data?.id ?? null;
}

// Actions de la fiche : RPC et Edge Functions existantes, appelées telles quelles (le serveur reste l'arbitre).
export const updateInstructions = (id: string, text: string) =>
  rpc<string>("update_booking_instructions", { p_booking_id: id, p_instructions: text });
export const markAddressVerified = (id: string) => rpc<string>("mark_address_verified", { p_booking_id: id });
export const acceptQuote = (id: string, force: boolean) =>
  rpc<string>("accept_quote_manually", { p_booking_id: id, ...(force ? { p_force: true } : {}) });
export const declineRequest = (id: string, reason: string) => rpc<string>("decline_booking_request", { p_booking_id: id, p_reason: reason });
export const acceptPaid = (id: string, driverId: string) => rpc<string>("accept_paid_booking", { p_booking_id: id, p_driver_id: driverId });
export const sendQuote = (id: string) => invokeFn<{ invoice_url?: string }>("generate-devis", { booking_id: id });
export const generateInvoice = (id: string) =>
  invokeFn<{ invoice_url?: string; already_generated?: boolean }>("generate-invoice", { booking_id: id });

export type CancelPreviewRow = { case_code: string; rate: number | null; amount: number | null; paid: boolean };
/** Taux et montants calculés par le serveur ; `rate` (fraction) optionnel pour les cas à taux libre. */
export const cancellationPreview = async (id: string, rate?: number) =>
  ((await rpc<CancelPreviewRow[] | null>("cancellation_preview", rate === undefined ? { p_booking_id: id } : { p_booking_id: id, p_rate: rate })) ?? []);
export const cancelBooking = (p: { bookingId: string; case: string; rate?: number; note: string }) =>
  invokeFn<{ refund_status?: string | null }>("cancel-booking", { booking_id: p.bookingId, case: p.case, rate: p.rate, note: p.note });
export const retryRefund = (id: string) => invokeFn<{ refund_status?: string | null }>("cancel-booking", { booking_id: id, retry: true });
export const markNoShow = (id: string, reason: string) => rpc<string>("mark_booking_no_show", { p_booking_id: id, p_reason: reason });

export type CreditNote = { id: string; number: string; amount_ttc: number; issued_at: string };
export const creditNoteRemaining = (id: string) => rpc<number | null>("credit_note_remaining", { p_booking_id: id });
export async function listCreditNotes(id: string): Promise<CreditNote[]> {
  const { data, error } = await supabase.from("credit_notes").select("id, number, amount_ttc, issued_at").eq("booking_id", id).order("issued_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as CreditNote[];
}
type CreditNoteReply = { url?: string; message?: string };
export const issueCreditNote = (p: { bookingId: string; amount: number; reason: string }) =>
  invokeFn<CreditNoteReply>("generate-credit-note", { booking_id: p.bookingId, amount: p.amount, reason: p.reason });
export const creditNotePdf = (creditNoteId: string) => invokeFn<CreditNoteReply>("generate-credit-note", { credit_note_id: creditNoteId });

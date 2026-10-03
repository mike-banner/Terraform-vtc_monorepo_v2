import { invokeFn } from "@/lib/app-error";
import { supabase } from "@/lib/supabase/client";
import { BOOKING_COLUMNS, type BookingRow } from "@/features/bookings/types";

const CLOSED = "(cancelled,cancelled_no_refund,cancelled_pending_refund,cancelled_refunded,no_show)";
const DAY = 24 * 60 * 60_000;

const base = (tenantId: string) => supabase.from("bookings").select(BOOKING_COLUMNS).eq("current_tenant_id", tenantId);
const rows = (data: unknown) => (data ?? []) as BookingRow[];

/** Mission démarrée dans les dernières 24 h (ignore les missions bloquées en test). */
export async function getOngoing(tenantId: string): Promise<BookingRow[]> {
  const { data, error } = await base(tenantId)
    .eq("mission_status", "in_progress")
    .gte("pickup_time", new Date(Date.now() - DAY).toISOString())
    .limit(1);
  if (error) throw new Error(error.message);
  return rows(data);
}

/** Course non démarrée dont l'heure est dépassée de plus de 5 minutes. */
export async function getOverdue(tenantId: string): Promise<BookingRow[]> {
  const { data, error } = await base(tenantId)
    .eq("mission_status", "not_started")
    .lt("pickup_time", new Date(Date.now() - 5 * 60_000).toISOString())
    .not("status", "in", CLOSED)
    .order("pickup_time", { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  return rows(data);
}

export async function getUpcoming(tenantId: string): Promise<BookingRow[]> {
  const { data, error } = await base(tenantId)
    .gte("pickup_time", new Date().toISOString())
    .not("mission_status", "in", "(in_progress,completed)")
    .not("status", "in", CLOSED)
    .order("pickup_time", { ascending: true })
    .limit(3);
  if (error) throw new Error(error.message);
  return rows(data);
}

/** Courses en attente de validation. */
export async function getToValidate(tenantId: string): Promise<BookingRow[]> {
  const { data, error } = await base(tenantId).eq("status", "pending").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return rows(data);
}

/** Chiffres de la vue tenant_dashboard_kpi (calculés par le serveur) et nombre total de courses. */
export async function getKpi(tenantId: string): Promise<{ monthlyNetRevenue: number; totalCount: number }> {
  const [kpi, count] = await Promise.all([
    supabase.from("tenant_dashboard_kpi").select("monthly_net_revenue").eq("tenant_id", tenantId).limit(1).maybeSingle(),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("current_tenant_id", tenantId),
  ]);
  if (kpi.error) throw new Error(kpi.error.message);
  if (count.error) throw new Error(count.error.message);
  return { monthlyNetRevenue: kpi.data?.monthly_net_revenue ?? 0, totalCount: count.count ?? 0 };
}

/** Note moyenne du chauffeur connecté (5,0 sans note, comme l'ancien écran). */
export async function getRating(tenantId: string, userId: string): Promise<number> {
  const { data: driver } = await supabase.from("drivers").select("id").eq("user_id", userId).eq("tenant_id", tenantId).limit(1).maybeSingle();
  if (!driver) return 5;
  const { data, error } = await supabase.from("driver_ratings").select("average_rating").eq("driver_id", driver.id).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.average_rating || 5;
}

export type StripeStatus = { type: "onboarding" | "dashboard"; url: string };

/** Stripe reste la source de vérité : la fonction est appelée à chaque lecture. */
export async function getStripeInfo(tenantId: string): Promise<{ accountMissing: boolean; status: StripeStatus }> {
  const { data: tenant, error } = await supabase.from("tenants").select("stripe_account_id").eq("id", tenantId).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!tenant) throw new Error("Tenant non trouvé.");
  const status = await invokeFn<StripeStatus>("create-stripe-onboarding", { tenant_id: tenantId });
  return { accountMissing: !tenant.stripe_account_id, status };
}

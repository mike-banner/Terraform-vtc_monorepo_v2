import { z } from "zod";

/** Plafond de saisie manuelle : celui de create_manual_booking / update_booking_details (le serveur fait foi). */
export const MAX_TOTAL = 99999;
export const MAX_HOURS = 8760;

export const PAYMENT_LABELS = { card: "Carte (sur place)", cash: "Espèces" } as const;

// Les champs numériques restent des chaînes dans le formulaire ; "" = non renseigné.
const toNum = (s: string | undefined): number => (s == null || s.trim() === "" ? NaN : Number(s.replace(",", ".")));
const isSet = (s: string | undefined) => s != null && s.trim() !== "";

const amount = (s: string | undefined, ctx: z.RefinementCtx, path: string) => {
  if (!isSet(s)) return;
  const n = toNum(s);
  if (Number.isNaN(n) || n <= 0) ctx.addIssue({ code: "custom", path: [path], message: "Le montant doit être supérieur à 0." });
  else if (n > MAX_TOTAL) ctx.addIssue({ code: "custom", path: [path], message: `Le montant ne peut pas dépasser ${MAX_TOTAL.toLocaleString("fr-FR")} €.` });
};

export const newBookingSchema = z
  .object({
    booking_type: z.enum(["transfer", "hourly"], { message: "Type de course invalide." }),
    mads_mode: z.enum(["hour", "km"]),
    vehicle_id: z.string().min(1, "Choisissez un véhicule."),
    fixed_route_id: z.string(),
    client_name: z.string().trim().min(1, "Le nom du client est obligatoire."),
    client_email: z.string().trim().regex(/^[^@\s]+@[^@\s]+$/, "Adresse e-mail invalide."),
    pickup: z.string().trim().min(1, "L'adresse de départ est obligatoire."),
    dropoff: z.string(),
    pickup_time: z.string().min(1, "La date et l'heure sont obligatoires."),
    passenger_count: z.string(),
    luggage_count: z.string(),
    instructions: z.string().max(500, "500 caractères au maximum."),
    distance_km: z.string(),
    duration_hours: z.string(),
    manual_total: z.string(),
    payment_mode: z.enum(["card", "cash"], { message: "Mode de paiement invalide." }),
  })
  .superRefine((v, ctx) => {
    const add = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.booking_type === "transfer" && v.dropoff.trim() === "") add("dropoff", "L'adresse d'arrivée est obligatoire.");
    if (v.booking_type === "hourly") {
      if (v.mads_mode === "hour") {
        const h = toNum(v.duration_hours);
        if (!(h > 0)) add("duration_hours", "Indiquez une durée supérieure à 0.");
        else if (h > MAX_HOURS) add("duration_hours", `La durée ne peut pas dépasser ${MAX_HOURS} h.`);
      } else if (!(toNum(v.distance_km) > 0)) add("distance_km", "Indiquez une distance supérieure à 0.");
    }
    if (v.pickup_time && !(new Date(v.pickup_time).getTime() > Date.now())) add("pickup_time", "La date doit être dans le futur.");
    const p = toNum(v.passenger_count);
    if (!(Number.isInteger(p) && p >= 1)) add("passenger_count", "Au moins 1 passager.");
    const l = toNum(v.luggage_count);
    if (!(Number.isInteger(l) && l >= 0)) add("luggage_count", "Nombre de bagages invalide.");
    amount(v.manual_total, ctx, "manual_total");
  });

export type NewBookingValues = z.infer<typeof newBookingSchema>;

export const editBookingSchema = z
  .object({
    booking_type: z.enum(["transfer", "hourly"]),
    pickup_time: z.string().min(1, "La date et l'heure sont obligatoires."),
    pickup_address: z.string().trim().min(1, "L'adresse de départ est obligatoire."),
    dropoff_address: z.string(),
    duration_hours: z.string(),
    manual_total: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.booking_type === "hourly") {
      const h = toNum(v.duration_hours);
      if (!(h > 0)) ctx.addIssue({ code: "custom", path: ["duration_hours"], message: "Indiquez une durée supérieure à 0." });
      else if (h > MAX_HOURS) ctx.addIssue({ code: "custom", path: ["duration_hours"], message: `La durée ne peut pas dépasser ${MAX_HOURS} h.` });
    }
    amount(v.manual_total, ctx, "manual_total");
  });

export type EditBookingValues = z.infer<typeof editBookingSchema>;

export type UpdatePayload = {
  pickup_time: string;
  pickup_address: string;
  dropoff_address?: string;
  duration_hours?: number;
  manual_total?: number;
};

/** manual_total n'est envoyé que s'il diffère du montant actuel : sinon la course garde son mode de prix. */
export function buildUpdatePayload(initial: { total_amount: number | string | null }, v: EditBookingValues): UpdatePayload {
  const payload: UpdatePayload = { pickup_time: new Date(v.pickup_time).toISOString(), pickup_address: v.pickup_address.trim() };
  if (v.booking_type === "hourly") payload.duration_hours = toNum(v.duration_hours);
  else payload.dropoff_address = v.dropoff_address.trim();
  if (isSet(v.manual_total) && toNum(v.manual_total) !== Number(initial.total_amount)) payload.manual_total = toNum(v.manual_total);
  return payload;
}

/** Valeur datetime-local (heure locale du navigateur) d'un horodatage ISO. */
export const toLocalInput = (iso: string): string => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export type FixedRoute = { id: string; price: number; vehicle_category: string; pickup_zone_id: string | null; dropoff_zone_id: string | null };

/**
 * Forfait de la catégorie du véhicule pour les mêmes zones que le forfait choisi (sinon le forfait choisi).
 * Sélection d'une ligne seulement : le prix reste celui de la RPC quote_booking_estimate.
 */
export function matchFixedRoute(routes: FixedRoute[], selectedId: string, vehicleCategory: string): FixedRoute | null {
  const sel = routes.find((r) => r.id === selectedId);
  if (!sel) return null;
  return (
    routes.find(
      (r) => r.pickup_zone_id === sel.pickup_zone_id && r.dropoff_zone_id === sel.dropoff_zone_id && r.vehicle_category.toLowerCase() === vehicleCategory.toLowerCase(),
    ) ?? sel
  );
}

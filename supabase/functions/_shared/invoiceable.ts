// Décide si une course peut être facturée directement, ou si son prix doit d'abord
// être validé à la main.
//
// Le calcul d'un transfert vaut `base_price + price_per_km * distance_km`
// (voir apps/vtc-backoffice/src/lib/pricing.ts). Tant qu'aucune API de distance
// n'est câblée, un `distance_km` saisi ou estimé n'est pas une donnée vérifiée :
// facturer dessus, c'est émettre une pièce comptable sur un montant non fiable.
//
// Logique pure, sans dépendance — testée par `deno test invoiceable.test.ts`.

export type PricingMode = "direct" | "manual";
export type BookingType = "transfer" | "hourly";

export interface InvoiceableInput {
  pricing_mode: PricingMode;
  booking_type: BookingType;
  distance_km: number | null;
}

export type Invoiceability =
  | { invoiceable: true; basis: "manual" | "hourly" | "flat_rate" }
  | { invoiceable: false; reason: string };

export function checkInvoiceable(booking: InvoiceableInput): Invoiceability {
  // Montant saisi par un humain : c'est la validation elle-même.
  if (booking.pricing_mode === "manual") {
    return { invoiceable: true, basis: "manual" };
  }

  // Mise à disposition : base + heures. La durée est contractuelle, pas estimée.
  if (booking.booking_type === "hourly") {
    return { invoiceable: true, basis: "hourly" };
  }

  // Transfert sans distance : le total retombe sur max(base_price, minimum_fare),
  // soit un forfait fixe. Aucune distance n'entre dans le montant.
  const distance = Number(booking.distance_km ?? 0);
  if (!Number.isFinite(distance) || distance <= 0) {
    return { invoiceable: true, basis: "flat_rate" };
  }

  return {
    invoiceable: false,
    reason:
      "Prix calculé au kilomètre (" + distance + " km) sans distance vérifiée : " +
      "validez le montant depuis le backoffice (la course passe en tarification " +
      "manuelle) avant d'émettre la facture.",
  };
}

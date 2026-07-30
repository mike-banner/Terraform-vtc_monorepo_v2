// src/lib/pricing.ts
// Source de vérité unique pour le calcul de tarifs.
// Importé côté serveur (create-booking.ts) ET côté client (bookings.ts).
// Logique pure — aucune dépendance externe.

export interface PricingRule {
  base_price: number | string;
  price_per_km: number | string;
  price_per_hour: number | string;
  minimum_fare: number | string;
  service_category?: string | null;
}

export type BookingType = "transfer" | "hourly";

export interface PriceInput {
  bookingType: BookingType;
  distanceKm?: number;
  durationHours?: number;
  rule: PricingRule;
}

/**
 * Calcule le montant total d'une course à partir d'une règle tarifaire.
 * Applique le minimum_fare si le total calculé est inférieur.
 */
export const calculatePrice = (input: PriceInput): number => {
  const { bookingType, distanceKm = 0, durationHours = 1, rule } = input;
  const base = Number(rule.base_price) || 0;
  const minFare = Number(rule.minimum_fare) || 0;

  let total: number;
  if (bookingType === "hourly") {
    total = base + (Number(rule.price_per_hour) || 0) * durationHours;
  } else {
    total = base + (Number(rule.price_per_km) || 0) * distanceKm;
  }

  return Math.max(total, minFare);
};

/**
 * Décompose un montant TTC en net + TVA.
 * Les prix de la grille sont TTC — la TVA est extraite (non ajoutée).
 * Si exempt ou taux nul, retourne gross = net, vat = 0.
 */
export const computeVat = (
  grossAmount: number,
  vatRate: number,
  isExempt: boolean,
): { net: number; vat: number; gross: number } => {
  if (isExempt || vatRate <= 0 || grossAmount <= 0) {
    return { net: grossAmount, vat: 0, gross: grossAmount };
  }
  const net = grossAmount / (1 + vatRate / 100);
  const vat = grossAmount - net;
  return {
    net:   Math.round(net * 100) / 100,
    vat:   Math.round(vat * 100) / 100,
    gross: grossAmount,
  };
};

/**
 * Sélectionne la règle tarifaire la plus pertinente pour une catégorie de véhicule.
 * Fallback sur la première règle disponible si aucune ne matche la catégorie.
 */
export const findPricingRule = (
  rules: PricingRule[],
  vehicleCategory: string,
): PricingRule | null => {
  if (!rules.length) return null;
  const cat = vehicleCategory.toLowerCase().trim();
  return (
    rules.find((r) => (r.service_category ?? "").toLowerCase().trim() === cat) ??
    rules[0]
  );
};

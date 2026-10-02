import { h } from "../../html-escape.ts";
import { Brand } from "../brand.ts";
import { dateFr, detailsTable, emailLayout, euro } from "../layout.ts";

// Côté site du chauffeur : relation client, aux couleurs du chauffeur (marque seulement).
export function bookingConfirmationEmail(d: {
  brand: Brand;
  firstName?: string | null;
  reference: string;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  pickupTime?: string | null;
  total: number;
}): string {
  return emailLayout({
    brand: d.brand,
    title: "Votre réservation est confirmée",
    body: `<p style="margin:0 0 12px">Bonjour ${h(d.firstName ?? "")},</p>
<p style="margin:0">Votre course est réservée et payée. Voici le récapitulatif.</p>
${detailsTable([
  ["Référence", d.reference],
  ["Date", dateFr(d.pickupTime)],
  ["Prise en charge", d.pickupAddress],
  ["Destination", d.dropoffAddress],
  ["Total payé", euro(d.total)],
])}
<p style="margin:0">Pour toute question, répondez à cet email ou contactez-nous.</p>`,
  });
}

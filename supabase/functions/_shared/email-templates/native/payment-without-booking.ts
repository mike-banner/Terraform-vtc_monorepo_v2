import { h } from "../../html-escape.ts";
import { emailButton, detailsTable, emailLayout, euro, dateFr } from "../layout.ts";
import { NEUTRAL_BRAND } from "../brand.ts";

// Natif de l'app, destiné au chauffeur : paiement encaissé mais course non créée. Action requise.
export function paymentWithoutBookingEmail(d: {
  amount: number;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  pickupTime?: string | null;
  stripeUrl: string;
  reason: string;
}): string {
  return emailLayout({
    brand: NEUTRAL_BRAND,
    title: "Action requise : paiement reçu, course non créée",
    body: `<p style="margin:0 0 12px"><strong>Un client a payé ${h(euro(d.amount))}, mais sa course n'a pas pu être enregistrée.</strong></p>
${detailsTable([
  ["Client", d.customerName],
  ["Email", d.customerEmail],
  ["Téléphone", d.customerPhone],
  ["Départ", d.pickupAddress],
  ["Arrivée", d.dropoffAddress],
  ["Date", dateFr(d.pickupTime)],
])}
<p style="margin:0 0 16px">Deux options : rembourser le paiement dans Stripe, ou créer la course à la main dans le backoffice (Nouvelle course) avec ces informations.</p>
<p style="margin:0 0 16px">${emailButton(NEUTRAL_BRAND, "Ouvrir le paiement dans Stripe", d.stripeUrl)}</p>
<p style="margin:0;font-size:12px;color:#555555">Cause technique : ${h(d.reason)}</p>`,
  });
}

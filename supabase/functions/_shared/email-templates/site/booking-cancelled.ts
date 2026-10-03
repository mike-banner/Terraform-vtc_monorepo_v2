import { h } from "../../html-escape.ts";
import { Brand } from "../brand.ts";
import { dateFr, detailsTable, emailLayout } from "../layout.ts";

// Côté site du chauffeur : annulation d'une course. Le remboursement a son propre modèle (native/refund-confirmation.ts).
export function bookingCancelledEmail(d: {
  brand: Brand;
  firstName?: string | null;
  reference: string;
  pickupAddress?: string | null;
  pickupTime?: string | null;
}): string {
  return emailLayout({
    brand: d.brand,
    title: "Votre course est annulée",
    body: `<p style="margin:0 0 12px">Bonjour ${h(d.firstName ?? "")},</p>
<p style="margin:0">Votre course a été annulée.</p>
${detailsTable([
  ["Référence", d.reference],
  ["Date prévue", dateFr(d.pickupTime)],
  ["Prise en charge", d.pickupAddress],
])}
<p style="margin:0">Si un remboursement est dû, vous recevrez un email distinct avec son montant.</p>`,
  });
}

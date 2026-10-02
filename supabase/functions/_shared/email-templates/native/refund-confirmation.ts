import { h } from "../../html-escape.ts";
import { Brand } from "../brand.ts";
import { detailsTable, emailLayout, euro } from "../layout.ts";

// Natif de l'app : montant et délai, texte fixe (le chauffeur ne le modifie pas).
export function refundConfirmationEmail(d: {
  brand: Brand;
  firstName?: string | null;
  reference: string;
  refundAmount: number;
}): string {
  return emailLayout({
    brand: d.brand,
    title: "Remboursement lancé",
    body: `<p style="margin:0 0 12px">Bonjour ${h(d.firstName ?? "")},</p>
<p style="margin:0">Le remboursement de votre course est lancé.</p>
${detailsTable([
  ["Référence", d.reference],
  ["Montant remboursé", euro(d.refundAmount)],
])}
<p style="margin:0">Il apparaît sur votre moyen de paiement sous 5 à 10 jours ouvrés, selon votre banque.</p>`,
  });
}

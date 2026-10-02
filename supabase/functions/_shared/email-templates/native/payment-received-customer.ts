import { h } from "../../html-escape.ts";
import { Brand } from "../brand.ts";
import { emailLayout, euro } from "../layout.ts";

// Natif de l'app, destiné au client : paiement reçu mais réservation à confirmer. Texte fixe (engagement de remboursement).
export function paymentReceivedCustomerEmail(d: { brand: Brand; firstName?: string | null; amount: number }): string {
  const who = d.brand.name || "Votre chauffeur";
  return emailLayout({
    brand: d.brand,
    title: "Votre paiement a bien été reçu",
    body: `<p style="margin:0 0 12px">Bonjour ${h(d.firstName ?? "")},</p>
<p style="margin:0">Votre paiement de ${h(euro(d.amount))} a bien été reçu, mais votre réservation n'a pas pu être enregistrée automatiquement. ${h(who)} a été prévenu et vous contacte rapidement. À défaut, vous serez remboursé.</p>`,
  });
}

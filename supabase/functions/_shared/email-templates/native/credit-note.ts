import { h } from "../../html-escape.ts";
import { Brand } from "../brand.ts";
import { detailsTable, emailButton, emailLayout, euro } from "../layout.ts";

// Natif de l'app : avoir émis sur une facture. Montants et mentions fixes.
export function creditNoteEmail(d: {
  brand: Brand;
  firstName?: string | null;
  number: string;
  invoiceNumber: string;
  amount: number;
  url: string;
}): string {
  return emailLayout({
    brand: d.brand,
    title: `Votre avoir ${d.number}`,
    body: `<p style="margin:0 0 12px">Bonjour ${h(d.firstName ?? "")},</p>
<p style="margin:0">Un avoir a été émis sur votre facture ${h(d.invoiceNumber)}.</p>
${detailsTable([
  ["Avoir", d.number],
  ["Facture d'origine", d.invoiceNumber],
  ["Montant", euro(d.amount)],
])}
<p style="margin:0 0 16px">${emailButton(d.brand, "Télécharger l'avoir", d.url)}</p>
<p style="margin:0">Lien valable 7 jours.</p>`,
  });
}

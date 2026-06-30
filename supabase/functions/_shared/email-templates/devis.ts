import { tokens } from "../email-tokens.ts";

export interface DevisEmailData {
  invoiceNumber: string;
  pdfUrl: string;
  tenant: {
    name: string;
    email?: string | null;
    phone?: string | null;
    siret?: string | null;
    vat_number?: string | null;
    is_vat_exempt?: boolean | null;
    vat_rate?: number | null;
    legal_form?: string | null;
    capital_social?: number | null;
  };
  customer: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    company_name?: string | null;
  } | null;
  booking: {
    pickup_address?: string | null;
    dropoff_address?: string | null;
    pickup_time?: string | null;
    subtotal_amount?: number | null;
    vat_amount?: number | null;
    total_amount?: number | null;
    passenger_count?: number | null;
    luggage_count?: number | null;
  };
}

export function generateDevisEmail(data: DevisEmailData): string {
  const { tenant, customer, booking, invoiceNumber, pdfUrl } = data;
  const { colors, fonts, spacing } = tokens;

  const customerName = customer
    ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Client"
    : "Client";

  const pickupDate = booking.pickup_time
    ? new Date(booking.pickup_time).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
    : "—";

  const subtotal = Number(booking.subtotal_amount ?? booking.total_amount ?? 0);
  const total = Number(booking.total_amount ?? 0);
  const vat = Number(booking.vat_amount ?? 0);
  const isExempt = tenant.is_vat_exempt !== false;
  const vatRate = Number(tenant.vat_rate ?? 0);

  const legalLines: string[] = [
    "Ce document est un devis sans valeur fiscale.",
    isExempt ? "TVA non applicable, art. 293 B du CGI." : `TVA au taux de ${vatRate}%.`,
    tenant.siret ? `SIRET : ${tenant.siret}` : null,
    tenant.vat_number ? `N° TVA : ${tenant.vat_number}` : null,
    tenant.legal_form ? `Forme juridique : ${tenant.legal_form}` : null,
    tenant.capital_social
      ? `Capital social : ${Number(tenant.capital_social).toFixed(2)} €`
      : null,
  ].filter((l): l is string => l !== null);

  const details: string[] = [
    `Départ : ${booking.pickup_address ?? "—"}`,
    `Arrivée : ${booking.dropoff_address ?? "—"}`,
    booking.passenger_count ? `${booking.passenger_count} passager(s)` : null,
    booking.luggage_count ? `${booking.luggage_count} bagage(s)` : null,
  ].filter((l): l is string => l !== null);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Devis ${invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background-color:${colors.section};font-family:${fonts.stack};">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${colors.section};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:${colors.bg};border:1px solid ${colors.border};border-radius:4px;">

        <!-- En-tête -->
        <tr>
          <td style="padding:${spacing.container};border-bottom:1px solid ${colors.border};">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:18px;font-weight:700;color:${colors.accent};">${tenant.name}</p>
                  ${tenant.email ? `<p style="margin:4px 0 0;font-size:13px;color:${colors.textSecondary};">${tenant.email}</p>` : ""}
                  ${tenant.phone ? `<p style="margin:2px 0 0;font-size:13px;color:${colors.textSecondary};">${tenant.phone}</p>` : ""}
                </td>
                <td align="right">
                  <p style="margin:0;font-size:22px;font-weight:700;color:${colors.accent};letter-spacing:2px;">DEVIS</p>
                  <p style="margin:6px 0 0;font-size:12px;color:${colors.textSecondary};">N° ${invoiceNumber}</p>
                  <p style="margin:2px 0 0;font-size:12px;color:${colors.textSecondary};">Valable 30 jours</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Bloc client -->
        <tr>
          <td style="padding:${spacing.section} ${spacing.container};border-bottom:1px solid ${colors.border};background-color:${colors.section};">
            <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:${colors.textSecondary};text-transform:uppercase;letter-spacing:1px;">Client</p>
            <p style="margin:0;font-size:15px;font-weight:600;color:${colors.text};">${customerName}</p>
            ${customer?.company_name ? `<p style="margin:2px 0 0;font-size:13px;color:${colors.textSecondary};">${customer.company_name}</p>` : ""}
          </td>
        </tr>

        <!-- Détails course -->
        <tr>
          <td style="padding:${spacing.section} ${spacing.container};">
            <p style="margin:0 0 16px;font-size:11px;font-weight:600;color:${colors.textSecondary};text-transform:uppercase;letter-spacing:1px;">Détails de la prestation</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${colors.border};border-radius:3px;">
              <tr style="background-color:${colors.section};">
                <td style="padding:10px 14px;font-size:12px;font-weight:600;color:${colors.textSecondary};border-bottom:1px solid ${colors.border};">Description</td>
                <td align="right" style="padding:10px 14px;font-size:12px;font-weight:600;color:${colors.textSecondary};border-bottom:1px solid ${colors.border};">Montant HT</td>
              </tr>
              <tr>
                <td style="padding:14px;">
                  <p style="margin:0;font-size:14px;font-weight:600;color:${colors.text};">Course VTC — ${pickupDate}</p>
                  ${details.map(d => `<p style="margin:4px 0 0;font-size:12px;color:${colors.textSecondary};">${d}</p>`).join("")}
                </td>
                <td align="right" style="padding:14px;font-size:14px;font-weight:600;color:${colors.text};white-space:nowrap;">${subtotal.toFixed(2)} €</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Totaux -->
        <tr>
          <td style="padding:0 ${spacing.container} ${spacing.section};">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td></td>
                <td width="220" style="border-top:1px solid ${colors.border};padding-top:12px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:${colors.textSecondary};">Sous-total HT</td>
                      <td align="right" style="padding:4px 0;font-size:13px;color:${colors.text};">${subtotal.toFixed(2)} €</td>
                    </tr>
                    ${!isExempt && vatRate > 0 ? `
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:${colors.textSecondary};">TVA (${vatRate}%)</td>
                      <td align="right" style="padding:4px 0;font-size:13px;color:${colors.text};">${vat.toFixed(2)} €</td>
                    </tr>` : ""}
                    <tr>
                      <td style="padding:10px 0 4px;font-size:15px;font-weight:700;color:${colors.accent};border-top:2px solid ${colors.accent};">Total TTC</td>
                      <td align="right" style="padding:10px 0 4px;font-size:15px;font-weight:700;color:${colors.accent};border-top:2px solid ${colors.accent};">${total.toFixed(2)} €</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" style="padding:${spacing.section} ${spacing.container};">
            <a href="${pdfUrl}" style="display:inline-block;background-color:${colors.accent};color:#FFFFFF;font-family:${fonts.stack};font-size:14px;font-weight:600;text-decoration:none;padding:${spacing.button};border-radius:3px;">Télécharger le devis</a>
          </td>
        </tr>

        <!-- Pied légal -->
        <tr>
          <td style="padding:${spacing.section} ${spacing.container};border-top:1px solid ${colors.border};background-color:${colors.section};">
            ${legalLines.map(l => `<p style="margin:0 0 4px;font-size:11px;color:${colors.textSecondary};">${l}</p>`).join("")}
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

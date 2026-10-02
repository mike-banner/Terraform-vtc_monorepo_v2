import { tokens } from "../email-tokens.ts";
import { h } from "../html-escape.ts";
import { Brand, NEUTRAL_BRAND } from "./brand.ts";

// Coquille commune à tous les emails : en-tête de marque, contenu, pied de page.
// `body` est du HTML déjà échappé par le modèle appelant (utiliser h() sur toute donnée).
export function emailLayout(opts: { brand?: Brand; title: string; body: string }): string {
  const brand = opts.brand ?? NEUTRAL_BRAND;
  const { colors, fonts, spacing } = tokens;

  const header = brand.logoUrl
    ? `<img src="${h(brand.logoUrl)}" alt="${h(brand.name)}" height="40" style="display:block;border:0;height:40px;width:auto">`
    : `<span style="font-size:18px;font-weight:600;color:${colors.text}">${h(brand.name)}</span>`;

  const contact = [brand.phone, brand.email].filter(Boolean).map((c) => h(c)).join(" · ");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${colors.section};font-family:${fonts.stack};color:${colors.text}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.section}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${colors.bg};border:1px solid ${colors.border};border-radius:8px">
    <tr><td style="padding:${spacing.section} ${spacing.container};border-bottom:3px solid ${brand.accent}">${header}</td></tr>
    <tr><td style="padding:${spacing.container};font-size:15px;line-height:24px">${opts.body}</td></tr>
    <tr><td style="padding:${spacing.section} ${spacing.container};border-top:1px solid ${colors.border};font-size:12px;line-height:18px;color:${colors.textSecondary}">
      ${brand.name ? `<strong>${h(brand.name)}</strong><br>` : ""}${contact}
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

export function emailButton(brand: Brand, label: string, href: string): string {
  return `<a href="${h(href)}" style="display:inline-block;padding:${tokens.spacing.button};background:${brand.accent};color:#FFFFFF;text-decoration:none;border-radius:6px;font-weight:600">${h(label)}</a>`;
}

export function detailsTable(rows: [string, string | null | undefined][]): string {
  const lines = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:${tokens.colors.textSecondary}">${h(k)}</td><td style="padding:6px 0;text-align:right;font-weight:600">${h(v)}</td></tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${tokens.colors.border};border-bottom:1px solid ${tokens.colors.border};margin:20px 0">${lines}</table>`;
}

export const euro = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export const dateFr = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Paris" }) : "";

import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

// Dessin commun facture / avoir. Les montants arrivent déjà calculés (base de données) : aucun calcul ici.
export interface DocumentPdfInput {
  kind: "invoice" | "credit_note";
  logoUrl?: string | null;
  lines: { seller: string[]; buyer: string[]; header: string[]; footer: string[] };
  item: { description: string; details: string[] };
  totals: { ht: number; vat: number; ttc: number; exempt: boolean; vatRate: number };
}

// Les polices standard n'encodent que le Latin-1 et l'euro : le reste devient « ? » au lieu de faire échouer l'émission.
const safe = (s: string) => s.replace(/[^\x20-\x7e\xa0-\xff€]/g, "?");

export async function buildDocumentPdf(input: DocumentPdfInput): Promise<Uint8Array> {
  const { lines, totals } = input;
  const credit = input.kind === "credit_note";
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.5, 0.5, 0.5);
  const blue = rgb(0.1, 0.3, 0.6);
  const text = (s: string, x: number, y: number, size = 10, bold = false, color = black) =>
    page.drawText(safe(s), { x, y, size, font: bold ? fontBold : font, color });
  const money = (n: number) => `${credit ? "- " : ""}${n.toFixed(2).replace(".", ",")} €`;

  let y = height - 60;
  text(lines.header[0], width - 170, y, 22, true, blue);
  text(lines.header[1], width - 200, height - 82, 11, true);
  let hy = height - 97;
  for (const l of lines.header.slice(2)) {
    text(l, width - 200, hy, 9);
    hy -= 12;
  }

  let logoEmbedded = false;
  if (input.logoUrl) {
    try {
      const resp = await fetch(input.logoUrl);
      if (resp.ok) {
        const bytes = new Uint8Array(await resp.arrayBuffer());
        const img = input.logoUrl.toLowerCase().includes(".png") ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        page.drawImage(img, { x: 50, y: y - 35, width: 45, height: 45 });
        logoEmbedded = true;
      }
    } catch (e) {
      console.warn("Logo illisible dans le PDF:", e);
    }
  }
  // Bloc vendeur (la première ligne est le nom)
  let sy = y;
  lines.seller.forEach((l, i) => {
    text(l, logoEmbedded ? 105 : 50, sy, i === 0 ? 14 : 9, i === 0, i === 0 ? blue : gray);
    sy -= i === 0 ? 20 : 12;
  });
  y = Math.min(sy, hy) - 20;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: gray });
  y -= 22;

  text("CLIENT", 50, y, 10, true, gray);
  y -= 16;
  lines.buyer.forEach((l, i) => {
    text(l, 50, y, i === 0 ? 11 : 10, i === 0);
    y -= 14;
  });

  y -= 16;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: gray });
  y -= 22;
  const col = [50, 280, 375, 465];
  [["Description", 0], ["Qté", 1], [totals.exempt ? "Prix" : "P.U. HT", 2], [totals.exempt ? "Total" : "Total HT", 3]].forEach(([label, i]) =>
    text(label as string, col[i as number], y, 10, true)
  );
  y -= 6;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.3, color: gray });
  y -= 16;
  const unit = totals.exempt ? totals.ttc : totals.ht;
  text(input.item.description, col[0], y, 10, true);
  text("1", col[1], y);
  text(money(unit), col[2], y);
  text(money(unit), col[3], y);
  y -= 14;
  for (const d of input.item.details) {
    text(d, col[0] + 10, y, 9, false, gray);
    y -= 12;
  }

  y -= 20;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.3, color: gray });
  y -= 20;
  const row = (label: string, value: string, bold = false) => {
    text(label, width - 200, y, bold ? 12 : 10, bold, bold ? blue : black);
    text(value, width - 55 - value.length * (bold ? 7 : 5.5), y, bold ? 12 : 10, bold, bold ? blue : black);
    y -= bold ? 20 : 16;
  };
  if (totals.exempt) {
    row("TOTAL :", money(totals.ttc), true); // franchise en base : pas de sous-total HT
  } else {
    row("Sous-total HT :", money(totals.ht));
    row(`TVA (${totals.vatRate} %) :`, money(totals.vat));
    row("TOTAL TTC :", money(totals.ttc), true);
  }

  page.drawLine({ start: { x: 50, y: 95 }, end: { x: width - 50, y: 95 }, thickness: 0.3, color: gray });
  let fy = 82;
  for (const l of lines.footer) {
    text(l, 50, fy, 8, false, gray);
    fy -= 11;
  }
  return await pdfDoc.save();
}

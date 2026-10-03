import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { legalLines } from "./invoice-mentions.ts";
import { buildDocumentPdf } from "./invoice-pdf.ts";

Deno.test("facture et avoir se rendent en PDF, caractères hors Latin-1 compris", async () => {
  for (const kind of ["invoice", "credit_note"] as const) {
    const lines = legalLines(
      { name: "Elite", legal_form: "sasu", capital_social: 1000, address_line: "1 rue X", postal_code: "75001", city: "Paris", is_vat_exempt: true },
      { first_name: "Ada", last_name: "L", type: "company", company_name: "ACME" },
      { kind, number: "N-1", issuedAt: "2026-07-01T10:00:00Z", serviceDate: "2026-07-01T10:00:00Z", originalInvoiceNumber: "FAC-1" },
    );
    const bytes = await buildDocumentPdf({
      kind, lines,
      item: { description: "Course", details: ["Motif : 日本語  "] },
      totals: { ht: 90.91, vat: 9.09, ttc: 100, exempt: kind === "invoice", vatRate: 10 },
    });
    assert(new TextDecoder().decode(bytes.slice(0, 4)) === "%PDF");
  }
});

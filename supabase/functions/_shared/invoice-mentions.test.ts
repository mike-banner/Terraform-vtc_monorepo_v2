import { assert, assertEquals, assertStringIncludes, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatParisDate, legalLines } from "./invoice-mentions.ts";

const ei = { name: "Jean Martin", legal_form: "auto_entrepreneur", siret: "12345678900011", address_line: "1 rue de la Paix", postal_code: "75002", city: "Paris", is_vat_exempt: true };
const sasu = { name: "Elite SASU", legal_form: "sasu", capital_social: 1000, rcs_number: "Lyon 123", address_line: "2 quai X", postal_code: "69001", city: "Lyon", vat_number: "FR123", vat_rate: 10, is_vat_exempt: false };
const person = { first_name: "Ada", last_name: "Lovelace", type: "individual" };
const doc = { kind: "invoice" as const, number: "FAC-2026-0001", issuedAt: "2026-07-01T10:00:00Z", serviceDate: "2026-06-30T22:30:00Z" };

Deno.test("dates en heure de Paris", () => {
  assertEquals(formatParisDate("2026-12-31T23:30:00Z"), "01/01/2027");
  assertEquals(formatParisDate("2026-12-31T23:30:00Z", true), "01/01/2027 à 00:30");
  assertEquals(formatParisDate("2026-07-01T10:00:00Z", true), "01/07/2026 à 12:00");
});

Deno.test("vendeur EI : nom + EI, adresse, SIRET, pas de capital", () => {
  const { seller } = legalLines(ei, person, doc);
  assertStringIncludes(seller[0], "Jean Martin EI");
  assertEquals(seller.slice(1, 3), ["1 rue de la Paix", "75002 Paris"]);
  assert(seller.some((l) => l.includes("SIRET")));
  assert(!seller.some((l) => l.includes("Capital") || l.includes("capital")));
});

Deno.test("vendeur société : forme, capital, RCS, TVA", () => {
  const { seller } = legalLines(sasu, person, doc);
  assert(seller.includes("SASU au capital de 1 000 €"));
  assert(seller.some((l) => l.includes("RCS")));
  assert(seller.includes("N° TVA : FR123"));
});

Deno.test("TVA : franchise 293 B ou taux", () => {
  assert(legalLines(ei, person, doc).footer.includes("TVA non applicable, art. 293 B du CGI"));
  assert(legalLines(sasu, person, doc).footer.includes("TVA au taux de 10 %"));
});

Deno.test("client société : pénalités ; particulier : aucune", () => {
  const co = legalLines(sasu, { type: "company", company_name: "ACME", vat_number: "FR9" }, doc);
  const f = co.footer.join("\n");
  assertStringIncludes(f, "40 €");
  assertStringIncludes(f, "Pénalités de retard");
  assertStringIncludes(f, "Escompte");
  assertEquals(co.buyer[0], "ACME");
  const ind = legalLines(sasu, person, doc).footer.join("\n");
  assert(!ind.includes("Pénalités") && !ind.includes("40 €") && !ind.includes("Escompte"));
});

Deno.test("en-tête : prestation de services et date de la prestation à Paris", () => {
  const { header } = legalLines(ei, person, doc);
  assert(header.includes("Prestation de services"));
  assert(header.includes("Date de la prestation : 01/07/2026"));
  assert(header.includes("Date d'émission : 01/07/2026"));
});

Deno.test("avoir : référence la facture d'origine, sinon erreur", () => {
  const { header } = legalLines(ei, person, { ...doc, kind: "credit_note", number: "AV-2026-0001", originalInvoiceNumber: "FAC-2026-0001" });
  assert(header.includes("AVOIR"));
  assert(header.includes("Avoir sur la facture FAC-2026-0001"));
  assertThrows(() => legalLines(ei, person, { ...doc, kind: "credit_note" }));
});

Deno.test("acheteur : adresse si renseignée, nom seul sinon ; mention de paiement", () => {
  assertEquals(legalLines(ei, person, doc).buyer, ["Ada Lovelace"]);
  const withAddr = legalLines(ei, { ...person, billing_address: "9 rue Y", postal_code: "13001", city: "Marseille" }, doc).buyer;
  assert(withAddr.includes("9 rue Y"));
  const paid = legalLines(ei, person, { ...doc, paidAt: "2026-07-01T10:00:00Z", paymentMethod: "cash" }).footer;
  assert(paid.includes("Payée le 01/07/2026 par espèces"));
});

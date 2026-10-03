import { describe, expect, it } from "vitest";
import type { LedgerMovement } from "./api";
import { movementsToCsv } from "./csv";

const base: LedgerMovement = {
  id: "m1", created_at: "2026-03-15T10:30:00Z", movement_type: "payment",
  signed_gross: 100, signed_net: 90.91, signed_vat: 9.09, booking_id: "abcdef12-0000", pickup_time: null,
  pickup_address: null, dropoff_address: null, payment_mode: "card", booking_status: "paid",
  customer_name: "Jean", invoice_number: null, credit_note_number: null,
};
const line = (m: Partial<LedgerMovement>) => movementsToCsv([{ ...base, ...m }]).split("\n")[1];

describe("movementsToCsv", () => {
  it("reprend les colonnes et le séparateur", () => {
    expect(movementsToCsv([]).split("\n")[0]).toBe("Date;Heure;Type;Client;Mode;HT (€);TVA (€);ID Course");
    expect(line({})).toBe("15/03/2026;11:30;Paiement;Jean;Carte;90,91;9,09;abcdef12");
  });
  it("garde le signe du serveur sans préfixe sur les montants", () => {
    expect(line({ movement_type: "refund", signed_gross: -30, signed_net: -27.27, signed_vat: -2.73 })).toContain(";Remboursement;Jean;Carte;-27,27;-2,73;");
  });
  it("neutralise les formules et protège les séparateurs", () => {
    expect(line({ customer_name: "=SUM(A1)" })).toContain(";'=SUM(A1);");
    expect(line({ customer_name: "-Bob" })).toContain(";'-Bob;");
    expect(line({ customer_name: 'A;"B"' })).toContain(';"A;""B""";');
  });
});

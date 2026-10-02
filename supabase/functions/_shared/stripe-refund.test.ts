import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { refundParams } from "./stripe-refund.ts";

Deno.test("paiement direct : ni reverse_transfer ni refund_application_fee", () => {
  const p = refundParams({ id: "pi_1", transfer_data: null }, 2500, { booking_id: "b" });
  assertEquals(p, { payment_intent: "pi_1", amount: 2500, metadata: { booking_id: "b" } });
});

Deno.test("paiement Connect avec frais : les deux options", () => {
  const p = refundParams(
    { id: "pi_2", transfer_data: { destination: "acct_1" }, application_fee_amount: 150 },
    2500,
    { booking_id: "b" },
  );
  assertEquals(p.reverse_transfer, true);
  assertEquals(p.refund_application_fee, true);
});

Deno.test("paiement Connect sans frais : reverse_transfer seul", () => {
  const p = refundParams(
    { id: "pi_3", transfer_data: { destination: "acct_1" }, application_fee_amount: 0 },
    2500,
    { booking_id: "b" },
  );
  assertEquals(p.reverse_transfer, true);
  assertEquals("refund_application_fee" in p, false);
});

Deno.test("montant invalide : exception", () => {
  for (const a of [0, -5, 12.5]) {
    assertThrows(() => refundParams({ id: "pi_1" }, a, {}));
  }
});

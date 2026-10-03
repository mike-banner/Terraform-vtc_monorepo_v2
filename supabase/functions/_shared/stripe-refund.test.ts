import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { refundOnce, refundParams } from "./stripe-refund.ts";

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

// Faux client Stripe : paiement direct, remboursements déjà présents, compteur d'appels à create.
function fakeStripe(existing: Array<Record<string, unknown>>) {
  const created: Array<{ params: Record<string, unknown>; opts: Record<string, unknown> }> = [];
  const stripe = {
    paymentIntents: { retrieve: (id: string) => Promise.resolve({ id, transfer_data: null }) },
    refunds: {
      list: () => Promise.resolve({ data: existing }),
      create: (params: Record<string, unknown>, opts: Record<string, unknown>) => {
        created.push({ params, opts });
        return Promise.resolve({ id: "re_new", status: "pending", ...params });
      },
    },
  };
  return { stripe, created };
}

const args = (attempt: number) => ({
  paymentIntentId: "pi_1",
  amountCents: 8000,
  metadata: { booking_id: "b1" },
  idempotencyKey: `cancel-b1-${attempt}`,
});

Deno.test("relance : un remboursement déjà réussi est réutilisé, aucun second remboursement", async () => {
  const { stripe, created } = fakeStripe([{ id: "re_ok", status: "succeeded", metadata: { booking_id: "b1" } }]);
  const r = await refundOnce(stripe, args(2));
  assertEquals(r.id, "re_ok");
  assertEquals(created.length, 0);
});

Deno.test("relance : un remboursement en attente est réutilisé aussi", async () => {
  const { stripe, created } = fakeStripe([{ id: "re_p", status: "pending", metadata: { booking_id: "b1" } }]);
  assertEquals((await refundOnce(stripe, args(2))).id, "re_p");
  assertEquals(created.length, 0);
});

Deno.test("relance après échec : un nouveau remboursement est créé, avec une clé d'idempotence neuve", async () => {
  const { stripe, created } = fakeStripe([{ id: "re_ko", status: "failed", metadata: { booking_id: "b1" } }]);
  const r = await refundOnce(stripe, args(2));
  assertEquals(r.id, "re_new");
  assertEquals(created.length, 1);
  assertEquals(created[0].opts, { idempotencyKey: "cancel-b1-2" });
  assertEquals(created[0].params.amount, 8000);
});

Deno.test("remboursement annulé côté Stripe : on en recrée un", async () => {
  const { stripe, created } = fakeStripe([{ id: "re_c", status: "canceled", metadata: { booking_id: "b1" } }]);
  await refundOnce(stripe, args(3));
  assertEquals(created.length, 1);
});

Deno.test("le remboursement d'une autre course n'est jamais réutilisé", async () => {
  const { stripe, created } = fakeStripe([{ id: "re_other", status: "succeeded", metadata: { booking_id: "b2" } }]);
  const r = await refundOnce(stripe, args(1));
  assertEquals(r.id, "re_new");
  assertEquals(created.length, 1);
});

Deno.test("première tentative sans remboursement existant : un seul create", async () => {
  const { stripe, created } = fakeStripe([]);
  await refundOnce(stripe, args(1));
  assertEquals(created.length, 1);
  assertEquals(created[0].opts, { idempotencyKey: "cancel-b1-1" });
});

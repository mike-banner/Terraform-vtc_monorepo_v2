export type PiLike = {
  id: string;
  transfer_data?: { destination?: string | null } | null;
  application_fee_amount?: number | null;
};

export function refundParams(pi: PiLike, amountCents: number, metadata: Record<string, string>): {
  payment_intent: string;
  amount: number;
  metadata: Record<string, string>;
  reverse_transfer?: true;
  refund_application_fee?: true;
} {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error(`Montant de remboursement invalide: ${amountCents}`);
  }
  const params: ReturnType<typeof refundParams> = { payment_intent: pi.id, amount: amountCents, metadata };
  // Branche Connect uniquement pour les paiements Connect déjà encaissés (D-26 A),
  // aucun nouveau flux Connect : on reprend le transfert, et les frais s'il y en a.
  if (pi.transfer_data?.destination) {
    params.reverse_transfer = true;
    if ((pi.application_fee_amount ?? 0) > 0) params.refund_application_fee = true;
  }
  return params;
}

export async function refundOnce(
  // deno-lint-ignore no-explicit-any
  stripe: any, // client Stripe (esm.sh no-check : types non résolus, même convention que stripe_webhook)
  args: { paymentIntentId: string; amountCents: number; metadata: Record<string, string>; idempotencyKey: string },
): Promise<any> {
  const pi = await stripe.paymentIntents.retrieve(args.paymentIntentId);
  // ponytail: liste limitée à 100 remboursements par paiement, largement suffisant (un paiement = une course).
  const existing = await stripe.refunds.list({ payment_intent: pi.id, limit: 100 });
  const reuse = existing.data.find((r: any) =>
    r.metadata?.booking_id === args.metadata.booking_id &&
    r.metadata?.credit_note_id === args.metadata.credit_note_id &&
    r.status !== "failed" && r.status !== "canceled"
  );
  if (reuse) return reuse;
  return await stripe.refunds.create(refundParams(pi, args.amountCents, args.metadata), {
    idempotencyKey: args.idempotencyKey,
  });
}

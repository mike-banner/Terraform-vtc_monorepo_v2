import { useDialog } from "@/ui";
import { formatDateTime } from "../../format";
import { useAcceptQuote, useDeclineRequest, useSendQuote } from "../../mutations";
import { statusLabel } from "../../statuses";
import type { BookingRow, Conflict } from "../../types";
import { ActionButton } from "./ActionButton";

/** Demande de devis venue d'un tunnel (owner/manager) : envoyer, accepter (avec conflits), refuser avec motif. */
export function QuoteBlock({ booking, conflicts }: { booking: BookingRow; conflicts: Conflict[] }) {
  const dialog = useDialog();
  const send = useSendQuote();
  const accept = useAcceptQuote();
  const decline = useDeclineRequest();
  const lines = conflicts.map(
    (c) => `${formatDateTime(c.other_pickup_time)}, ${c.other_pickup_address ?? "?"}, ${statusLabel({ status: c.other_status as never, mission_status: null, refund_amount: null })}`,
  );

  const onDecline = async () => {
    const reason = (await dialog.prompt({ title: "Motif du refus", label: "Motif du refus (obligatoire)", required: true, multiline: true }))?.trim();
    if (reason) decline.mutate({ bookingId: booking.id, reason });
  };

  return (
    <section aria-label="Demande de devis" className="space-y-2">
      <h3 className="text-sm font-bold text-muted-foreground">Demande de devis</h3>
      <div className="flex flex-col gap-2">
        <ActionButton
          loading={send.isPending}
          onClick={() => send.mutate({ bookingId: booking.id }, { onSuccess: (r) => r.invoice_url && window.open(r.invoice_url, "_blank", "noopener") })}
        >
          Envoyer le devis
        </ActionButton>
        <ActionButton variant="secondary" loading={accept.isPending} onClick={() => accept.mutate({ bookingId: booking.id, conflicts: lines })}>
          Devis accepté
        </ActionButton>
        <ActionButton variant="danger" loading={decline.isPending} onClick={() => void onDecline()}>
          Refuser la demande
        </ActionButton>
      </div>
    </section>
  );
}

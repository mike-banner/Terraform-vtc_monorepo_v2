import { Badge } from "@/ui";
import { useMarkAddressVerified } from "../../mutations";
import { ADDRESS_ALERT_LABELS, isClosed } from "../../statuses";
import type { BookingRow } from "../../types";
import { ActionButton } from "./ActionButton";

/** Signalement d'adresse ; « Marquer comme vérifiée » masqué une fois vérifiée. */
export function AddressAlertBlock({ booking }: { booking: BookingRow }) {
  const verify = useMarkAddressVerified();
  const key = booking.address_alert ?? "";
  if (isClosed(booking) || !(key in ADDRESS_ALERT_LABELS)) return null;
  return (
    <section role="note" aria-label="Alerte d'adresse" className="space-y-2">
      <Badge tone={key === "verifie" ? "success" : "warning"}>{ADDRESS_ALERT_LABELS[key]}</Badge>
      {key === "verifie" ? null : (
        <div>
          <ActionButton variant="secondary" loading={verify.isPending} onClick={() => verify.mutate({ bookingId: booking.id })}>
            Marquer comme vérifiée
          </ActionButton>
        </div>
      )}
    </section>
  );
}

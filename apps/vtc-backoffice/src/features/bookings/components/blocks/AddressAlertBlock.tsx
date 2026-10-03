import { Badge } from "@/ui";
import { ADDRESS_ALERT_LABELS, isClosed } from "../../statuses";
import type { BookingRow } from "../../types";

/** Signalement d'adresse (lecture) ; « marquer vérifié » arrive avec les actions de la fiche. */
export function AddressAlertBlock({ booking }: { booking: BookingRow }) {
  const key = booking.address_alert ?? "";
  if (isClosed(booking) || !(key in ADDRESS_ALERT_LABELS)) return null;
  return (
    <section role="note" aria-label="Alerte d'adresse" className="space-y-1">
      <Badge tone={key === "verifie" ? "success" : "warning"}>{ADDRESS_ALERT_LABELS[key]}</Badge>
    </section>
  );
}

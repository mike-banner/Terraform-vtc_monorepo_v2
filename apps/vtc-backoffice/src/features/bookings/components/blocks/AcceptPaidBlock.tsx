import { useMyDriverId } from "../../queries";
import { useAcceptPaid } from "../../mutations";
import type { BookingRow } from "../../types";
import { ActionButton } from "./ActionButton";

/** Prise en main d'une course payée ; sans fiche chauffeur, le bouton est désactivé. */
export function AcceptPaidBlock({ booking }: { booking: BookingRow }) {
  const driver = useMyDriverId();
  const accept = useAcceptPaid();
  const driverId = driver.data ?? null;
  return (
    <section aria-label="Prise en main" className="space-y-1">
      <ActionButton
        loading={accept.isPending}
        disabled={!driverId}
        onClick={() => driverId && accept.mutate({ bookingId: booking.id, driverId })}
      >
        Accepter la course
      </ActionButton>
      {driver.isSuccess && !driverId ? <p className="text-xs text-muted-foreground">Profil chauffeur requis</p> : null}
    </section>
  );
}

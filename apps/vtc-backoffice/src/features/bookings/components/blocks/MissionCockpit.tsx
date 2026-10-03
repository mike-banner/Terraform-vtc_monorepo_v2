import { useState } from "react";
import { EndTimeSheet, enRouteAt, needsEndCorrection } from "@/features/missions/EndTimeSheet";
import { useOnline } from "@/app/useOnline";
import { Badge } from "@/ui";
import { formatTime } from "../../format";
import { useNow } from "../../hooks";
import { useTerrainTransition } from "../../mutations";
import type { BookingRow } from "../../types";
import { ActionButton } from "./ActionButton";

/** Pilotage terrain : « En route » dès 15 min avant le départ, « Terminer » ensuite (correction de l'heure de fin au-delà de 4 h). */
export function MissionCockpit({ booking }: { booking: BookingRow }) {
  const now = useNow(15_000);
  const { canWrite } = useOnline();
  const move = useTerrainTransition();
  const [open, setOpen] = useState(false);
  const note = booking.mission_note ?? "";
  const isEnRoute = note.includes("[terrain] en_route_at=");
  const availableAt = new Date(booking.pickup_time).getTime() - 15 * 60_000;
  const canStart = Number.isNaN(availableAt) || now >= availableAt;
  const start = enRouteAt(note, booking.pickup_time);

  const complete = (correctedAt?: string) =>
    move.mutate({ bookingId: booking.id, action: "completed", correctedAt }, { onSuccess: () => setOpen(false) });

  return (
    <section aria-label="Pilotage" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-muted-foreground">Pilotage</h3>
        {!isEnRoute && !canStart ? <Badge tone="warning">Dispo à {formatTime(new Date(availableAt).toISOString())}</Badge> : null}
      </div>
      {isEnRoute ? (
        <ActionButton
          className="w-full"
          loading={move.isPending}
          onClick={() => (needsEndCorrection(start) ? setOpen(true) : complete())}
        >
          Terminer
        </ActionButton>
      ) : (
        <ActionButton className="w-full" disabled={!canStart} loading={move.isPending} onClick={() => move.mutate({ bookingId: booking.id, action: "en_route" })}>
          En route
        </ActionButton>
      )}
      <EndTimeSheet open={open} onClose={() => setOpen(false)} start={start} busy={move.isPending} canWrite={canWrite} onConfirm={complete} />
    </section>
  );
}

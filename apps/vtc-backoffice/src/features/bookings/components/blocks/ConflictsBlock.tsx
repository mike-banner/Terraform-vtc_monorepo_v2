import { formatDateTime } from "../../format";
import { isClosed, statusLabel } from "../../statuses";
import type { BookingRow, Conflict } from "../../types";

export function ConflictsBlock({ booking, conflicts }: { booking: BookingRow; conflicts: Conflict[] }) {
  if (isClosed(booking) || conflicts.length === 0) return null;
  return (
    <section role="alert" aria-label="Conflit de créneau" className="space-y-1 rounded-xl bg-destructive/15 p-3 text-sm text-destructive">
      <p className="font-bold">Conflit de créneau avec :</p>
      <ul>
        {conflicts.map((c) => (
          <li key={c.other_id}>
            {formatDateTime(c.other_pickup_time)}, {c.other_pickup_address}, {statusLabel({ status: c.other_status as never, mission_status: null, refund_amount: null })}
          </li>
        ))}
      </ul>
    </section>
  );
}

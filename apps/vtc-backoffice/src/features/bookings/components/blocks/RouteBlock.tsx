import { bookingRef, formatDateLong, formatDateTime, formatEur, formatTime } from "../../format";
import type { BookingRow } from "../../types";
import { BookingStatusBadge } from "../BookingStatusBadge";

export function RouteBlock({ booking: b }: { booking: BookingRow }) {
  const hourly = b.booking_type === "hourly";
  const hours = Number(b.duration_hours ?? 0);
  const end = hourly && hours > 0 ? new Date(new Date(b.pickup_time).getTime() + hours * 3_600_000).toISOString() : null;
  const maps = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(b.pickup_address)}&destination=${encodeURIComponent(b.dropoff_address)}`;
  return (
    <section aria-labelledby="bk-route" className="space-y-2">
      <h3 id="bk-route" className="text-sm font-bold text-muted-foreground">
        Trajet
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <BookingStatusBadge booking={b} />
        <span className="text-sm text-muted-foreground">Réf. {bookingRef(b.id)}</span>
        <span className="ml-auto font-bold tabular-nums">{formatEur(b.total_amount)}</span>
      </div>
      <p className="text-sm font-bold">
        {hourly ? `Mise à disposition${end ? `, ${hours} h, jusqu'au ${formatDateTime(end)}` : ""}` : "Transfert"}
      </p>
      <p className="text-sm">
        <span className="font-bold">{formatDateLong(b.pickup_time)}</span> à <span className="font-bold">{formatTime(b.pickup_time)}</span>
      </p>
      <dl className="space-y-1 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Départ</dt>
          <dd>{b.pickup_address}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Arrivée</dt>
          <dd>{b.dropoff_address || "Non spécifiée"}</dd>
        </div>
        <div className="flex gap-6">
          <div>
            <dt className="text-xs text-muted-foreground">Passagers</dt>
            <dd>{b.passenger_count}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Bagages</dt>
            <dd>{b.luggage_count}</dd>
          </div>
        </div>
      </dl>
      <a href={maps} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-bold text-primary underline-offset-2 hover:underline">
        Itinéraire Google Maps
      </a>
    </section>
  );
}

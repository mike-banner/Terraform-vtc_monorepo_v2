import { Star } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { env } from "@/lib/env";
import type { BookingRow } from "../../types";

/** Course terminée : note du client si elle existe, sinon QR vers la page de notation. */
export function RatingBlock({ booking }: { booking: BookingRow }) {
  if (booking.mission_status !== "completed") return null;
  if (booking.rating != null) {
    return (
      <section aria-labelledby="bk-rating" className="space-y-1">
        <h3 id="bk-rating" className="text-sm font-bold text-muted-foreground">
          Note du client
        </h3>
        <p role="img" aria-label={`Note : ${booking.rating} sur 5`} className="flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} aria-hidden="true" className={`size-5 ${s <= booking.rating! ? "fill-current text-warning" : "text-muted-foreground"}`} />
          ))}
        </p>
        <p className="text-sm">{booking.rating_comment ? `« ${booking.rating_comment} »` : "Aucun commentaire"}</p>
      </section>
    );
  }
  const origin = env.SITE_URL.replace(/\/$/, "") || window.location.origin;
  return (
    <section aria-labelledby="bk-rating" className="space-y-2">
      <h3 id="bk-rating" className="text-sm font-bold text-muted-foreground">
        Faire noter la course
      </h3>
      <div className="inline-block rounded-xl bg-card p-2">
        <QRCodeSVG value={`${origin}/rate/${booking.id}`} size={192} marginSize={2} title="QR de notation" />
      </div>
    </section>
  );
}

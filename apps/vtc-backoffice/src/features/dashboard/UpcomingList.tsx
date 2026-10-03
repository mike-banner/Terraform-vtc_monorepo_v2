import type { ReactNode } from "react";
import { Badge, Card } from "@/ui";
import { customerName, formatDate, formatEur, formatTime } from "@/features/bookings/format";
import type { BookingRow } from "@/features/bookings/types";

/** Carte de course cliquable : ouvre la fiche partagée (BookingDetailSheet montée par la page). */
export function BookingCard({ b, onOpen, tone, children }: { b: BookingRow; onOpen: (id: string) => void; tone?: "success" | "danger" | "warning"; children?: ReactNode }) {
  const border = tone === "success" ? "border-success" : tone === "danger" ? "border-destructive" : tone === "warning" ? "border-warning" : "";
  return (
    <button type="button" onClick={() => onOpen(b.id)} className={`block min-h-11 w-full rounded-(--radius-card) border border-border bg-card p-3 text-left text-card-foreground ${border}`}>
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-bold">{customerName(b.customers)}</span>
        <span className="shrink-0 text-sm font-bold tabular-nums">
          {formatDate(b.pickup_time)} {formatTime(b.pickup_time)}
        </span>
      </span>
      <span className="block truncate text-sm text-muted-foreground">{b.pickup_address}</span>
      {children}
    </button>
  );
}

export function UpcomingList({ rows, onOpen }: { rows: BookingRow[]; onOpen: (id: string) => void }) {
  return (
    <section aria-label="Prochaines courses" className="space-y-2">
      <h2 className="text-sm font-bold text-muted-foreground">Prochaines courses</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Agenda libre</p>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {rows.map((b) => (
            <BookingCard key={b.id} b={b} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Courses à valider (mises à disposition et demandes en attente) : l'estimation vient du serveur. */
export function ToValidateList({ rows, onOpen }: { rows: BookingRow[]; onOpen: (id: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="Actions requises" className="space-y-2">
      <h2 className="text-sm font-bold text-warning-foreground">Actions requises</h2>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {rows.map((b) => (
          <Card key={b.id} className="space-y-2 p-0">
            <BookingCard b={b} onOpen={onOpen} tone="warning">
              <span className="mt-1 flex items-center justify-between gap-2">
                <Badge tone="warning">{b.booking_type === "hourly" ? "Mise à disposition" : "Demande"}</Badge>
                <span className="text-sm tabular-nums">Estimation {formatEur(b.total_amount)}</span>
              </span>
            </BookingCard>
          </Card>
        ))}
      </div>
    </section>
  );
}

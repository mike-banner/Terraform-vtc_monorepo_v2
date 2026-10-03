import { Badge, DataTable, type Column } from "@/ui";
import { useNow } from "../hooks";
import { customerName, formatDate, formatEur, formatTime } from "../format";
import { isLate, showAddressAlert } from "../statuses";
import type { BookingRow } from "../types";
import { BookingStatusBadge } from "./BookingStatusBadge";

const typeLabel = (b: BookingRow) => (b.booking_type === "hourly" ? "Mise à dispo" : "Transfert");

/** Badges d'alerte : adresse à vérifier, conflit de créneau (le Set n'est rempli que pour owner/manager). */
function Alerts({ b, conflicts }: { b: BookingRow; conflicts: ReadonlySet<string> }) {
  return (
    <>
      {showAddressAlert(b) ? <Badge tone="warning">Adresse à vérifier</Badge> : null}
      {conflicts.has(b.id) ? <Badge tone="danger">Conflit</Badge> : null}
    </>
  );
}

export function BookingList({
  rows,
  conflicts,
  onOpen,
}: {
  rows: BookingRow[];
  conflicts: ReadonlySet<string>;
  onOpen: (id: string) => void;
}) {
  const now = useNow();
  const columns: Column<BookingRow>[] = [
    {
      key: "client",
      header: "Client",
      cell: (b) => (
        <>
          {customerName(b.customers)}
          <span className="block text-xs font-normal text-muted-foreground">{b.pickup_address}</span>
        </>
      ),
    },
    { key: "when", header: "Date et heure", cell: (b) => `${formatDate(b.pickup_time)} ${formatTime(b.pickup_time)}` },
    { key: "type", header: "Type", cell: typeLabel },
    {
      key: "status",
      header: "Statut",
      cell: (b) => (
        <span className="flex flex-wrap items-center gap-1">
          <BookingStatusBadge booking={b} />
          <Alerts b={b} conflicts={conflicts} />
        </span>
      ),
    },
    { key: "amount", header: "Montant", cell: (b) => formatEur(b.total_amount) },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(b) => b.id}
      onRowClick={(b) => onOpen(b.id)}
      rowClassName={(b) => (isLate(b, now) ? "border-destructive" : undefined)}
      mobileCard={(b) => (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate font-bold">{customerName(b.customers)}</p>
            <p className="shrink-0 font-bold tabular-nums">{formatEur(b.total_amount)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Badge tone={b.booking_type === "hourly" ? "warning" : "primary"}>{typeLabel(b)}</Badge>
            <BookingStatusBadge booking={b} />
            <Alerts b={b} conflicts={conflicts} />
          </div>
          <p className="truncate text-sm text-muted-foreground">{b.pickup_address}</p>
          {b.booking_type === "transfer" ? <p className="truncate text-sm text-muted-foreground">{b.dropoff_address}</p> : null}
          <p className="text-sm tabular-nums">
            {formatDate(b.pickup_time)} {formatTime(b.pickup_time)}
          </p>
        </div>
      )}
    />
  );
}

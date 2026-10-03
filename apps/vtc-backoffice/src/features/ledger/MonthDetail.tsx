import { useState } from "react";
import { Download } from "lucide-react";
import { formatDate, formatEur, formatTime } from "@/features/bookings/format";
import { Badge, Button, DataTable, EmptyState, ErrorState, Skeleton, useToast } from "@/ui";
import { isRefund, useLedgerMonth, type LedgerMode, type LedgerMovement } from "./api";
import { movementsToCsv } from "./csv";
import { saveBlob } from "./downloadExport";
import { Totals } from "./MonthGrid";
import { MovementSheet } from "./MovementSheet";

const MODES: { id: LedgerMode; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "card", label: "Carte" },
  { id: "cash", label: "Espèces" },
];
const MODE_LABEL: Record<string, string> = { card: "Carte", cash: "Espèces" };

export function MonthDetail({ year, month, mode, onMode }: { year: number; month: number; mode: LedgerMode; onMode: (m: LedgerMode) => void }) {
  const { data, isLoading, isError, refetch } = useLedgerMonth(year, month, mode);
  const [open, setOpen] = useState<LedgerMovement | null>(null);
  const toast = useToast();

  const exportCsv = () => {
    try {
      saveBlob(new Blob(["﻿", movementsToCsv(data!.movements)], { type: "text/csv;charset=utf-8" }), `fiscal-${year}-${String(month).padStart(2, "0")}.csv`);
    } catch {
      toast.show({ message: "L'export a échoué.", tone: "error" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Mode de paiement" className="flex gap-1">
          {MODES.map((m) => (
            <Button key={m.id} variant={mode === m.id ? "primary" : "secondary"} aria-pressed={mode === m.id} onClick={() => onMode(m.id)}>
              {m.label}
            </Button>
          ))}
        </div>
        <Button variant="secondary" className="ml-auto" disabled={!data?.movements.length} onClick={exportCsv}>
          <Download aria-hidden="true" className="size-4" />
          Exporter CSV
        </Button>
      </div>
      {isLoading ? <Skeleton lines={5} /> : null}
      {isError ? <ErrorState message="Impossible de charger le mois." onRetry={() => refetch()} /> : null}
      {data ? (
        <>
          <Totals totals={data.totals} />
          {data.movements.length === 0 ? (
            <EmptyState title="Aucune transaction ce mois-ci." />
          ) : (
            <DataTable
              rows={data.movements}
              rowKey={(m) => m.id}
              onRowClick={setOpen}
              columns={[
                { key: "date", header: "Date", cell: (m) => `${formatDate(m.created_at)} ${formatTime(m.created_at)}` },
                { key: "client", header: "Client", cell: (m) => <>{m.customer_name ?? "—"} {isRefund(m) ? <Badge tone="danger">Remboursement</Badge> : null}</> },
                { key: "mode", header: "Mode", cell: (m) => MODE_LABEL[m.payment_mode ?? ""] ?? "—" },
                { key: "net", header: "HT", cell: (m) => <span className={`tabular-nums ${isRefund(m) ? "text-destructive" : ""}`}>{formatEur(m.signed_net)}</span> },
                { key: "vat", header: "TVA", cell: (m) => <span className={`tabular-nums ${isRefund(m) ? "text-destructive" : ""}`}>{formatEur(m.signed_vat)}</span> },
                { key: "gross", header: "TTC", cell: (m) => <span className={`tabular-nums ${isRefund(m) ? "text-destructive" : ""}`}>{formatEur(m.signed_gross)}</span> },
              ]}
              mobileCard={(m) => (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{m.customer_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(m.created_at)} {formatTime(m.created_at)} · {MODE_LABEL[m.payment_mode ?? ""] ?? "—"}</p>
                    {isRefund(m) ? <Badge tone="danger">Remboursement</Badge> : null}
                  </div>
                  <div className={`shrink-0 text-right text-sm font-bold tabular-nums ${isRefund(m) ? "text-destructive" : ""}`}>
                    <p>{formatEur(m.signed_gross)}</p>
                    <p className="text-xs font-normal text-muted-foreground">HT {formatEur(m.signed_net)}</p>
                  </div>
                </div>
              )}
            />
          )}
        </>
      ) : null}
      <MovementSheet movement={open} linked={data?.movements ?? []} onClose={() => setOpen(null)} />
    </div>
  );
}

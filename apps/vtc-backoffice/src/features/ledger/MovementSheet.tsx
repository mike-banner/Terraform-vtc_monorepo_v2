import { AppLink, bookingUrl } from "@/app/links";
import { formatDateTime, formatEur } from "@/features/bookings/format";
import { statusLabel } from "@/features/bookings/statuses";
import { Badge, Sheet } from "@/ui";
import { isRefund, type LedgerMovement } from "./api";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-sm font-bold tabular-nums">{children}</dd>
  </div>
);

const MODES: Record<string, string> = { card: "Carte", cash: "Espèces" };

/** Fiche d'un mouvement : tous les montants sont ceux du serveur (signed_*). `linked` = autres mouvements de la même course. */
export function MovementSheet({ movement: m, linked, onClose }: { movement: LedgerMovement | null; linked: LedgerMovement[]; onClose: () => void }) {
  const refunds = m ? linked.filter((x) => x.booking_id === m.booking_id && isRefund(x) && x.id !== m.id) : [];
  return (
    <Sheet open={!!m} onClose={onClose} title={m ? (isRefund(m) ? "Remboursement" : "Paiement") : "Mouvement"}>
      {m ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isRefund(m) ? "danger" : "success"}>{isRefund(m) ? "Remboursement" : "Paiement"}</Badge>
            {m.booking_status ? <Badge>{statusLabel({ status: m.booking_status, mission_status: null, refund_amount: null } as never)}</Badge> : null}
          </div>
          <dl className="grid grid-cols-2 gap-4">
            <Row label="Client">{m.customer_name ?? "—"}</Row>
            <Row label="Mode de paiement">{MODES[m.payment_mode ?? ""] ?? "—"}</Row>
            <Row label="Mouvement">{formatDateTime(m.created_at)}</Row>
            <Row label="Prise en charge">{m.pickup_time ? formatDateTime(m.pickup_time) : "—"}</Row>
            <Row label="Départ">{m.pickup_address ?? "—"}</Row>
            <Row label="Arrivée">{m.dropoff_address ?? "—"}</Row>
            <Row label="HT">{formatEur(m.signed_net)}</Row>
            <Row label="TVA">{formatEur(m.signed_vat)}</Row>
            <Row label="TTC">{formatEur(m.signed_gross)}</Row>
            <Row label={isRefund(m) ? "Avoir" : "Facture"}>{(isRefund(m) ? m.credit_note_number : m.invoice_number) ?? "—"}</Row>
            {refunds.length ? <Row label="Remboursement lié">{refunds.map((r) => formatEur(r.signed_gross)).join(", ")}</Row> : null}
          </dl>
          <AppLink to={bookingUrl(m.booking_id)} className="inline-flex min-h-11 items-center font-bold text-primary underline">
            Ouvrir la course
          </AppLink>
        </div>
      ) : null}
    </Sheet>
  );
}

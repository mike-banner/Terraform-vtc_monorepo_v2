import { useMemo, useState } from "react";
import { useOnline } from "@/app/useOnline";
import { useProfile } from "@/app/auth/useSession";
import { EmptyState, ErrorState, Sheet, Skeleton } from "@/ui";
import { ActionButton } from "./blocks/ActionButton";
import { EditBookingSheet } from "./EditBookingSheet";
import { useBooking, useConflicts } from "../queries";
import { bookingRef } from "../format";
import { useNow } from "../hooks";
import { bookingCapabilities } from "../statuses";
import { AcceptPaidBlock } from "./blocks/AcceptPaidBlock";
import { AddressAlertBlock } from "./blocks/AddressAlertBlock";
import { CancelPanel } from "./blocks/CancelPanel";
import { ConflictsBlock } from "./blocks/ConflictsBlock";
import { CreditNotesBlock } from "./blocks/CreditNotesBlock";
import { CustomerBlock } from "./blocks/CustomerBlock";
import { InstructionsBlock } from "./blocks/InstructionsBlock";
import { InvoiceBlock } from "./blocks/InvoiceBlock";
import { MissionCockpit } from "./blocks/MissionCockpit";
import { QuoteBlock } from "./blocks/QuoteBlock";
import { RatingBlock } from "./blocks/RatingBlock";
import { RouteBlock } from "./blocks/RouteBlock";

/** Ne reçoit que l'identifiant : la course est lue dans le cache partagé, donc suit le temps réel (Pitfall 2). */
export function BookingDetailSheet({ bookingId, onClose }: { bookingId: string | null; onClose: () => void }) {
  const q = useBooking(bookingId);
  const conflicts = useConflicts(bookingId ? [bookingId] : []);
  const { profile } = useProfile();
  const { canWrite, offlineMessage } = useOnline();
  const now = useNow(30_000);
  const [editing, setEditing] = useState(false);
  const b = q.data;
  const caps = useMemo(() => (b ? bookingCapabilities(b, { role: profile?.role ?? null }, now) : null), [b, profile?.role, now]);

  return (
    <>
    <Sheet open={!!bookingId} onClose={onClose} title={bookingId ? `Course ${bookingRef(bookingId)}` : "Course"}>
      {b && caps ? (
        <div className="space-y-6">
          {canWrite ? null : <p role="note" className="rounded-xl bg-warning-soft p-3 text-sm text-warning-foreground">{offlineMessage}</p>}
          <InstructionsBlock bookingId={b.id} instructions={b.instructions} missionNote={b.mission_note} editable={caps.canEditInstructions} />
          <RouteBlock booking={b} />
          {caps.canEdit ? (
            <ActionButton variant="secondary" onClick={() => setEditing(true)}>
              Modifier
            </ActionButton>
          ) : null}
          <CustomerBlock customer={b.customers} />
          <AddressAlertBlock booking={b} />
          <ConflictsBlock booking={b} conflicts={conflicts.data ?? []} />
          {caps.canHandleQuote ? <QuoteBlock booking={b} conflicts={conflicts.data ?? []} onFixPrice={caps.canEdit ? () => setEditing(true) : undefined} /> : null}
          {caps.canAcceptPaid ? <AcceptPaidBlock booking={b} /> : null}
          {caps.canTerrain ? <MissionCockpit booking={b} /> : null}
          {caps.canInvoice ? <InvoiceBlock booking={b} /> : null}
          {caps.canCreditNote ? <CreditNotesBlock booking={b} /> : null}
          <CancelPanel booking={b} caps={caps} />
          <RatingBlock booking={b} />
        </div>
      ) : q.isError ? (
        <ErrorState message="Impossible de charger la course." onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <Skeleton lines={6} />
      ) : (
        <EmptyState title="Course introuvable" />
      )}
    </Sheet>
    {b ? <EditBookingSheet booking={b} open={editing && !!bookingId} onClose={() => setEditing(false)} /> : null}
    </>
  );
}

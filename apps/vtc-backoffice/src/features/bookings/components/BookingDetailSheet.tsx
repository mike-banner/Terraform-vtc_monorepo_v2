import { EmptyState, ErrorState, Sheet, Skeleton } from "@/ui";
import { useBooking, useConflicts } from "../queries";
import { bookingRef } from "../format";
import { AddressAlertBlock } from "./blocks/AddressAlertBlock";
import { ConflictsBlock } from "./blocks/ConflictsBlock";
import { CustomerBlock } from "./blocks/CustomerBlock";
import { InstructionsBlock } from "./blocks/InstructionsBlock";
import { RatingBlock } from "./blocks/RatingBlock";
import { RouteBlock } from "./blocks/RouteBlock";

/** Ne reçoit que l'identifiant : la course est lue dans le cache partagé, donc suit le temps réel (Pitfall 2). */
export function BookingDetailSheet({ bookingId, onClose }: { bookingId: string | null; onClose: () => void }) {
  const q = useBooking(bookingId);
  const conflicts = useConflicts(bookingId ? [bookingId] : []);
  const b = q.data;

  return (
    <Sheet open={!!bookingId} onClose={onClose} title={bookingId ? `Course ${bookingRef(bookingId)}` : "Course"}>
      {b ? (
        <div className="space-y-6">
          <InstructionsBlock instructions={b.instructions} missionNote={b.mission_note} />
          <RouteBlock booking={b} />
          <CustomerBlock customer={b.customers} />
          <AddressAlertBlock booking={b} />
          <ConflictsBlock booking={b} conflicts={conflicts.data ?? []} />
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
  );
}

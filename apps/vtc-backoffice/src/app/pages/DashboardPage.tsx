import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { BookingDetailSheet } from "@/features/bookings/components/BookingDetailSheet";
import { customerName, formatTime } from "@/features/bookings/format";
import { useNow } from "@/features/bookings/hooks";
import { isLate } from "@/features/bookings/statuses";
import { StripeConnectionCard } from "@/features/dashboard/StripeConnectionCard";
import { useOngoing, useOverdue, useToValidate, useUpcoming } from "@/features/dashboard/queries";
import { BookingCard, ToValidateList, UpcomingList } from "@/features/dashboard/UpcomingList";
import { ErrorState, Skeleton } from "@/ui";
import { PageHeader } from "../shell/PageHeader";

export default function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const now = useNow();
  const ongoing = useOngoing();
  const overdue = useOverdue();
  const upcoming = useUpcoming();
  const validate = useToValidate();

  const open = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("booking", id);
    setParams(next);
  };
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("booking");
    setParams(next, { replace: true });
  };

  const current = ongoing.data?.[0] ?? null;
  // Garde contre un retard obsolète entre deux rafraîchissements.
  const late = useMemo(() => (overdue.data ?? []).find((b) => isLate(b, now)) ?? null, [overdue.data, now]);
  const failed = [ongoing, overdue, upcoming, validate].find((q) => q.isError && !q.data);

  return (
    <div className="space-y-4 p-4 md:p-8">
      <PageHeader title="Tableau de bord" />

      {failed ? (
        <ErrorState message="Impossible de charger le tableau de bord." onRetry={() => void failed.refetch()} />
      ) : ongoing.isPending ? (
        <Skeleton lines={5} />
      ) : current ? (
        <section aria-label="Mission en cours" className="space-y-2">
          <h2 className="text-sm font-bold text-success-foreground">Mission en cours</h2>
          <BookingCard b={current} onOpen={open} tone="success">
            <span className="block text-sm">Démarrée à {formatTime(current.pickup_time)} · {customerName(current.customers)}</span>
            <span className="block truncate text-sm text-muted-foreground">{current.dropoff_address || "Destination à confirmer"}</span>
          </BookingCard>
        </section>
      ) : (
        <>
          {late ? (
            <section aria-label="Course en retard" className="space-y-2">
              <h2 className="text-sm font-bold text-destructive">Course non démarrée, en retard</h2>
              <BookingCard b={late} onOpen={open} tone="danger">
                <span className="block text-sm font-bold">Heure dépassée : {formatTime(late.pickup_time)}</span>
              </BookingCard>
            </section>
          ) : null}
          <StripeConnectionCard />
          <ToValidateList rows={validate.data ?? []} onOpen={open} />
          <UpcomingList rows={upcoming.data ?? []} onOpen={open} />
        </>
      )}

      <BookingDetailSheet bookingId={params.get("booking")} onClose={close} />
    </div>
  );
}

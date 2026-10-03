import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useOnline } from "../useOnline";
import { Button, EmptyState, ErrorState, Skeleton } from "@/ui";
import { BookingDetailSheet } from "@/features/bookings/components/BookingDetailSheet";
import { BookingFilters } from "@/features/bookings/components/BookingFilters";
import { BookingList } from "@/features/bookings/components/BookingList";
import { NewBookingSheet } from "@/features/bookings/components/NewBookingSheet";
import { BookingSearch } from "@/features/bookings/components/BookingSearch";
import { useDebounced } from "@/features/bookings/hooks";
import { useBookingSearch, useBookings, useConflicts } from "@/features/bookings/queries";
import { sanitizeSearch } from "@/features/bookings/search";
import { PAGE_SIZE, type BookingFilters as Filters } from "@/features/bookings/types";
import { useProfile } from "../auth/useSession";
import { PageHeader } from "../shell/PageHeader";

const STATUSES = ["all", "to_validate", "not_started", "in_progress", "completed", "cancelled"];
const TYPES = ["all", "transfer", "hourly"];

export default function BookingsPage() {
  const { profile } = useProfile();
  const [params, setParams] = useSearchParams();
  const [raw, setRaw] = useState("");
  const [creating, setCreating] = useState(false);
  const { canWrite, offlineMessage } = useOnline();
  const canCreate = profile?.role === "owner" || profile?.role === "manager";

  const status = params.get("status") ?? "all";
  const type = params.get("type") ?? "all";
  const filters: Filters = {
    status: (STATUSES.includes(status) ? status : "all") as Filters["status"],
    type: (TYPES.includes(type) ? type : "all") as Filters["type"],
    page: Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1),
  };
  const openId = params.get("booking");

  // Les valeurs par défaut quittent l'URL ; un changement de filtre repart de la page 1 et ferme la fiche.
  const patch = (p: Partial<Filters>, resetPage: boolean) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(p)) {
      if (v === "all" || v === 1) next.delete(k);
      else next.set(k, String(v));
    }
    if (resetPage) next.delete("page");
    next.delete("booking");
    setParams(next);
  };
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

  const term = useDebounced(raw, 300);
  const searching = sanitizeSearch(term) !== null;
  const list = useBookings(filters);
  const search = useBookingSearch(searching ? term : "");
  const active = searching ? search : list;
  const rows = useMemo(() => (searching ? search.data : list.data?.rows) ?? [], [searching, search.data, list.data]);
  const conflicts = useConflicts(useMemo(() => rows.map((r) => r.id), [rows]));
  const conflictIds = useMemo(() => new Set((conflicts.data ?? []).map((c) => c.booking_id)), [conflicts.data]);

  const count = list.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const title = profile?.role === "driver" ? "Mes courses" : "Courses";

  return (
    <div className="space-y-4 page">
      <PageHeader
        title={title}
        action={
          canCreate ? (
            <Button disabled={!canWrite} title={canWrite ? undefined : offlineMessage} onClick={() => setCreating(true)}>
              Nouvelle course
            </Button>
          ) : null
        }
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="lg:flex-1">
          <BookingSearch value={raw} onChange={setRaw} />
        </div>
        {searching ? null : (
          <div className="lg:w-112">
            <BookingFilters filters={filters} onChange={(p) => patch(p, true)} />
          </div>
        )}
      </div>

      {active.isError && !active.data ? (
        <ErrorState message="Impossible de charger les courses." onRetry={() => void active.refetch()} />
      ) : active.isPending && !active.data ? (
        <Skeleton lines={5} />
      ) : rows.length === 0 ? (
        <EmptyState title={searching ? "Aucun résultat" : "Aucune course"} message={searching ? "Essayez un autre nom, téléphone ou référence." : undefined} />
      ) : (
        <>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {searching ? `${rows.length} résultat${rows.length > 1 ? "s" : ""}` : `${count} course${count > 1 ? "s" : ""}`}
          </p>
          <BookingList rows={rows} conflicts={conflictIds} onOpen={open} />
          {searching ? null : (
            <nav aria-label="Pagination" className="flex items-center justify-between gap-2">
              <Button variant="secondary" disabled={filters.page <= 1} onClick={() => patch({ page: filters.page - 1 }, false)}>
                Précédent
              </Button>
              <span className="text-sm tabular-nums">
                Page {filters.page} / {pages}
              </span>
              <Button variant="secondary" disabled={filters.page >= pages} onClick={() => patch({ page: filters.page + 1 }, false)}>
                Suivant
              </Button>
            </nav>
          )}
        </>
      )}

      <NewBookingSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          open(id);
        }}
      />
      <BookingDetailSheet bookingId={openId} onClose={close} />
    </div>
  );
}

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useOnline } from "@/app/useOnline";
import { Badge, Button, DataTable, EmptyState, ErrorState, Sheet, Skeleton, useDialog, useToast, type BadgeTone } from "@/ui";
import { useDeleteVehicle, useVehicles, type Vehicle } from "./api";
import { CATEGORY_LABELS, STATUS_LABELS } from "./schema";
import { VehicleForm } from "./VehicleForm";

const TONES: Record<string, BadgeTone> = { active: "success", inactive: "danger", maintenance: "warning" };

/** `creating` ouvre la feuille de création (bouton « Nouveau » porté par l'en-tête de la page). */
export function VehicleList({ tenantId, creating, onCloseCreate }: { tenantId: string; creating: boolean; onCloseCreate: () => void }) {
  const { data, isLoading, isError, refetch } = useVehicles(tenantId);
  const del = useDeleteVehicle(tenantId);
  const dialog = useDialog();
  const toast = useToast();
  const { canWrite } = useOnline();
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const remove = async (v: Vehicle) => {
    const ok = await dialog.confirm({
      title: "Supprimer le véhicule ?",
      message: `${v.brand} ${v.model} (${v.plate_number}) sera supprimé définitivement.`,
      confirmLabel: "Supprimer",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await del.mutateAsync(v.id);
      toast.show({ message: "Véhicule supprimé." });
    } catch {
      toast.show({ message: "Erreur lors de la suppression.", tone: "error" });
    }
  };

  const actions = (v: Vehicle) => (
    <div className="flex gap-1">
      <Button variant="ghost" aria-label={`Modifier ${v.plate_number}`} onClick={() => setEditing(v)} disabled={!canWrite}>
        <Pencil aria-hidden="true" className="size-4" />
      </Button>
      <Button variant="ghost" aria-label={`Supprimer ${v.plate_number}`} onClick={() => remove(v)} disabled={!canWrite}>
        <Trash2 aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );

  if (isLoading) return <Skeleton />;
  if (isError) return <ErrorState message="Impossible de charger les véhicules." onRetry={() => refetch()} />;

  return (
    <>
      {data && data.length > 0 ? (
        <DataTable
          rows={data}
          rowKey={(v) => v.id}
          columns={[
            { key: "plate", header: "Plaque", cell: (v) => v.plate_number },
            { key: "vehicle", header: "Véhicule", cell: (v) => `${v.brand} ${v.model}` },
            { key: "category", header: "Catégorie", cell: (v) => (v.category ? CATEGORY_LABELS[v.category] : "—") },
            { key: "seats", header: "Places", cell: (v) => `${v.capacity ?? "—"} pass. / ${v.luggage_capacity} bag.` },
            { key: "status", header: "Statut", cell: (v) => <Badge tone={TONES[v.status]}>{STATUS_LABELS[v.status]}</Badge> },
            { key: "actions", header: "Actions", cell: actions },
          ]}
          mobileCard={(v) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{v.plate_number}</span>
                <Badge tone={TONES[v.status]}>{STATUS_LABELS[v.status]}</Badge>
              </div>
              <p>
                {v.brand} {v.model}
              </p>
              <p className="text-sm text-muted-foreground">
                {v.category ? CATEGORY_LABELS[v.category] : "—"} · {v.capacity ?? "—"} pass. · {v.luggage_capacity} bag.
              </p>
              {actions(v)}
            </div>
          )}
        />
      ) : (
        <EmptyState title="Aucun véhicule enregistré" message="Ajoutez votre premier véhicule pour commencer à gérer vos courses." />
      )}
      <Sheet open={creating} onClose={onCloseCreate} title="Nouveau véhicule">
        {creating ? <VehicleForm onSaved={onCloseCreate} onCancel={onCloseCreate} /> : null}
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Modifier le véhicule">
        {editing ? <VehicleForm initial={editing} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} /> : null}
      </Sheet>
    </>
  );
}

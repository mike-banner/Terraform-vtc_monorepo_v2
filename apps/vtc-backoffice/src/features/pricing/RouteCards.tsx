import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { useOnline } from "@/app/useOnline";
import { Badge, Button, EmptyState, Skeleton } from "@/ui";

/** Liste des forfaits (état de chargement et état vide compris). */
export function RouteCards({
  routes,
  loading,
  onEdit,
  onDelete,
}: {
  routes: any[];
  loading: boolean;
  onEdit: (route: any) => void;
  onDelete: (id: string) => void;
}) {
  const { canWrite } = useOnline();

  if (loading) return <Skeleton />;
  if (routes.length === 0) return <EmptyState title="Aucun forfait configuré" message="Créez d'abord vos zones, puis un forfait point à point." />;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {routes.map((r) => (
        <div key={r.id} data-route={r.id} className="space-y-4 rounded-(--radius-card) border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <Badge tone="success" className="uppercase">
              {r.vehicle_category}
            </Badge>
            {r.is_bidirectional ? <ArrowRightLeft aria-label="Aller-retour" className="size-4 text-muted-foreground" /> : null}
          </div>
          <p className="min-w-0 truncate font-bold uppercase">
            {r.pickup_zone?.name} → {r.dropoff_zone?.name}
          </p>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <p className="text-xl font-bold tabular-nums">{r.price} €</p>
            <div className="flex gap-1">
              <Button variant="ghost" aria-label={`Modifier le forfait ${r.pickup_zone?.name} vers ${r.dropoff_zone?.name}`} disabled={!canWrite} onClick={() => onEdit(r)}>
                <Pencil aria-hidden="true" className="size-4" />
              </Button>
              <Button variant="ghost" aria-label={`Supprimer le forfait ${r.pickup_zone?.name} vers ${r.dropoff_zone?.name}`} disabled={!canWrite} onClick={() => onDelete(r.id)}>
                <Trash2 aria-hidden="true" className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useOnline } from "@/app/useOnline";
import { Badge, Button, DataTable, EmptyState, ErrorState, Sheet, Skeleton } from "@/ui";
import { useRules, type PricingRule } from "./api";
import { RuleForm } from "./RuleForm";

const eur = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)} €`);

/** `creating` ouvre la feuille de création (bouton « Ajouter » porté par la page). */
export function PricingRules({ tenantId, creating, onCloseCreate }: { tenantId: string; creating: boolean; onCloseCreate: () => void }) {
  const { data, isLoading, isError, refetch } = useRules(tenantId);
  const { canWrite } = useOnline();
  const [editing, setEditing] = useState<PricingRule | null>(null);

  const edit = (r: PricingRule) => (
    <Button variant="ghost" aria-label={`Modifier ${r.service_category}`} onClick={() => setEditing(r)} disabled={!canWrite}>
      <Pencil aria-hidden="true" className="size-4" />
    </Button>
  );
  const status = (r: PricingRule) => <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Actif" : "Inactif"}</Badge>;

  if (isLoading) return <Skeleton />;
  if (isError) return <ErrorState message="Impossible de charger les tarifs." onRetry={() => refetch()} />;

  return (
    <>
      {data && data.length > 0 ? (
        <DataTable
          rows={data}
          rowKey={(r) => r.id}
          columns={[
            { key: "service", header: "Service", cell: (r) => <span className="font-bold">{r.service_category}</span> },
            { key: "base", header: "Base", cell: (r) => eur(r.base_price) },
            { key: "km", header: "Au km", cell: (r) => eur(r.price_per_km) },
            { key: "hour", header: "Horaire", cell: (r) => eur(r.price_per_hour) },
            { key: "min", header: "Minimum", cell: (r) => eur(r.minimum_fare) },
            { key: "status", header: "Statut", cell: status },
            { key: "actions", header: "Actions", cell: edit },
          ]}
          mobileCard={(r) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{r.service_category}</span>
                {status(r)}
              </div>
              <p className="text-sm tabular-nums text-muted-foreground">
                Base {eur(r.base_price)} · {eur(r.price_per_km)}/km · {eur(r.price_per_hour)}/h · min. {eur(r.minimum_fare)}
              </p>
              {edit(r)}
            </div>
          )}
        />
      ) : (
        <EmptyState title="Aucun tarif configuré" message="Ajoutez un tarif standard pour chiffrer vos courses." />
      )}
      <Sheet open={creating} onClose={onCloseCreate} title="Nouveau tarif">
        {creating ? <RuleForm onSaved={onCloseCreate} onCancel={onCloseCreate} /> : null}
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Modifier le tarif">
        {editing ? <RuleForm initial={editing} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} /> : null}
      </Sheet>
    </>
  );
}

import { useState } from "react";
import { CreditCard, Pencil, Phone, Trash2, UserPlus } from "lucide-react";
import { useOnline } from "@/app/useOnline";
import { Badge, Button, Card, EmptyState, ErrorState, Sheet, Skeleton, useDialog, useToast } from "@/ui";
import { deleteDriver, initializePrimaryDriver, useDriverMutation, useDrivers, type Driver } from "./api";
import { DriverForm } from "./DriverForm";

/** Équipe du tenant (owner/manager). `hidePrimary` masque le titulaire, affiché ailleurs par la fiche éditable. */
export function DriverList({ tenantId, userId, hidePrimary }: { tenantId: string; userId: string; hidePrimary?: boolean }) {
  const { data, isLoading, isError, refetch } = useDrivers(tenantId);
  const { canWrite } = useOnline();
  const dialog = useDialog();
  const toast = useToast();
  const [sheet, setSheet] = useState<{ driver?: Driver } | null>(null);
  const del = useDriverMutation(tenantId, deleteDriver);
  const init = useDriverMutation(tenantId, () => initializePrimaryDriver(tenantId, userId));

  const fail = (e: unknown, fallback: string) => toast.show({ message: e instanceof Error ? e.message : fallback, tone: "error" });

  const remove = async (d: Driver) => {
    const ok = await dialog.confirm({ title: "Supprimer le chauffeur ?", message: `${d.first_name} ${d.last_name} sera supprimé définitivement.`, confirmLabel: "Supprimer", variant: "danger" });
    if (!ok) return;
    try {
      await del.mutateAsync(d.id);
      toast.show({ message: "Chauffeur supprimé." });
    } catch (e) {
      fail(e, "Erreur lors de la suppression.");
    }
  };

  const register = async () => {
    const ok = await dialog.confirm({ title: "S'enregistrer comme chauffeur ?", message: "Votre fiche sera créée à partir de vos informations d'inscription." });
    if (!ok) return;
    try {
      await init.mutateAsync(undefined);
    } catch (e) {
      fail(e, "Erreur lors de l'initialisation.");
    }
  };

  if (isLoading) return <Skeleton />;
  if (isError || !data) return <ErrorState message="Impossible de charger les chauffeurs." onRetry={() => refetch()} />;

  const primary = data.find((d) => d.user_id === userId);
  const team = data.filter((d) => d.user_id !== userId);
  const card = (d: Driver, isPrimary = false) => (
    <Card key={d.id} data-driver={d.id} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate font-bold">
          {d.first_name} {d.last_name}
        </h3>
        {isPrimary ? <Badge tone="primary">Titulaire</Badge> : null}
      </div>
      <p className="flex items-center gap-2 text-sm">
        <Phone aria-hidden="true" className="size-4 text-muted-foreground" />
        {d.phone || "—"}
      </p>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CreditCard aria-hidden="true" className="size-4" />
        {d.license_number || "—"}
      </p>
      <div className="flex gap-1">
        <Button variant="ghost" aria-label={`Modifier ${d.first_name} ${d.last_name}`} disabled={!canWrite} onClick={() => setSheet({ driver: d })}>
          <Pencil aria-hidden="true" className="size-4" />
        </Button>
        {isPrimary ? null : (
          <Button variant="ghost" aria-label={`Supprimer ${d.first_name} ${d.last_name}`} disabled={!canWrite} onClick={() => remove(d)}>
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      {hidePrimary ? null : (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground">Titulaire du compte</h2>
          {primary ? (
            card(primary, true)
          ) : (
            <EmptyState
              title="Aucun titulaire assigné"
              message="Enregistrez-vous comme premier chauffeur pour activer votre profil."
              action={
                <Button onClick={register} loading={init.isPending} disabled={!canWrite}>
                  M'ajouter comme chauffeur
                </Button>
              }
            />
          )}
        </section>
      )}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-muted-foreground">Équipe et collaborateurs</h2>
          <Button variant="secondary" disabled={!canWrite} onClick={() => setSheet({})}>
            <UserPlus aria-hidden="true" className="size-4" />
            Ajouter
          </Button>
        </div>
        {team.length > 0 ? (
          <div className="grid grid-cols-1 gap-(--gap-grid) md:grid-cols-2">{team.map((d) => card(d))}</div>
        ) : (
          <EmptyState title="Aucun collaborateur enregistré" />
        )}
      </section>
      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheet?.driver ? "Modifier le chauffeur" : "Nouveau chauffeur"}>
        {sheet ? <DriverForm tenantId={tenantId} initial={sheet.driver} onSaved={() => setSheet(null)} onCancel={() => setSheet(null)} /> : null}
      </Sheet>
    </div>
  );
}

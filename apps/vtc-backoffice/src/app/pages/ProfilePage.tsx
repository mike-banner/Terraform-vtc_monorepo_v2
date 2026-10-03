import { DriverList } from "@/features/drivers/DriverList";
import { useOwnDriver } from "@/features/drivers/api";
import { DeleteAccountDialog } from "@/features/profile/DeleteAccountDialog";
import { EditableDriverCard } from "@/features/profile/EditableDriverCard";
import { useTenantIdentity } from "@/features/profile/api";
import { Badge, Card, ErrorState, Skeleton } from "@/ui";
import { useProfile } from "../auth/useSession";
import { PageHeader } from "../shell/PageHeader";

const Item = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-bold tabular-nums">{value?.trim() || "—"}</p>
  </div>
);

export default function ProfilePage() {
  const { profile, isLoading } = useProfile();
  const tenantId = profile?.tenantId;
  const tenant = useTenantIdentity(tenantId);
  const own = useOwnDriver(tenantId, profile?.userId);
  const isOwner = profile?.role === "owner";
  const canManage = isOwner || profile?.role === "manager";

  if (isLoading || tenant.isLoading) return <div className="p-4 md:p-8"><Skeleton /></div>;
  if (!profile || !tenantId || !tenant.data) return <div className="p-4 md:p-8"><ErrorState message="Profil introuvable." onRetry={() => tenant.refetch()} /></div>;

  const t = tenant.data;
  const isAuto = t.legal_form === "auto_entrepreneur";
  return (
    <div className="space-y-8 p-4 md:p-8">
      <PageHeader title="Mon compte" />

      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          {t.logo_url ? (
            <img src={t.logo_url} alt={t.name} className="size-12 rounded-xl border border-border object-contain p-1" />
          ) : (
            <div aria-hidden="true" className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-lg font-bold text-primary">
              {t.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h2 className="min-w-0 flex-1 truncate text-xl font-bold">{t.name}</h2>
          <Badge tone="success">Compte vérifié</Badge>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Item label="SIRET" value={t.siret} />
          {isAuto ? (
            <Item label="Fiscalité" value="Exonéré (Art. 293 B)" />
          ) : (
            <>
              <Item label="RCS" value={t.rcs_number} />
              <Item label="TVA" value={t.vat_number} />
            </>
          )}
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-muted-foreground">Chauffeur principal</h2>
        {own.isLoading ? <Skeleton /> : own.data ? <EditableDriverCard driver={own.data} tenantId={tenantId} role={profile.role} /> : <Card className="text-sm text-muted-foreground">Aucune fiche chauffeur associée à votre compte.</Card>}
      </section>

      {canManage ? <DriverList tenantId={tenantId} userId={profile.userId} hidePrimary /> : null}

      {isOwner ? (
        <section aria-labelledby="danger-zone" className="rounded-(--radius-card) border border-destructive/40 p-4">
          <h2 id="danger-zone" className="mb-2 text-sm font-bold text-destructive">
            Zone de danger
          </h2>
          <DeleteAccountDialog tenantName={t.name} />
        </section>
      ) : null}
    </div>
  );
}

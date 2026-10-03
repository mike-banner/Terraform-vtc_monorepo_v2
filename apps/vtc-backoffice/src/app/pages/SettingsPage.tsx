import { ChevronRight, LogOut } from "lucide-react";
import { LogoUpload } from "@/features/settings/LogoUpload";
import { NotificationsSection } from "@/features/settings/NotificationsSection";
import { SettingsForm } from "@/features/settings/SettingsForm";
import { useTenantSettings } from "@/features/settings/api";
import { supabase } from "@/lib/supabase/client";
import { Button, Card, ErrorState, Skeleton, useDialog } from "@/ui";
import { useProfile } from "../auth/useSession";
import { AppLink } from "../links";
import { PageHeader } from "../shell/PageHeader";

const NAV = [
  { to: "/app/pricing", title: "Grille tarifaire", text: "Tarifs, forfaits et politique d'annulation." },
  { to: "/app/vehicles", title: "Véhicules", text: "Véhicules de l'entreprise et véhicule actif." },
];

export default function SettingsPage() {
  const { profile } = useProfile();
  const tenantId = profile?.tenantId;
  const { data: tenant, isLoading, isError, refetch } = useTenantSettings(tenantId);
  const dialog = useDialog();

  const logout = async () => {
    if (!(await dialog.confirm({ title: "Déconnexion", message: "Voulez-vous vous déconnecter ?", confirmLabel: "Se déconnecter", variant: "danger" }))) return;
    await supabase.auth.signOut();
    window.location.assign("/");
  };

  if (!tenantId || isLoading) return <div className="page"><Skeleton /></div>;
  if (isError || !tenant) return <div className="page"><ErrorState message="Impossible de charger les paramètres." onRetry={() => refetch()} /></div>;

  return (
    <div className="space-y-6 page">
      <PageHeader title="Entreprise" />
      <Card>
        <LogoUpload tenantId={tenantId} logoUrl={tenant.logo_url} name={tenant.name} />
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {NAV.map((n) => (
          <AppLink key={n.to} to={n.to} className="flex min-h-11 items-center gap-3 rounded-(--radius-card) border border-border bg-card p-4 hover:bg-muted">
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{n.title}</span>
              <span className="block text-sm text-muted-foreground">{n.text}</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
          </AppLink>
        ))}
      </div>
      <Card>
        <h2 className="mb-2 text-lg font-bold">Fiscalité et adresse</h2>
        <SettingsForm tenantId={tenantId} tenant={tenant} />
      </Card>
      <NotificationsSection />
      <Button variant="secondary" onClick={logout}>
        <LogOut aria-hidden="true" className="size-4" />
        Se déconnecter
      </Button>
    </div>
  );
}

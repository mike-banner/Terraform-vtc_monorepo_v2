import { AlertTriangle, ExternalLink } from "lucide-react";
import { useOnline } from "@/app/useOnline";
import { Badge, Button, Card, Skeleton } from "@/ui";
import { KpiGrid } from "./KpiGrid";
import { useStripeInfo } from "./queries";

/** Chiffres clés et état Stripe Connect. L'Edge Function existante est appelée avec le jeton de l'utilisateur. */
export function StripeConnectionCard() {
  const q = useStripeInfo();
  const { canWrite, offlineMessage } = useOnline();
  const info = q.data;
  const isDashboard = info?.status.type === "dashboard";
  const label = info?.accountMissing ? "Connecter Stripe" : info?.status.type === "onboarding" ? "Finaliser Stripe" : "Dashboard Stripe";
  const state = info?.accountMissing ? "Non configuré" : info?.status.type === "onboarding" ? "En cours" : "Actif";
  const open = () => info?.status.url && window.open(info.status.url, "_blank", "noopener,noreferrer");

  return (
    <Card className="space-y-4">
      <KpiGrid />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-muted-foreground">Stripe Connect</h2>
          {info ? <Badge tone={info.accountMissing ? "neutral" : isDashboard ? "success" : "warning"}>{state}</Badge> : null}
        </div>
        {q.isPending ? (
          <div className="w-32">
            <Skeleton lines={1} />
          </div>
        ) : q.isError ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle aria-hidden="true" className="size-4" />
            Erreur Stripe : {q.error instanceof Error ? q.error.message : "chargement impossible"}
          </p>
        ) : (
          <Button disabled={!canWrite || !info?.status.url} title={canWrite ? undefined : offlineMessage} onClick={open}>
            {label}
            <ExternalLink aria-hidden="true" className="size-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

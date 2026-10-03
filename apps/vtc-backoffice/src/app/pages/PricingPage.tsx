import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CancellationPolicyForm } from "@/features/pricing/CancellationPolicyForm";
import { PricingRules } from "@/features/pricing/PricingRules";
import { TransferManager } from "@/features/pricing/TransferManager";
import { Button, Skeleton } from "@/ui";
import { useProfile } from "../auth/useSession";
import { useOnline } from "../useOnline";
import { PageHeader } from "../shell/PageHeader";

const TABS = [
  { id: "rules", label: "Standard" },
  { id: "transfers", label: "Transferts" },
  { id: "cancellation", label: "Annulation" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function PricingPage() {
  const { profile } = useProfile();
  const { canWrite } = useOnline();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: Tab = TABS.some((t) => t.id === requested) ? (requested as Tab) : "rules";
  const [creatingRule, setCreatingRule] = useState(false);
  const [modal, setModal] = useState<"zones" | "transfer" | null>(null);
  const tenantId = profile?.tenantId;

  return (
    <div className="space-y-4 page">
      <PageHeader title="Tarifs" />
      <div role="tablist" aria-label="Sections des tarifs" className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setParams({ tab: t.id }, { replace: true })}
            className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-bold ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!tenantId ? (
        <Skeleton />
      ) : (
        <div role="tabpanel" className="space-y-4">
          {tab === "rules" ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold">Tarification standard</h2>
                <Button onClick={() => setCreatingRule(true)} disabled={!canWrite}>
                  Ajouter
                </Button>
              </div>
              <PricingRules tenantId={tenantId} creating={creatingRule} onCloseCreate={() => setCreatingRule(false)} />
            </>
          ) : null}
          {tab === "transfers" ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold">Forfaits et transferts</h2>
                <div className="flex gap-2">
                  <Button onClick={() => setModal("transfer")} disabled={!canWrite}>
                    Nouveau
                  </Button>
                  <Button variant="secondary" onClick={() => setModal("zones")}>
                    Zones
                  </Button>
                </div>
              </div>
              <TransferManager tenantId={tenantId} zonesOpen={modal === "zones"} transferOpen={modal === "transfer"} onClose={() => setModal(null)} />
            </>
          ) : null}
          {tab === "cancellation" ? (
            <>
              <h2 className="text-lg font-bold">Politique d'annulation</h2>
              <CancellationPolicyForm tenantId={tenantId} isOwner={profile?.role === "owner"} />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

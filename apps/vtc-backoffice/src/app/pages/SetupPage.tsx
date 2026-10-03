import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RuleForm } from "@/features/pricing/RuleForm";
import { LegalIdentityStep } from "@/features/setup/LegalIdentityStep";
import { SetupChecklist } from "@/features/setup/SetupChecklist";
import { useSetupData } from "@/features/setup/api";
import { prerequisiteStatus, type PrerequisiteId } from "@/features/setup/prerequisites";
import { VehicleForm } from "@/features/vehicles/VehicleForm";
import { Card, ErrorState, Skeleton, Stepper } from "@/ui";
import { AppLink } from "../links";
import { useProfile } from "../auth/useSession";
import { PageHeader } from "../shell/PageHeader";

const linkClass = "inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground";

export default function SetupPage() {
  const { profile } = useProfile();
  const { data, loading } = useSetupData(profile?.tenantId ?? null, profile?.userId ?? null);
  const qc = useQueryClient();
  const [chosen, setChosen] = useState<PrerequisiteId | null>(null);

  if (loading || !profile) return <div className="page"><Skeleton /></div>;
  if (!data) return <div className="page"><ErrorState message="Impossible de charger la configuration." onRetry={() => void qc.invalidateQueries()} /></div>;

  const items = prerequisiteStatus(data);
  const current = chosen ?? items.find((i) => !i.done)?.id ?? "legal";
  const next = () => {
    const i = items.findIndex((p) => p.id === current);
    setChosen(items[i + 1]?.id ?? null);
  };
  const blockingDone = items.every((i) => i.done || !i.blocking);
  const isDone = items.find((i) => i.id === current)?.done ?? false;

  return (
    <div className="space-y-4 page">
      <PageHeader title="Première connexion" />
      <p className="text-sm text-muted-foreground">Renseignez ces éléments pour recevoir et facturer vos premières courses.</p>
      <SetupChecklist items={items} onSelect={setChosen} />
      <Stepper steps={items.map(({ id, label, done }) => ({ id, label, done }))} current={current} />
      <Card className="space-y-4 p-4">
        {current === "legal" ? (
          isDone ? <p>Identité légale enregistrée. Elle se modifie dans les paramètres.</p> : <LegalIdentityStep onDone={next} />
        ) : null}
        {current === "vehicle" ? (
          isDone ? <p>Un véhicule actif est enregistré.</p> : <VehicleForm onSaved={next} />
        ) : null}
        {current === "pricing" ? (
          isDone ? <p>Un tarif actif est enregistré.</p> : <RuleForm onSaved={next} />
        ) : null}
        {current === "address" ? (
          <>
            <p>{isDone ? "Adresse enregistrée." : "L'adresse de l'entreprise figure sur vos factures."}</p>
            <AppLink to="/app/settings" className={linkClass}>Renseigner l'adresse</AppLink>
          </>
        ) : null}
        {current === "driver_profile" ? (
          <>
            <p>{isDone ? "Profil chauffeur créé." : "Complétez votre fiche chauffeur."}</p>
            <AppLink to="/app/profile" className={linkClass}>Ouvrir le profil</AppLink>
          </>
        ) : null}
        {current === "payment_account" ? (
          <>
            <p>{isDone ? "Compte de paiement connecté." : "Connectez votre compte de paiement pour encaisser en ligne."}</p>
            <AppLink to="/app/dashboard" className={linkClass}>Connecter le paiement</AppLink>
          </>
        ) : null}
        {isDone && ["legal", "vehicle", "pricing"].includes(current) ? (
          <button type="button" onClick={next} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold">
            Étape suivante
          </button>
        ) : null}
      </Card>
      {blockingDone ? (
        <AppLink to="/app/dashboard" className={linkClass}>Terminer et ouvrir le tableau de bord</AppLink>
      ) : null}
    </div>
  );
}

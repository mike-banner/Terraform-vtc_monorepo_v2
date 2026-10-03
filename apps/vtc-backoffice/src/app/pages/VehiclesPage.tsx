import { VehicleList } from "@/components/vehicles/VehicleList";
import { Button, Skeleton } from "@/ui";
import { useProfile } from "../auth/useSession";
import { PageHeader } from "../shell/PageHeader";

export default function VehiclesPage() {
  const { profile } = useProfile();
  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Véhicules"
        // VehicleList écoute cet évènement pour ouvrir sa fenêtre de création.
        action={<Button onClick={() => window.dispatchEvent(new CustomEvent("vehicles:open-modal"))}>Nouveau</Button>}
      />
      {profile?.tenantId ? <VehicleList tenantId={profile.tenantId} /> : <Skeleton />}
    </div>
  );
}

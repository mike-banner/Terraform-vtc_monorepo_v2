import { useState } from "react";
import { VehicleList } from "@/features/vehicles/VehicleList";
import { Button, Skeleton } from "@/ui";
import { useOnline } from "../useOnline";
import { useProfile } from "../auth/useSession";
import { PageHeader } from "../shell/PageHeader";

export default function VehiclesPage() {
  const { profile } = useProfile();
  const { canWrite } = useOnline();
  const [creating, setCreating] = useState(false);
  return (
    <div className="page">
      <PageHeader
        title="Véhicules"
        action={
          <Button onClick={() => setCreating(true)} disabled={!canWrite}>
            Nouveau
          </Button>
        }
      />
      {profile?.tenantId ? <VehicleList tenantId={profile.tenantId} creating={creating} onCloseCreate={() => setCreating(false)} /> : <Skeleton />}
    </div>
  );
}

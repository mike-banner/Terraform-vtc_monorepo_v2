import { useCallback, useEffect, useState } from "react";
import { useDialog, useToast } from "@/ui";
import { deleteFixedRoute, getFixedRoutes, getZones } from "./api";
import { RouteCards } from "./RouteCards";
import { RouteSheet } from "./RouteSheet";
import { msgOf, ZonesSheet } from "./ZonesSheet";

/** Zones et forfaits. Les feuilles s'ouvrent par props (`zonesOpen`, `transferOpen`) ; `onClose` ferme celle de la page. */
export function TransferManager({
  tenantId,
  zonesOpen,
  transferOpen,
  onClose,
}: {
  tenantId: string;
  zonesOpen: boolean;
  transferOpen: boolean;
  onClose: () => void;
}) {
  const dialog = useDialog();
  const toast = useToast();
  const [zones, setZones] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRoute, setEditingRoute] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const [z, r] = await Promise.all([getZones(tenantId), getFixedRoutes(tenantId)]);
      setZones(z);
      setRoutes(r);
    } catch (err) {
      toast.show({ message: msgOf(err), tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const closeRoute = () => {
    setEditingRoute(null);
    onClose();
  };

  const handleDeleteRoute = async (id: string) => {
    const ok = await dialog.confirm({ title: "Supprimer ce forfait ?", message: "Cette action est définitive.", confirmLabel: "Supprimer", variant: "danger" });
    if (!ok) return;
    try {
      await deleteFixedRoute(id);
      toast.show({ message: "Forfait supprimé." });
      void fetchData();
    } catch (err) {
      toast.show({ message: msgOf(err), tone: "error" });
    }
  };

  return (
    <div className="space-y-8">
      <RouteCards routes={routes} loading={loading} onEdit={setEditingRoute} onDelete={handleDeleteRoute} />
      <ZonesSheet tenantId={tenantId} zones={zones} open={zonesOpen} onClose={onClose} onChanged={() => void fetchData()} />
      <RouteSheet
        tenantId={tenantId}
        zones={zones}
        editingRoute={editingRoute}
        open={transferOpen || !!editingRoute}
        onClose={closeRoute}
        onSaved={() => void fetchData()}
      />
    </div>
  );
}

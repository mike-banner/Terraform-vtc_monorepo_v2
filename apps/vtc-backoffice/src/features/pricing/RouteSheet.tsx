import { useState, type FormEvent } from "react";
import { useOnline } from "@/app/useOnline";
import { Button, Field, Input, Select, Sheet } from "@/ui";
import { createFixedRoute, updateFixedRoute } from "./api";
import { msgOf } from "./ZonesSheet";

const VEHICLE_CATEGORIES = ["berline", "van", "suv", "minibus", "luxury"];

/** Feuille de création / modification d'un forfait (`editingRoute` renseigné = modification). */
export function RouteSheet({
  tenantId,
  zones,
  editingRoute,
  open,
  onClose,
  onSaved,
}: {
  tenantId: string;
  zones: any[];
  editingRoute: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { canWrite } = useOnline();
  const [routeError, setRouteError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setRouteError("");
    onClose();
  };

  const handleRouteSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (formData.get("pickup") === formData.get("dropoff")) {
      setRouteError("Le départ et l'arrivée doivent être deux zones différentes.");
      return;
    }
    try {
      setSubmitting(true);
      setRouteError("");
      const payload = {
        tenant_id: tenantId,
        pickup_zone_id: formData.get("pickup") as string,
        dropoff_zone_id: formData.get("dropoff") as string,
        vehicle_category: formData.get("category") as string,
        price: parseFloat(formData.get("price") as string),
        is_bidirectional: formData.get("bidirectional") === "on",
      };
      if (editingRoute) await updateFixedRoute(editingRoute.id, payload);
      else await createFixedRoute(payload);
      close();
      onSaved();
    } catch (err) {
      setRouteError(msgOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  const zoneOptions = zones.map((z) => (
    <option key={z.id} value={z.id}>
      {z.name}
    </option>
  ));

  return (
    <Sheet open={open} onClose={close} title={editingRoute ? "Modifier le forfait" : "Nouveau forfait"}>
      {open ? (
        <form onSubmit={handleRouteSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Départ">
              <Select name="pickup" defaultValue={editingRoute?.pickup_zone_id ?? ""} required>
                <option value="">Sélectionner</option>
                {zoneOptions}
              </Select>
            </Field>
            <Field label="Arrivée">
              <Select name="dropoff" defaultValue={editingRoute?.dropoff_zone_id ?? ""} required>
                <option value="">Sélectionner</option>
                {zoneOptions}
              </Select>
            </Field>
            <Field label="Véhicule">
              <Select name="category" defaultValue={editingRoute?.vehicle_category ?? VEHICLE_CATEGORIES[0]} required>
                {VEHICLE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prix fixe (€)">
              <Input name="price" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={editingRoute?.price} required placeholder="0.00" className="tabular-nums" />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
            <input type="checkbox" name="bidirectional" className="size-5 accent-primary" defaultChecked={editingRoute ? editingRoute.is_bidirectional : true} />
            Appliquer dans les deux sens (aller-retour)
          </label>
          {routeError ? <p className="text-xs text-destructive">{routeError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Annuler
            </Button>
            <Button type="submit" loading={submitting} disabled={!canWrite}>
              {editingRoute ? "Mettre à jour le forfait" : "Enregistrer le forfait"}
            </Button>
          </div>
        </form>
      ) : null}
    </Sheet>
  );
}

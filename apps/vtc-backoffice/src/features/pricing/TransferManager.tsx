import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { useOnline } from "@/app/useOnline";
import { analyserCodes } from "@/lib/geo-communes.mjs";
import { Badge, Button, EmptyState, Field, Input, Select, Sheet, Skeleton, useDialog, useToast } from "@/ui";
import {
  createFixedRoute,
  createZone,
  deleteFixedRoute,
  getFixedRoutes,
  getZones,
  proposerCodesPostaux,
  updateFixedRoute,
  updateZonePostalCodes,
} from "./api";

const VEHICLE_CATEGORIES = ["berline", "van", "suv", "minibus", "luxury"];
const msgOf = (err: unknown) => (err instanceof Error && err.message) || "Erreur inattendue";

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
  const { canWrite } = useOnline();
  const dialog = useDialog();
  const toast = useToast();
  const [zones, setZones] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRoute, setEditingRoute] = useState<any>(null);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneCodes, setNewZoneCodes] = useState("");
  const [zoneError, setZoneError] = useState("");
  const [routeError, setRouteError] = useState("");
  const [codesDraft, setCodesDraft] = useState<Record<string, string>>({});
  const [zoneMsg, setZoneMsg] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const routeOpen = transferOpen || !!editingRoute;
  const closeRoute = () => {
    setEditingRoute(null);
    setRouteError("");
    onClose();
  };

  // Remplit le champ sans enregistrer ; la règle de couverture reste côté serveur.
  const remplir = async (nom: string, apply: (codes: string) => void, say: (m: string) => void) => {
    if (!nom.trim()) return say("Saisissez d'abord le nom de la zone.");
    say("Recherche…");
    const r = await proposerCodesPostaux(nom);
    if (r === null) return say("Service indisponible : saisissez les codes à la main");
    const proches = r.proches.length ? ` Communes proches : ${r.proches.join(" ; ")}.` : "";
    if (r.homonymes.length)
      return say(`Plusieurs communes portent ce nom : ${r.homonymes.join(" ; ")}. Précisez le nom, ou saisissez les codes à la main.${proches}`);
    if (!r.commune || r.codes.length === 0)
      return say(`Aucune commune à ce nom exact : saisissez les codes à la main, ou laissez vide pour ne pas contrôler cette zone.${proches}`);
    apply(r.codes.join(", "));
    say(`Commune trouvée : ${r.commune}. Vérifiez que c'est la bonne.${proches}`);
  };

  // Remplissage automatique après une pause de frappe, seulement si les codes sont encore vides.
  useEffect(() => {
    if (newZoneName.trim().length < 3 || newZoneCodes.trim()) return;
    const t = setTimeout(() => remplir(newZoneName, setNewZoneCodes, setZoneError), 700);
    return () => clearTimeout(t);
  }, [newZoneName]);

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

  const saveCodes = async (z: any) => {
    try {
      const codes = analyserCodes(codesDraft[z.id] ?? (z.postal_codes ?? []).join(", "));
      await updateZonePostalCodes(z.id, codes);
      setZoneMsg((m) => ({ ...m, [z.id]: "Enregistré" }));
      void fetchData();
    } catch (err) {
      setZoneMsg((m) => ({ ...m, [z.id]: msgOf(err) }));
    }
  };

  const handleCreateZone = async (e: FormEvent) => {
    e.preventDefault();
    if (!newZoneName) return;
    try {
      setSubmitting(true);
      setZoneError("");
      await createZone(tenantId, newZoneName, analyserCodes(newZoneCodes));
      setNewZoneName("");
      setNewZoneCodes("");
      onClose();
      void fetchData();
    } catch (err) {
      setZoneError(msgOf(err));
    } finally {
      setSubmitting(false);
    }
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
      closeRoute();
      void fetchData();
    } catch (err) {
      setRouteError(msgOf(err));
    } finally {
      setSubmitting(false);
    }
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

  const zoneOptions = zones.map((z) => (
    <option key={z.id} value={z.id}>
      {z.name}
    </option>
  ));

  return (
    <div className="space-y-8">
      {loading ? (
        <Skeleton />
      ) : routes.length === 0 ? (
        <EmptyState title="Aucun forfait configuré" message="Créez d'abord vos zones, puis un forfait point à point." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {routes.map((r) => (
            <div key={r.id} data-route={r.id} className="space-y-4 rounded-(--radius-card) border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <Badge tone="success" className="uppercase">
                  {r.vehicle_category}
                </Badge>
                {r.is_bidirectional ? <ArrowRightLeft aria-label="Aller-retour" className="size-4 text-muted-foreground" /> : null}
              </div>
              <p className="min-w-0 truncate font-bold uppercase">
                {r.pickup_zone?.name} → {r.dropoff_zone?.name}
              </p>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <p className="text-xl font-bold tabular-nums">{r.price} €</p>
                <div className="flex gap-1">
                  <Button variant="ghost" aria-label={`Modifier le forfait ${r.pickup_zone?.name} vers ${r.dropoff_zone?.name}`} disabled={!canWrite} onClick={() => setEditingRoute(r)}>
                    <Pencil aria-hidden="true" className="size-4" />
                  </Button>
                  <Button variant="ghost" aria-label={`Supprimer le forfait ${r.pickup_zone?.name} vers ${r.dropoff_zone?.name}`} disabled={!canWrite} onClick={() => handleDeleteRoute(r.id)}>
                    <Trash2 aria-hidden="true" className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={zonesOpen} onClose={onClose} title="Zones">
        <p className="mb-4 text-sm text-muted-foreground">Points de départ et d'arrivée (ex : Paris, CDG).</p>
        <div className="mb-6 space-y-3">
          {zones.map((z) => (
            <div key={z.id} data-zone={z.id} className="space-y-2 rounded-xl border border-border bg-background p-3">
              <p className="text-sm font-bold uppercase">{z.name}</p>
              <Input
                aria-label={`Codes postaux de ${z.name}`}
                value={codesDraft[z.id] ?? (z.postal_codes ?? []).join(", ")}
                onChange={(e) => setCodesDraft((d) => ({ ...d, [z.id]: e.target.value }))}
                placeholder="Codes postaux (ex : 75001, 75002)"
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    remplir(
                      z.name,
                      (c) => setCodesDraft((d) => ({ ...d, [z.id]: c })),
                      (m) => setZoneMsg((x) => ({ ...x, [z.id]: m })),
                    )
                  }
                >
                  Remplir
                </Button>
                <Button disabled={!canWrite} onClick={() => saveCodes(z)}>
                  Enregistrer
                </Button>
              </div>
              {zoneMsg[z.id] ? <p className="text-xs text-muted-foreground">{zoneMsg[z.id]}</p> : null}
            </div>
          ))}
          {zones.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Aucune zone existante.</p> : null}
        </div>

        <p className="mb-1 text-xs text-muted-foreground">Vide = zone jamais contrôlée (aéroport, parc).</p>
        <p className="mb-4 text-xs text-muted-foreground">
          Le bouton Remplir ne trouve que les communes au nom exact : « Paris » oui, « Lyon centre » non ; dans ce cas saisissez les codes à la main (ex. 69001, 69002).
        </p>
        <form onSubmit={handleCreateZone} className="space-y-3">
          <Field label="Nouvelle zone">
            <Input value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} placeholder="Nom de la zone (ex : Orly)" className="uppercase" />
          </Field>
          <Field label="Codes postaux de la nouvelle zone">
            <Input value={newZoneCodes} onChange={(e) => setNewZoneCodes(e.target.value)} placeholder="Codes postaux (ex : 75001, 75002)" />
          </Field>
          <Button variant="secondary" className="w-full" onClick={() => remplir(newZoneName, setNewZoneCodes, setZoneError)}>
            Remplir
          </Button>
          {zoneError ? <p className="text-xs text-destructive">{zoneError}</p> : null}
          <Button type="submit" className="w-full" loading={submitting} disabled={!canWrite}>
            Ajouter la zone
          </Button>
        </form>
      </Sheet>

      <Sheet open={routeOpen} onClose={closeRoute} title={editingRoute ? "Modifier le forfait" : "Nouveau forfait"}>
        {routeOpen ? (
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
              <Button variant="secondary" onClick={closeRoute}>
                Annuler
              </Button>
              <Button type="submit" loading={submitting} disabled={!canWrite}>
                {editingRoute ? "Mettre à jour le forfait" : "Enregistrer le forfait"}
              </Button>
            </div>
          </form>
        ) : null}
      </Sheet>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { useOnline } from "@/app/useOnline";
import { analyserCodes } from "@/lib/geo-communes.mjs";
import { Button, Field, Input, Sheet } from "@/ui";
import { createZone, proposerCodesPostaux, updateZonePostalCodes } from "./api";

export const msgOf = (err: unknown) => (err instanceof Error && err.message) || "Erreur inattendue";

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

/** Feuille « Zones » : codes postaux des zones existantes et création d'une zone. */
export function ZonesSheet({
  tenantId,
  zones,
  open,
  onClose,
  onChanged,
}: {
  tenantId: string;
  zones: any[];
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { canWrite } = useOnline();
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneCodes, setNewZoneCodes] = useState("");
  const [zoneError, setZoneError] = useState("");
  const [codesDraft, setCodesDraft] = useState<Record<string, string>>({});
  const [zoneMsg, setZoneMsg] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Remplissage automatique après une pause de frappe, seulement si les codes sont encore vides.
  useEffect(() => {
    if (newZoneName.trim().length < 3 || newZoneCodes.trim()) return;
    const t = setTimeout(() => remplir(newZoneName, setNewZoneCodes, setZoneError), 700);
    return () => clearTimeout(t);
  }, [newZoneName]);

  const saveCodes = async (z: any) => {
    try {
      const codes = analyserCodes(codesDraft[z.id] ?? (z.postal_codes ?? []).join(", "));
      await updateZonePostalCodes(z.id, codes);
      setZoneMsg((m) => ({ ...m, [z.id]: "Enregistré" }));
      onChanged();
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
      onChanged();
    } catch (err) {
      setZoneError(msgOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Zones">
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
  );
}

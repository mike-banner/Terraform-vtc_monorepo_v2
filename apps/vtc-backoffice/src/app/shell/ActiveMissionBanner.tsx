import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { bookingKeys } from "@/features/bookings/keys";
import { terrainTransition, type ActiveMission } from "@/features/missions/api";
import { Button, Field, Input, Sheet, useToast } from "@/ui";
import { bookingUrl } from "../links";
import { useOnline } from "../useOnline";

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

function enRouteAt(m: ActiveMission): Date {
  const match = m.mission_note?.match(/\[terrain\] en_route_at=([^\s\n]+)/);
  return match ? new Date(match[1]) : new Date(m.pickup_time);
}

/** Bandeau de course en cours : « Terminer », avec correction de l'heure de fin au-delà de 4 h. Écriture par terrain_transition uniquement. */
export function ActiveMissionBanner({ mission }: { mission: ActiveMission | null | undefined }) {
  const { canWrite, offlineMessage } = useOnline();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [endAt, setEndAt] = useState("");
  if (!mission) return null;

  const complete = async (correctedAt?: string) => {
    setBusy(true);
    try {
      await terrainTransition({ bookingId: mission.id, action: "completed", correctedAt });
      setOpen(false);
      await qc.invalidateQueries({ queryKey: bookingKeys.all });
      toast.show({ message: "Course terminée." });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : "Erreur", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const start = enRouteAt(mission);
  const onTerminate = () => {
    const now = new Date();
    if ((now.getTime() - start.getTime()) / 3_600_000 > 4) {
      setEndAt(toLocalInput(now));
      setOpen(true);
    } else void complete();
  };

  return (
    <div data-mission-banner className="flex items-center justify-between gap-3 border-t border-success bg-success-soft px-4 py-2 text-success-foreground">
      <Link to={bookingUrl(mission.id)} className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase">Mission en cours</span>
        <span className="block truncate text-sm">{mission.dropoff_address.split(",")[0].trim()}</span>
      </Link>
      <div className="flex flex-col items-end">
        <Button onClick={onTerminate} disabled={!canWrite} loading={busy} title={canWrite ? undefined : offlineMessage}>
          Terminer
        </Button>
        {canWrite ? null : <span className="text-xs">{offlineMessage}</span>}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Fin de course">
        <p className="mb-4 text-sm text-muted-foreground">La mission est en cours depuis plus de 4 h. Quelle était l'heure réelle de fin ?</p>
        <Field label="Heure réelle de fin">
          <Input type="datetime-local" value={endAt} min={toLocalInput(start)} max={toLocalInput(new Date())} onChange={(e) => setEndAt(e.target.value)} />
        </Field>
        <div className="mt-4 flex flex-col gap-2">
          <Button disabled={!canWrite || !endAt} loading={busy} onClick={() => complete(new Date(endAt).toISOString())}>
            Confirmer l'heure corrigée
          </Button>
          <Button variant="secondary" disabled={!canWrite} loading={busy} onClick={() => complete()}>
            Utiliser l'heure actuelle
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

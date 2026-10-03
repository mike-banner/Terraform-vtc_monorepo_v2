import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { bookingKeys } from "@/features/bookings/keys";
import { terrainTransition, type ActiveMission } from "@/features/missions/api";
import { EndTimeSheet, enRouteAt, needsEndCorrection } from "@/features/missions/EndTimeSheet";
import { Button, useToast } from "@/ui";
import { bookingUrl } from "../links";
import { useOnline } from "../useOnline";

/** Bandeau de course en cours : « Terminer », avec correction de l'heure de fin au-delà de 4 h. Écriture par terrain_transition uniquement. */
export function ActiveMissionBanner({ mission }: { mission: ActiveMission | null | undefined }) {
  const { canWrite, offlineMessage } = useOnline();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const start = enRouteAt(mission.mission_note, mission.pickup_time);
  const onTerminate = () => {
    const now = new Date();
    if (needsEndCorrection(start, now)) setOpen(true);
    else void complete();
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
      <EndTimeSheet open={open} onClose={() => setOpen(false)} start={start} busy={busy} canWrite={canWrite} onConfirm={(c) => void complete(c)} />
    </div>
  );
}

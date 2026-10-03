import { useState } from "react";
import { Button, Field, Input, Sheet } from "@/ui";

export const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/** Heure de passage « en route » lue dans le journal de mission ; repli sur l'heure de prise en charge. */
export function enRouteAt(missionNote: string | null, pickupTime: string): Date {
  const match = missionNote?.match(/\[terrain\] en_route_at=([^\s\n]+)/);
  return new Date(match ? match[1] : pickupTime);
}

/** Au-delà de 4 h depuis « en route », l'heure réelle de fin est demandée. */
export const needsEndCorrection = (start: Date, now: Date = new Date()) => (now.getTime() - start.getTime()) / 3_600_000 > 4;

type Props = { start: Date; busy: boolean; canWrite: boolean; onConfirm: (correctedAt?: string) => void };

function Body({ start, busy, canWrite, onConfirm }: Props) {
  const [endAt, setEndAt] = useState(() => toLocalInput(new Date()));
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">La mission est en cours depuis plus de 4 h. Quelle était l'heure réelle de fin ?</p>
      <Field label="Heure réelle de fin">
        <Input type="datetime-local" value={endAt} min={toLocalInput(start)} max={toLocalInput(new Date())} onChange={(e) => setEndAt(e.target.value)} />
      </Field>
      <div className="mt-4 flex flex-col gap-2">
        <Button disabled={!canWrite || !endAt} loading={busy} onClick={() => onConfirm(new Date(endAt).toISOString())}>
          Confirmer l'heure corrigée
        </Button>
        <Button variant="secondary" disabled={!canWrite} loading={busy} onClick={() => onConfirm()}>
          Utiliser l'heure actuelle
        </Button>
      </div>
    </>
  );
}

/** Correction de l'heure de fin (bornes : en route <= fin <= maintenant), partagée par le bandeau et la fiche. */
export function EndTimeSheet({ open, onClose, ...p }: Props & { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Fin de course">
      {open ? <Body {...p} /> : null}
    </Sheet>
  );
}

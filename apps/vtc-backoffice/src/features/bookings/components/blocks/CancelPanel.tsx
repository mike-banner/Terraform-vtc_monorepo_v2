import { useState } from "react";
import { Button, Field, Input, Select, Textarea, useDialog } from "@/ui";
import { useOnline } from "@/app/useOnline";
import { formatEur } from "../../format";
import { useDebounced } from "../../hooks";
import { useCancelBooking, useMarkNoShow, useRetryRefund } from "../../mutations";
import { useCancellationPreview } from "../../queries";
import type { Capabilities } from "../../statuses";
import type { BookingRow } from "../../types";
import { ActionButton } from "./ActionButton";

const CASE_LABELS: Record<string, string> = {
  client: "Client, dans les délais",
  no_show: "Client absent",
  driver_fault: "Faute du chauffeur",
  other: "Autre motif",
};

// Saisie en pourcentage -> fraction attendue par le serveur. Simple changement d'unité : aucun montant n'est calculé ici.
const toFraction = (pct: string): number | undefined => {
  const v = Number(pct);
  return pct.trim() !== "" && Number.isFinite(v) && v >= 0 && v <= 100 ? Number((v * 0.01).toFixed(4)) : undefined;
};

/** Annulation (4 cas, montant renvoyé par cancellation_preview), « non réalisée » et reprise d'un remboursement échoué. */
export function CancelPanel({ booking, caps }: { booking: BookingRow; caps: Pick<Capabilities, "cancelMode" | "canRetryRefund"> }) {
  const retry = useRetryRefund();
  if (!caps.cancelMode && !caps.canRetryRefund) return null;
  return (
    <section aria-label="Annulation" className="space-y-3">
      {caps.cancelMode ? <Form key={caps.cancelMode} booking={booking} mode={caps.cancelMode} /> : null}
      {caps.canRetryRefund ? (
        <ActionButton variant="secondary" loading={retry.isPending} onClick={() => retry.mutate({ bookingId: booking.id })}>
          Relancer le remboursement
        </ActionButton>
      ) : null}
    </section>
  );
}

function Form({ booking, mode }: { booking: BookingRow; mode: "cancel" | "no_show" }) {
  const dialog = useDialog();
  const { canWrite, offlineMessage } = useOnline();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState("");
  const [pct, setPct] = useState("");
  const [reason, setReason] = useState("");
  const rate = toFraction(useDebounced(pct, 300));
  const isNoShow = mode === "no_show";
  const preview = useCancellationPreview(booking.id, rate, open && !isNoShow);
  const cancel = useCancelBooking();
  const noShow = useMarkNoShow();

  const rows = isNoShow || !open ? [] : (preview.data ?? []);
  const current = rows.find((r) => r.case_code === chosen) ?? rows[0];
  const rateEditable = current?.case_code === "no_show" || current?.case_code === "other";
  const refunded = current?.paid && current.amount !== null ? current.amount : null;
  const pending = cancel.isPending || noShow.isPending;
  const close = () => { setOpen(false); setReason(""); setPct(""); setChosen(""); };

  const submit = async () => {
    const note = reason.trim();
    if (!note) return;
    const ok = await dialog.confirm({
      title: isNoShow ? "Marquer la course comme non réalisée ?" : "Annuler la course ?",
      message: refunded !== null ? `Montant remboursé : ${formatEur(refunded)}` : undefined,
      confirmLabel: isNoShow ? "Confirmer : non réalisée" : "Confirmer l'annulation",
      variant: "danger",
    });
    if (!ok) return;
    if (isNoShow) noShow.mutate({ bookingId: booking.id, reason: note }, { onSuccess: close });
    else if (current) cancel.mutate({ bookingId: booking.id, case: current.case_code, rate: rateEditable ? rate : undefined, note }, { onSuccess: close });
  };

  if (!open) {
    return (
      <div className="space-y-1">
        <ActionButton variant="danger" onClick={() => setOpen(true)}>
          {isNoShow ? "Non réalisée (client absent)" : "Annuler la course"}
        </ActionButton>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {isNoShow
          ? "La prise en charge est passée : la course est clôturée comme non réalisée, sans encaissement. Un motif est obligatoire."
          : "Convention VTC : un motif d'annulation est obligatoire et sera conservé dans le dossier."}
      </p>
      {isNoShow ? null : (
        <>
          <Field label="Cas d'annulation">
            <Select value={current?.case_code ?? ""} onChange={(e) => { setChosen(e.target.value); setPct(""); }} disabled={!canWrite}>
              {rows.map((r) => (
                <option key={r.case_code} value={r.case_code}>
                  {CASE_LABELS[r.case_code] ?? r.case_code} : {!r.paid ? "aucun paiement à rembourser" : r.rate === null ? "remboursement au taux choisi" : `remboursement ${r.rate.toLocaleString("fr-FR", { style: "percent" })} (${formatEur(Number(r.amount))})`}
                </option>
              ))}
            </Select>
          </Field>
          {rateEditable ? (
            <Field label="Taux de remboursement (%)">
              <Input type="number" min={0} max={100} inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value)} disabled={!canWrite} />
            </Field>
          ) : null}
          {preview.isError ? <p role="alert" className="text-sm text-destructive">{preview.error.message}</p> : null}
          {refunded !== null ? <p className="text-sm font-bold">Montant remboursé : {formatEur(refunded)}</p> : null}
        </>
      )}
      <Field label="Motif (obligatoire)">
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {canWrite ? null : <p className="text-xs text-muted-foreground">{offlineMessage}</p>}
      <div className="flex gap-2">
        <ActionButton variant="danger" loading={pending} disabled={!reason.trim() || (!isNoShow && !current)} onClick={() => void submit()}>
          {isNoShow ? "Confirmer : non réalisée" : "Confirmer l'annulation"}
        </ActionButton>
        <Button variant="secondary" disabled={pending} onClick={close}>
          Retour
        </Button>
      </div>
    </div>
  );
}

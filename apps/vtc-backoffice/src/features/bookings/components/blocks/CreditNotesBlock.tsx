import { useState } from "react";
import { z } from "zod";
import { Field, Input, Sheet, Textarea, useToast } from "@/ui";
import { creditNotePdf } from "../../api";
import { formatEur } from "../../format";
import { useIssueCreditNote } from "../../mutations";
import { useCreditNoteRemaining, useCreditNotes } from "../../queries";
import type { BookingRow } from "../../types";
import { ActionButton } from "./ActionButton";

/** Avoirs d'une facture FAC- : le reste à créditer vient du serveur (credit_note_remaining), le serveur refait tous les contrôles. */
export function CreditNotesBlock({ booking }: { booking: BookingRow }) {
  const toast = useToast();
  const remaining = useCreditNoteRemaining(booking.id, true);
  const notes = useCreditNotes(booking.id, true);
  const issue = useIssueCreditNote();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const left = remaining.data;

  const openPdf = async (id: string) => {
    try {
      const r = await creditNotePdf(id);
      if (r.url) window.open(r.url, "_blank", "noopener");
    } catch (e) {
      toast.show({ tone: "error", message: e instanceof Error ? e.message : "Une erreur est survenue." });
    }
  };

  const submit = () => {
    // Confort : le serveur refait le contrôle du reste à créditer.
    const schema = z.object({
      amount: z.number({ invalid_type_error: "Montant invalide." }).positive("Le montant doit être positif.").refine((n) => left == null || n <= left, "Montant supérieur au reste à créditer."),
      reason: z.string().trim().min(1, "Le motif est obligatoire."),
    });
    const r = schema.safeParse({ amount: Number(amount.replace(",", ".")), reason });
    if (!r.success) return setError(r.error.issues[0].message);
    setError(undefined);
    issue.mutate({ bookingId: booking.id, ...r.data }, { onSuccess: () => { setOpen(false); setAmount(""); setReason(""); } });
  };

  return (
    <section aria-label="Avoirs" className="space-y-2">
      <h3 className="text-sm font-bold text-muted-foreground">Avoirs</h3>
      {left != null ? <p className="text-sm">Reste à créditer : {formatEur(left)}</p> : null}
      <ul className="space-y-1 text-sm">
        {(notes.data ?? []).map((n) => (
          <li key={n.id} className="flex items-center justify-between gap-2">
            <span>
              {n.number} - {formatEur(Number(n.amount_ttc))}
            </span>
            <ActionButton variant="ghost" aria-label={`PDF de l'avoir ${n.number}`} onClick={() => void openPdf(n.id)}>
              PDF
            </ActionButton>
          </li>
        ))}
      </ul>
      {left != null && left <= 0 ? null : (
        <ActionButton variant="secondary" onClick={() => setOpen(true)}>
          Émettre un avoir
        </ActionButton>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Émettre un avoir">
        <div className="space-y-4">
          <Field label="Montant TTC (€)" error={error?.startsWith("Montant") || error?.startsWith("Le montant") ? error : undefined}>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Motif" error={error?.startsWith("Le motif") ? error : undefined}>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <ActionButton loading={issue.isPending} onClick={submit}>
            Émettre l'avoir
          </ActionButton>
        </div>
      </Sheet>
    </section>
  );
}

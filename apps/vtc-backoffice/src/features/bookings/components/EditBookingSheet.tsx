import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useProfile } from "@/app/auth/useSession";
import { useOnline } from "@/app/useOnline";
import { Button, Field, Input, Sheet, zodResolver } from "@/ui";
import { formatEur } from "../format";
import { useUpdateBookingDetails } from "../mutations";
import { useQuoteEstimate } from "../queries";
import { buildUpdatePayload, editBookingSchema, toLocalInput, type EditBookingValues } from "../schemas";
import type { BookingRow } from "../types";

const initialOf = (b: BookingRow): EditBookingValues => ({
  booking_type: b.booking_type === "hourly" ? "hourly" : "transfer",
  pickup_time: toLocalInput(b.pickup_time),
  pickup_address: b.pickup_address,
  dropoff_address: b.dropoff_address ?? "",
  duration_hours: String(b.duration_hours ?? 1),
  manual_total: Number(b.total_amount).toFixed(2),
});

/** Édition avant la mission. Mise à disposition : un changement de durée propose un nouveau montant (RPC), corrigeable. */
export function EditBookingSheet({ booking: b, open, onClose }: { booking: BookingRow; open: boolean; onClose: () => void }) {
  const { profile } = useProfile();
  const { canWrite, offlineMessage } = useOnline();
  const update = useUpdateBookingDetails();
  const touched = useRef(false);
  const canEditPrice = profile?.role === "owner" || profile?.role === "manager";
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<EditBookingValues>({
    resolver: zodResolver(editBookingSchema),
    defaultValues: initialOf(b),
  });

  useEffect(() => {
    if (!open) return;
    touched.current = false;
    reset(initialOf(b));
    // Réinitialisé à l'ouverture seulement : une mise à jour temps réel ne doit pas écraser la saisie.
  }, [open, b.id, reset]);

  const hourly = b.booking_type === "hourly";
  const hours = Number(watch("duration_hours").replace(",", "."));
  const changed = hourly && canEditPrice && !!b.vehicle_id && hours > 0 && hours !== Number(b.duration_hours ?? 1);
  const estimate = useQuoteEstimate({ vehicleId: changed ? (b.vehicle_id ?? "") : "", bookingType: "hourly", durationHours: hours || undefined });
  const price = estimate.data;
  useEffect(() => {
    if (changed && price != null && !touched.current) setValue("manual_total", price.toFixed(2));
  }, [changed, price, setValue]);

  const submit = handleSubmit((values) =>
    update.mutate({ bookingId: b.id, payload: buildUpdatePayload(b, values) }, { onSuccess: onClose }),
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Modifier la course"
      footer={
        <div className="space-y-2">
          {canWrite ? null : <p className="text-xs text-muted-foreground">{offlineMessage}</p>}
          <Button type="submit" form="edit-booking-form" className="w-full" loading={update.isPending} disabled={!canWrite}>
            Enregistrer les modifications
          </Button>
        </div>
      }
    >
      <form id="edit-booking-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Date et heure de prise en charge" error={errors.pickup_time?.message}>
          <Input type="datetime-local" {...register("pickup_time")} />
        </Field>
        <Field label="Adresse de départ" error={errors.pickup_address?.message}>
          <Input {...register("pickup_address")} />
        </Field>
        {hourly ? (
          <Field label="Durée (heures)" error={errors.duration_hours?.message}>
            <Input type="number" inputMode="numeric" min="1" max="8760" {...register("duration_hours")} />
          </Field>
        ) : (
          <Field label="Adresse d'arrivée" error={errors.dropoff_address?.message}>
            <Input {...register("dropoff_address")} />
          </Field>
        )}
        <Field
          label="Montant TTC (€)"
          error={errors.manual_total?.message}
          hint={
            !canEditPrice
              ? "Seuls le propriétaire et le gérant modifient le montant."
              : price != null && changed
                ? `Montant proposé par le serveur : ${formatEur(price)} (corrigeable). La TVA est recalculée à l'enregistrement.`
                : "La TVA est recalculée par le serveur à l'enregistrement."
          }
        >
          <Input
            type="number"
            inputMode="decimal"
            min="0.01"
            max="99999"
            step="0.01"
            readOnly={!canEditPrice}
            {...register("manual_total", { onChange: () => (touched.current = true) })}
          />
        </Field>
      </form>
    </Sheet>
  );
}

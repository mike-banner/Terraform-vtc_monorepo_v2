import { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useOnline } from "@/app/useOnline";
import { Button, Field, Input, Select, Sheet, Textarea, useToast, zodResolver } from "@/ui";
import { formatEur } from "../format";
import { useCreateManualBooking } from "../mutations";
import { useBookingFormData, useQuoteEstimate } from "../queries";
import { matchFixedRoute, newBookingSchema, PAYMENT_LABELS, type NewBookingValues } from "../schemas";

const num = (s: string) => Number(s.replace(",", "."));
const EMPTY: NewBookingValues = {
  booking_type: "transfer", mads_mode: "hour", vehicle_id: "", fixed_route_id: "", client_name: "", client_email: "", pickup: "", dropoff: "",
  pickup_time: "", passenger_count: "1", luggage_count: "0", instructions: "", distance_km: "", duration_hours: "1", manual_total: "", payment_mode: "cash",
};

/** Création manuelle (owner/manager). Le prix affiché vient de quote_booking_estimate ; create_manual_booking recalcule et fait foi. */
export function NewBookingSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { canWrite, offlineMessage } = useOnline();
  const toast = useToast();
  const data = useBookingFormData();
  const create = useCreateManualBooking();
  const touched = useRef(false);
  const form = useForm<NewBookingValues>({ resolver: zodResolver(newBookingSchema), defaultValues: EMPTY });
  const { register, handleSubmit, watch, setValue, setError, reset, formState: { errors } } = form;

  const vehicles = useMemo(() => data.data?.vehicles ?? [], [data.data]);
  const routes = useMemo(() => data.data?.routes ?? [], [data.data]);

  // Ouverture : formulaire vierge, véhicule actif (sinon le premier) présélectionné.
  useEffect(() => {
    if (!open) return;
    touched.current = false;
    reset({ ...EMPTY, vehicle_id: (vehicles.find((v) => v.status === "active") ?? vehicles[0])?.id ?? "" });
  }, [open, vehicles, reset]);

  const w = watch();
  const hourly = w.booking_type === "hourly";
  const vehicle = vehicles.find((v) => v.id === w.vehicle_id);
  const route = hourly ? null : matchFixedRoute(routes, w.fixed_route_id, vehicle?.category ?? "");
  // Mise à disposition au kilomètre : tarif au km côté serveur (comme l'ancien écran), le type enregistré reste « hourly ».
  const estimate = useQuoteEstimate({
    vehicleId: w.vehicle_id,
    bookingType: hourly && w.mads_mode === "hour" ? "hourly" : "transfer",
    distanceKm: hourly && w.mads_mode === "km" ? num(w.distance_km) || undefined : undefined,
    durationHours: hourly && w.mads_mode === "hour" ? num(w.duration_hours) || undefined : undefined,
    fixedRouteId: route?.id,
  });
  const price = estimate.data;

  // Le montant suit l'estimation tant que l'utilisateur n'y a pas touché.
  useEffect(() => {
    if (price != null && !touched.current) setValue("manual_total", price.toFixed(2));
  }, [price, setValue]);

  const forfaits = useMemo(() => {
    const seen = new Map<string, (typeof routes)[number]>();
    for (const r of routes) if (!seen.has(`${r.pickup_zone_id}|${r.dropoff_zone_id}`)) seen.set(`${r.pickup_zone_id}|${r.dropoff_zone_id}`, r);
    return [...seen.values()];
  }, [routes]);

  const onType = () => {
    touched.current = false;
    for (const k of ["pickup", "dropoff", "manual_total", "distance_km", "fixed_route_id"] as const) setValue(k, "");
    setValue("duration_hours", "1");
    setValue("mads_mode", "hour");
  };
  const onForfait = (id: string) => {
    touched.current = false;
    const r = routes.find((x) => x.id === id);
    if (!r) {
      for (const k of ["pickup", "dropoff", "manual_total"] as const) setValue(k, "");
      return;
    }
    setValue("distance_km", "");
    setValue("manual_total", "");
    if (!form.getValues("pickup").trim()) setValue("pickup", `${r.pickup_zone?.name ?? ""} - `);
    if (!form.getValues("dropoff").trim()) setValue("dropoff", `${r.dropoff_zone?.name ?? ""} - `);
  };

  const submit = handleSubmit(async (values) => {
    if (!values.manual_total.trim() && price == null) {
      setError("manual_total", { type: "validation", message: "Indiquez le montant : aucun tarif n'a pu être estimé." });
      return;
    }
    try {
      const row = await create.mutateAsync(values);
      toast.show({ message: "Course créée." });
      onCreated(row.booking_id);
    } catch (e) {
      toast.show({ tone: "error", message: e instanceof Error ? e.message : "Une erreur est survenue." });
    }
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Nouvelle course"
      footer={
        <div className="space-y-2">
          {canWrite ? null : <p className="text-xs text-muted-foreground">{offlineMessage}</p>}
          <Button type="submit" form="new-booking-form" className="w-full" loading={create.isPending} disabled={!canWrite}>
            Confirmer la réservation
          </Button>
        </div>
      }
    >
      <form id="new-booking-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type de course" error={errors.booking_type?.message}>
            <Select {...register("booking_type", { onChange: onType })}>
              <option value="transfer">Transfert</option>
              <option value="hourly">Mise à disposition</option>
            </Select>
          </Field>
          <Field label="Véhicule" error={errors.vehicle_id?.message}>
            <Select {...register("vehicle_id")}>
              <option value="">Sélectionner</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{`${v.brand} ${v.model} — ${v.plate_number}`}</option>
              ))}
            </Select>
          </Field>
        </div>

        {hourly ? (
          <Field label="Facturation" error={errors.mads_mode?.message}>
            <Select {...register("mads_mode")}>
              <option value="hour">À l'heure</option>
              <option value="km">Au kilomètre</option>
            </Select>
          </Field>
        ) : (
          <Field label="Forfait" error={errors.fixed_route_id?.message}>
            <Select {...register("fixed_route_id", { onChange: (e) => onForfait(e.target.value) })}>
              <option value="">Aucun forfait</option>
              {forfaits.map((r) => (
                <option key={r.id} value={r.id}>{`${r.pickup_zone?.name ?? "?"} → ${r.dropoff_zone?.name ?? "?"}`}</option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nom du client" error={errors.client_name?.message}>
            <Input autoComplete="off" {...register("client_name")} />
          </Field>
          <Field label="E-mail du client" error={errors.client_email?.message}>
            <Input type="email" autoComplete="off" {...register("client_email")} />
          </Field>
        </div>

        <Field label="Adresse de départ" error={errors.pickup?.message}>
          <Input {...register("pickup")} />
        </Field>
        <Field label={hourly ? "Adresse de fin (facultatif)" : "Adresse d'arrivée"} error={errors.dropoff?.message}>
          <Input {...register("dropoff")} />
        </Field>
        <Field label="Date et heure de prise en charge" error={errors.pickup_time?.message}>
          <Input type="datetime-local" {...register("pickup_time")} />
        </Field>

        {hourly && w.mads_mode === "km" ? (
          <Field label="Distance (km)" error={errors.distance_km?.message}>
            <Input type="number" inputMode="decimal" min="0" step="0.1" {...register("distance_km")} />
          </Field>
        ) : null}
        {hourly && w.mads_mode === "hour" ? (
          <Field label="Durée (heures)" error={errors.duration_hours?.message}>
            <Input type="number" inputMode="numeric" min="1" max="8760" {...register("duration_hours")} />
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Passagers" error={errors.passenger_count?.message}>
            <Input type="number" inputMode="numeric" min="1" max="8" {...register("passenger_count")} />
          </Field>
          <Field label="Bagages" error={errors.luggage_count?.message}>
            <Input type="number" inputMode="numeric" min="0" max="12" {...register("luggage_count")} />
          </Field>
        </div>
        <Field label="Instructions" error={errors.instructions?.message} hint="N° de vol, panneau d'accueil, bagages…">
          <Textarea rows={2} maxLength={500} {...register("instructions")} />
        </Field>

        <div className="space-y-4 rounded-xl border border-border p-3">
          <p aria-live="polite" className="text-sm">
            {price != null ? (
              <>
                Prix estimé : <strong className="tabular-nums">{formatEur(price)}</strong> (aperçu non contractuel)
              </>
            ) : estimate.isFetching ? (
              "Estimation du prix…"
            ) : estimate.isError ? (
              "Estimation indisponible : saisissez le montant."
            ) : (
              <span className="text-muted-foreground">Le prix estimé apparaît une fois le véhicule et le trajet renseignés.</span>
            )}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Montant TTC (€)" error={errors.manual_total?.message}>
              <Input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                {...register("manual_total", { onChange: () => (touched.current = true) })}
              />
            </Field>
            <Field label="Paiement" error={errors.payment_mode?.message}>
              <Select {...register("payment_mode")}>
                <option value="cash">{PAYMENT_LABELS.cash}</option>
                <option value="card">{PAYMENT_LABELS.card}</option>
              </Select>
            </Field>
          </div>
        </div>
      </form>
    </Sheet>
  );
}

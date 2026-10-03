import { useForm } from "react-hook-form";
import { useProfile } from "@/app/auth/useSession";
import { useOnline } from "@/app/useOnline";
import { Button, Field, Input, Select, useToast, zodResolver } from "@/ui";
import { useCreateVehicle, useUpdateVehicle, type Vehicle } from "./api";
import { CATEGORIES, CATEGORY_LABELS, STATUSES, STATUS_LABELS, vehicleSchema, type VehicleValues } from "./schema";

/** Création si `initial` est absent, modification sinon. Réutilisé par la première connexion guidée. */
export function VehicleForm({ initial, onSaved, onCancel }: { initial?: Vehicle; onSaved: () => void; onCancel?: () => void }) {
  const { profile } = useProfile();
  const tenantId = profile?.tenantId ?? "";
  const { canWrite, offlineMessage } = useOnline();
  const toast = useToast();
  const create = useCreateVehicle(tenantId);
  const update = useUpdateVehicle(tenantId);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VehicleValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      brand: initial?.brand ?? "",
      model: initial?.model ?? "",
      plate_number: initial?.plate_number ?? "",
      category: initial?.category ?? "berline",
      capacity: initial?.capacity ?? 4,
      luggage_capacity: initial?.luggage_capacity ?? 3,
      status: initial?.status ?? "active",
    },
  });

  const submit = handleSubmit(async (values) => {
    try {
      if (initial) await update.mutateAsync({ id: initial.id, values });
      else await create.mutateAsync(values);
      toast.show({ message: initial ? "Véhicule modifié." : "Véhicule créé." });
      onSaved();
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : "Une erreur est survenue.", tone: "error" });
    }
  });

  const pending = create.isPending || update.isPending;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Marque" error={errors.brand?.message}>
          <Input placeholder="Mercedes, Tesla…" {...register("brand")} />
        </Field>
        <Field label="Modèle" error={errors.model?.message}>
          <Input placeholder="Classe E, Model S…" {...register("model")} />
        </Field>
      </div>
      <Field label="Plaque d'immatriculation" error={errors.plate_number?.message}>
        <Input placeholder="AA-123-BB" className="uppercase" {...register("plate_number")} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Catégorie" error={errors.category?.message}>
          <Select {...register("category")}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Statut" error={errors.status?.message}>
          <Select {...register("status")}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Passagers" error={errors.capacity?.message}>
          <Input type="number" inputMode="numeric" {...register("capacity", { valueAsNumber: true })} />
        </Field>
        <Field label="Bagages" error={errors.luggage_capacity?.message}>
          <Input type="number" inputMode="numeric" {...register("luggage_capacity", { valueAsNumber: true })} />
        </Field>
      </div>
      {!canWrite ? <p className="text-xs text-muted-foreground">{offlineMessage}</p> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
        <Button type="submit" loading={pending} disabled={!canWrite}>
          {initial ? "Enregistrer" : "Créer le véhicule"}
        </Button>
      </div>
    </form>
  );
}

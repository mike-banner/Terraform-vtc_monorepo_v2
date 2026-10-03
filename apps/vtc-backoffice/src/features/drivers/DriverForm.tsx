import { useForm } from "react-hook-form";
import { useOnline } from "@/app/useOnline";
import { Button, Field, Input, useToast, zodResolver } from "@/ui";
import { createDriver, updateDriver, useDriverMutation, type Driver } from "./api";
import { driverSchema, type DriverValues } from "./schema";

export function DriverForm({ tenantId, initial, onSaved, onCancel }: { tenantId: string; initial?: Driver; onSaved: () => void; onCancel: () => void }) {
  const { canWrite } = useOnline();
  const toast = useToast();
  const save = useDriverMutation(tenantId, (v: DriverValues) => (initial ? updateDriver(initial.id, v) : createDriver(tenantId, v)));
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DriverValues>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      first_name: initial?.first_name ?? "",
      last_name: initial?.last_name ?? "",
      phone: initial?.phone ?? "",
      license_number: initial?.license_number ?? "",
    },
  });
  const submit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      toast.show({ message: initial ? "Chauffeur modifié." : "Chauffeur créé." });
      onSaved();
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : "Une erreur est survenue.", tone: "error" });
    }
  });
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Prénom" error={errors.first_name?.message}>
          <Input placeholder="Jean" {...register("first_name")} />
        </Field>
        <Field label="Nom" error={errors.last_name?.message}>
          <Input placeholder="Dupont" {...register("last_name")} />
        </Field>
      </div>
      <Field label="Téléphone" error={errors.phone?.message}>
        <Input type="tel" placeholder="06 12 34 56 78" {...register("phone")} />
      </Field>
      <Field label="Carte professionnelle VTC" error={errors.license_number?.message}>
        <Input placeholder="000000000000" {...register("license_number")} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!canWrite}>
          {initial ? "Enregistrer" : "Créer le chauffeur"}
        </Button>
      </div>
    </form>
  );
}

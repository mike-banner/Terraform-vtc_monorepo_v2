import { useState } from "react";
import { useForm } from "react-hook-form";
import { CreditCard, Pencil, Phone } from "lucide-react";
import { useOnline } from "@/app/useOnline";
import { Button, Card, Field, Input, useToast, zodResolver } from "@/ui";
import { updateDriver, useDriverMutation, type Driver } from "@/features/drivers/api";
import { driverSchema, type DriverValues } from "@/features/drivers/schema";

const formatVtc = (v: string) => v.replace(/\D/g, "").slice(0, 12).match(/.{1,3}/g)?.join(" ") ?? "";

/**
 * Fiche du chauffeur connecté. Un `driver` ne peut modifier que son téléphone (trigger
 * drivers_self_update_guard côté base) : les autres champs lui sont donc affichés en lecture seule.
 */
export function EditableDriverCard({ driver, tenantId, role }: { driver: Driver; tenantId: string; role: string | null }) {
  const [editing, setEditing] = useState(false);
  const { canWrite } = useOnline();
  const toast = useToast();
  const phoneOnly = role === "driver";
  const save = useDriverMutation(tenantId, (v: DriverValues) => updateDriver(driver.id, phoneOnly ? { phone: v.phone } : { ...v, license_number: v.license_number.replace(/\s/g, "") }));
  const defaults = { first_name: driver.first_name.trim(), last_name: driver.last_name.trim(), phone: driver.phone ?? "", license_number: formatVtc(driver.license_number ?? "") };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DriverValues>({ resolver: zodResolver(driverSchema), defaultValues: defaults });

  const close = () => {
    reset(defaults);
    setEditing(false);
  };
  const submit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      toast.show({ message: "Fiche enregistrée." });
      setEditing(false);
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : "Erreur lors de la sauvegarde.", tone: "error" });
    }
  });

  return (
    <Card data-testid="own-driver-card" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Chauffeur titulaire</p>
          <h3 className="truncate text-lg font-bold">
            {driver.first_name} {driver.last_name}
          </h3>
        </div>
        {!editing ? (
          <Button variant="ghost" aria-label="Modifier ma fiche" disabled={!canWrite} onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" className="size-4" />
          </Button>
        ) : null}
      </div>
      {editing ? (
        <form onSubmit={submit} noValidate className="max-w-lg space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Prénom" error={errors.first_name?.message}>
              <Input readOnly={phoneOnly} {...register("first_name")} />
            </Field>
            <Field label="Nom" error={errors.last_name?.message}>
              <Input readOnly={phoneOnly} {...register("last_name")} />
            </Field>
          </div>
          <Field label="Téléphone" error={errors.phone?.message}>
            <Input type="tel" placeholder="06 12 34 56 78" {...register("phone")} />
          </Field>
          <Field label="Carte professionnelle VTC" error={errors.license_number?.message}>
            <Input readOnly={phoneOnly} placeholder="000 000 000 000" {...register("license_number", { onChange: (e) => (e.target.value = formatVtc(e.target.value)) })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Annuler
            </Button>
            <Button type="submit" loading={save.isPending} disabled={!canWrite}>
              Enregistrer
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <Phone aria-hidden="true" className="size-4 text-muted-foreground" />
            {driver.phone || "—"}
          </p>
          <p className="flex items-center gap-2 tabular-nums">
            <CreditCard aria-hidden="true" className="size-4 text-muted-foreground" />
            {formatVtc(driver.license_number ?? "") || "—"}
          </p>
        </div>
      )}
    </Card>
  );
}

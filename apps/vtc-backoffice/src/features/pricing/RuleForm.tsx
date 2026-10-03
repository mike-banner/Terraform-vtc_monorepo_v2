import { useForm } from "react-hook-form";
import { useProfile } from "@/app/auth/useSession";
import { useOnline } from "@/app/useOnline";
import { Button, Field, Input, useToast, zodResolver } from "@/ui";
import { useSaveRule, type PricingRule } from "./api";
import { ruleSchema, type RuleValues } from "./schema";

/** Création si `initial` est absent, modification sinon. Réutilisé par la première connexion guidée. */
export function RuleForm({ initial, onSaved, onCancel }: { initial?: PricingRule; onSaved: () => void; onCancel?: () => void }) {
  const { profile } = useProfile();
  const { canWrite, offlineMessage } = useOnline();
  const toast = useToast();
  const save = useSaveRule(profile?.tenantId ?? "");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RuleValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      service_category: initial?.service_category ?? "",
      base_price: initial?.base_price ?? 0,
      price_per_km: initial?.price_per_km ?? 0,
      price_per_hour: initial?.price_per_hour ?? 0,
      minimum_fare: initial?.minimum_fare ?? 0,
      active: initial?.active ?? true,
    },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: initial?.id, values });
      toast.show({ message: initial ? "Tarif modifié." : "Tarif créé." });
      onSaved();
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : "Erreur lors de la sauvegarde.", tone: "error" });
    }
  });

  const money = (name: "base_price" | "price_per_km" | "price_per_hour" | "minimum_fare") =>
    ({ type: "number", step: "0.01", min: "0", inputMode: "decimal", ...register(name, { valueAsNumber: true }) }) as const;

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Nom du service" error={errors.service_category?.message}>
        <Input placeholder="Ex : BUSINESS" className="uppercase" {...register("service_category")} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Base de départ (€)" error={errors.base_price?.message}>
          <Input {...money("base_price")} />
        </Field>
        <Field label="Prix au km (€)" error={errors.price_per_km?.message}>
          <Input {...money("price_per_km")} />
        </Field>
        <Field label="Course minimum (€)" error={errors.minimum_fare?.message}>
          <Input {...money("minimum_fare")} />
        </Field>
        <Field label="Taux horaire, mise à disposition (€)" error={errors.price_per_hour?.message}>
          <Input {...money("price_per_hour")} />
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
        <input type="checkbox" className="size-5 accent-primary" {...register("active")} />
        Tarif actif
      </label>
      {!canWrite ? <p className="text-xs text-muted-foreground">{offlineMessage}</p> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
        <Button type="submit" loading={save.isPending} disabled={!canWrite}>
          {initial ? "Enregistrer" : "Créer le tarif"}
        </Button>
      </div>
    </form>
  );
}

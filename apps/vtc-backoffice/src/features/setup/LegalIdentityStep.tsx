import { useState } from "react";
import { useForm } from "react-hook-form";
import { useProfile } from "@/app/auth/useSession";
import { useOnline } from "@/app/useOnline";
import { Button, Field, Input, Select, useToast, zodResolver } from "@/ui";
import { useCompleteTenantSetup } from "./api";
import { isMicro, LEGAL_FORMS, legalSchema, toLegalPayload, type LegalValues } from "./schema";

/** Appelle complete_tenant_setup directement (plus de POST de page). */
export function LegalIdentityStep({ onDone }: { onDone: () => void }) {
  const { profile } = useProfile();
  const { canWrite, offlineMessage } = useOnline();
  const toast = useToast();
  const save = useCompleteTenantSetup(profile?.tenantId ?? "");
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LegalValues>({
    resolver: zodResolver(legalSchema),
    defaultValues: { legal_form: "auto_entrepreneur", siret: "", vtc_license_number: "", rcs_number: "", capital_social: "", vat_number: "" },
  });
  const micro = isMicro(watch("legal_form"));

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save.mutateAsync(toLegalPayload(values));
      toast.show({ message: "Identité légale enregistrée." });
      onDone();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Une erreur est survenue.";
      setServerError(message);
      toast.show({ message, tone: "error" });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Forme juridique" error={errors.legal_form?.message}>
        <Select {...register("legal_form")}>
          {LEGAL_FORMS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="SIRET" error={errors.siret?.message}>
          <Input inputMode="numeric" placeholder="123 456 789 00012" {...register("siret")} />
        </Field>
        <Field label="Carte professionnelle VTC" hint="12 chiffres" error={errors.vtc_license_number?.message}>
          <Input inputMode="numeric" placeholder="123 456 789 012" {...register("vtc_license_number")} />
        </Field>
      </div>
      {micro ? (
        <p className="text-sm text-muted-foreground">Franchise en base de TVA : aucun numéro de TVA ni capital à renseigner.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="N° RCS" error={errors.rcs_number?.message}>
            <Input placeholder="RCS PARIS 123 456 789" {...register("rcs_number")} />
          </Field>
          <Field label="Capital social (€)" error={errors.capital_social?.message}>
            <Input type="number" min="0" inputMode="decimal" {...register("capital_social")} />
          </Field>
          <Field label="N° TVA intracommunautaire" error={errors.vat_number?.message}>
            <Input placeholder="FR 12 345 678 901" {...register("vat_number")} />
          </Field>
        </div>
      )}
      {serverError ? (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      ) : null}
      {!canWrite ? <p className="text-xs text-muted-foreground">{offlineMessage}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending} disabled={!canWrite}>
          Enregistrer l'identité
        </Button>
      </div>
    </form>
  );
}

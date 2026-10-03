import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useOnline } from "@/app/useOnline";
import { Badge, Button, Field, Input, Select, useToast, zodResolver } from "@/ui";
import { useSaveSettings, type TenantSettings } from "./api";

const LEGAL_FORMS = [
  { value: "auto_entrepreneur", label: "Auto-entrepreneur" },
  { value: "ei", label: "Entreprise individuelle (EI)" },
  { value: "sasu", label: "SASU" },
  { value: "sas", label: "SAS" },
  { value: "eurl", label: "EURL" },
  { value: "sarl", label: "SARL" },
  { value: "other", label: "Autre" },
] as const;
// Affichage du champ « numéro de TVA » seulement ; l'exonération réelle est décidée par la base.
const EXEMPT_FORMS = ["auto_entrepreneur", "ei"];

export const settingsSchema = z
  .object({
    legal_form: z.enum(LEGAL_FORMS.map((f) => f.value) as [string, ...string[]], { message: "Forme juridique invalide." }),
    vat_number: z.string().trim().max(30, "30 caractères au maximum."),
    address_line: z.string().trim().max(200, "200 caractères au maximum."),
    postal_code: z.string().trim().max(10, "10 caractères au maximum."),
    city: z.string().trim().max(100, "100 caractères au maximum."),
  })
  .refine((v) => [v.address_line, v.postal_code, v.city].every(Boolean) || [v.address_line, v.postal_code, v.city].every((x) => !x), {
    path: ["address_line"],
    message: "Renseignez l'adresse, le code postal et la ville, ou aucun des trois.",
  });
type Values = z.infer<typeof settingsSchema>;

const toValues = (t: TenantSettings): Values => ({
  legal_form: t.legal_form ?? "auto_entrepreneur",
  vat_number: t.vat_number ?? "",
  address_line: t.address_line ?? "",
  postal_code: t.postal_code ?? "",
  city: t.city ?? "",
});

export function SettingsForm({ tenantId, tenant }: { tenantId: string; tenant: TenantSettings }) {
  const { canWrite, offlineMessage } = useOnline();
  const toast = useToast();
  const save = useSaveSettings(tenantId);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(settingsSchema), defaultValues: toValues(tenant) });

  // Après enregistrement, le formulaire reprend ce que la base a stocké.
  useEffect(() => reset(toValues(tenant)), [tenant, reset]);

  const exempt = tenant.is_vat_exempt !== false;
  const submit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ ...v, vat_number: EXEMPT_FORMS.includes(v.legal_form) ? null : v.vat_number || null });
      toast.show({ message: "Paramètres enregistrés." });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : "Erreur lors de l'enregistrement.", tone: "error" });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Fiscalité et adresse">
      <p className="text-sm text-muted-foreground">Le taux de TVA est déterminé par la forme juridique. Les prix de votre grille sont traités comme TTC.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Forme juridique" error={errors.legal_form?.message}>
          <Select {...register("legal_form")}>
            {LEGAL_FORMS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="space-y-1">
          <p className="text-sm font-bold">Statut TVA</p>
          <div data-testid="vat-status" className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3">
            <Badge tone={exempt ? "warning" : "success"}>{exempt ? "Exonéré" : "Assujetti"}</Badge>
            <span className="text-sm">{exempt ? "Exonéré (Art. 293 B CGI)" : `Assujetti, ${tenant.vat_rate ?? "?"} %`}</span>
          </div>
        </div>
      </div>
      {!EXEMPT_FORMS.includes(watch("legal_form")) ? (
        <Field label="Numéro de TVA intracommunautaire" error={errors.vat_number?.message}>
          <Input placeholder="FR00 000 000 000" className="font-mono" {...register("vat_number")} />
        </Field>
      ) : null}
      <Field label="Adresse de l'entreprise" error={errors.address_line?.message} hint="Obligatoire pour émettre une facture.">
        <Input maxLength={200} placeholder="Adresse" autoComplete="street-address" {...register("address_line")} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Code postal" error={errors.postal_code?.message}>
          <Input maxLength={10} autoComplete="postal-code" {...register("postal_code")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Ville" error={errors.city?.message}>
            <Input maxLength={100} autoComplete="address-level2" {...register("city")} />
          </Field>
        </div>
      </div>
      {!canWrite ? <p className="text-xs text-muted-foreground">{offlineMessage}</p> : null}
      <Button type="submit" loading={save.isPending} disabled={!canWrite}>
        Enregistrer
      </Button>
    </form>
  );
}

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useOnline } from "@/app/useOnline";
import { Button, ErrorState, Field, Input, Skeleton, useToast, zodResolver } from "@/ui";
import { usePolicy, useUpdatePolicy, type CancellationPolicy } from "./api";
import { cancellationPolicySchema, type CancellationPolicyValues } from "./schema";

const toValues = (p: CancellationPolicy | null | undefined): CancellationPolicyValues => ({
  full_hours: p?.hours_before_full_refund ?? 48,
  partial_hours: p?.hours_before_partial_refund ?? 24,
  partial_rate: p ? Math.round(Number(p.partial_refund_rate) * 100) : 50,
  no_show_rate: p ? Math.round(Number(p.no_show_refund_rate) * 100) : 0,
  driver_fault_rate: p ? Math.round(Number(p.driver_fault_refund_rate) * 100) : 100,
});

const FIELDS = [
  { name: "full_hours", label: "Remboursement total si annulation au moins (h) avant" },
  { name: "partial_hours", label: "Remboursement partiel si annulation au moins (h) avant" },
  { name: "partial_rate", label: "Taux partiel (%)" },
  { name: "no_show_rate", label: "Taux client absent (%)" },
  { name: "driver_fault_rate", label: "Taux faute du chauffeur (%)" },
] as const;

/** Modification réservée à l'owner (garde dans la RPC) ; en lecture seule pour les autres rôles. */
export function CancellationPolicyForm({ tenantId, isOwner }: { tenantId: string; isOwner: boolean }) {
  const { data, isLoading, isError, refetch } = usePolicy(tenantId);
  const { canWrite, offlineMessage } = useOnline();
  const toast = useToast();
  const update = useUpdatePolicy(tenantId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancellationPolicyValues>({ resolver: zodResolver(cancellationPolicySchema), defaultValues: toValues(data) });

  useEffect(() => {
    if (data !== undefined) reset(toValues(data));
  }, [data, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      toast.show({ message: "Politique d'annulation enregistrée." });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : "Erreur lors de l'enregistrement.", tone: "error" });
    }
  });

  if (isLoading) return <Skeleton />;
  if (isError) return <ErrorState message="Impossible de charger la politique d'annulation." onRetry={() => refetch()} />;

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Politique d'annulation">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <Field key={f.name} label={f.label} error={errors[f.name]?.message}>
            <Input type="number" inputMode="numeric" min="0" step="1" disabled={!isOwner} {...register(f.name, { valueAsNumber: true })} />
          </Field>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Les courses déjà réservées gardent la politique en vigueur à leur création.</p>
      {!canWrite ? <p className="text-xs text-muted-foreground">{offlineMessage}</p> : null}
      {isOwner ? (
        <Button type="submit" loading={update.isPending} disabled={!canWrite}>
          Enregistrer la politique
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Seul le propriétaire peut modifier cette politique.</p>
      )}
    </form>
  );
}

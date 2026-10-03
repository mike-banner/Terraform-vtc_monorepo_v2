import { z } from "zod";

const amount = z.number({ message: "Montant requis." }).min(0, "Un montant ne peut pas être négatif.");
const percent = z.number({ message: "Pourcentage requis." }).min(0, "Un pourcentage va de 0 à 100.").max(100, "Un pourcentage va de 0 à 100.");
const hours = z.number({ message: "Délai requis." }).int("Nombre entier requis.").min(0, "Un délai ne peut pas être négatif.").max(720, "720 heures au maximum.");

export const ruleSchema = z.object({
  service_category: z.string().trim().min(1, "Le nom du service est obligatoire."),
  base_price: amount,
  price_per_km: amount,
  price_per_hour: amount,
  minimum_fare: amount,
  active: z.boolean(),
});
export type RuleValues = z.infer<typeof ruleSchema>;

// Mêmes bornes que la RPC update_cancellation_policy (taux de 0 à 1 côté base, saisis ici en %).
export const cancellationPolicySchema = z
  .object({ full_hours: hours, partial_hours: hours, partial_rate: percent, no_show_rate: percent, driver_fault_rate: percent })
  .refine((v) => v.partial_hours <= v.full_hours, { path: ["partial_hours"], message: "Le délai partiel ne peut pas dépasser le délai total." });
export type CancellationPolicyValues = z.infer<typeof cancellationPolicySchema>;

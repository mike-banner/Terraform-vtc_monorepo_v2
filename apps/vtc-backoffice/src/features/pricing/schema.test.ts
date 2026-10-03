import { expect, test } from "vitest";
import { cancellationPolicySchema, ruleSchema } from "./schema";

const rule = { service_category: "BUSINESS", base_price: 5, price_per_km: 1.8, price_per_hour: 45, minimum_fare: 15, active: true };
const policy = { full_hours: 48, partial_hours: 24, partial_rate: 50, no_show_rate: 0, driver_fault_rate: 100 };
const msg = (s: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, v: unknown) => {
  const r = s.safeParse(v);
  return r.success ? null : r.error!.issues[0].message;
};

test("règle valide", () => expect(msg(ruleSchema, rule)).toBeNull());
test("catégorie obligatoire", () => expect(msg(ruleSchema, { ...rule, service_category: "  " })).toBe("Le nom du service est obligatoire."));
test("montants négatifs refusés", () => {
  for (const k of ["base_price", "price_per_km", "price_per_hour", "minimum_fare"])
    expect(msg(ruleSchema, { ...rule, [k]: -1 })).toBe("Un montant ne peut pas être négatif.");
});
test("montant absent refusé", () => expect(msg(ruleSchema, { ...rule, base_price: Number.NaN })).toBe("Montant requis."));

test("politique valide", () => expect(msg(cancellationPolicySchema, policy)).toBeNull());
test("pourcentages bornés de 0 à 100", () => {
  expect(msg(cancellationPolicySchema, { ...policy, partial_rate: 101 })).toBe("Un pourcentage va de 0 à 100.");
  expect(msg(cancellationPolicySchema, { ...policy, no_show_rate: -1 })).toBe("Un pourcentage va de 0 à 100.");
});
test("délai partiel au plus égal au délai total", () =>
  expect(msg(cancellationPolicySchema, { ...policy, partial_hours: 72 })).toBe("Le délai partiel ne peut pas dépasser le délai total."));
test("délais entiers, 720 h au maximum", () => {
  expect(msg(cancellationPolicySchema, { ...policy, full_hours: 721 })).toBe("720 heures au maximum.");
  expect(msg(cancellationPolicySchema, { ...policy, full_hours: 1.5 })).toBe("Nombre entier requis.");
});

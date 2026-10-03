import { expect, test } from "vitest";
import { EMPTY_VALUES, legalFormOf, stepSchemas } from "./schemas";

const msg = (i: 0 | 1 | 2, v: object) => {
  const r = stepSchemas[i].safeParse({ ...EMPTY_VALUES, ...v });
  return r.success ? null : r.error.issues[0].message;
};

test("étape 1 : e-mail et mot de passe", () => {
  expect(msg(0, { email: "x", password: "123456" })).toBe("Adresse e-mail invalide.");
  expect(msg(0, { email: "a@b.fr", password: "123" })).toBe("Le mot de passe compte au moins 6 caractères.");
  expect(msg(0, { email: "a@b.fr", password: "123456" })).toBeNull();
});
test("étape 2 : identité et téléphone", () => {
  expect(msg(1, { first_name: "", last_name: "D", phone_number: "6 12 34 56 78" })).toBe("Saisissez votre prénom.");
  expect(msg(1, { first_name: "J", last_name: "D", phone_number: "12" })).toBe("Numéro de téléphone invalide.");
  expect(msg(1, { first_name: "J", last_name: "D", phone_number: "6 12 34 56 78" })).toBeNull();
});
test("étape 3 : SIRET et carte VTC en chiffres, espaces tolérés", () => {
  const ok = { company_name: "X", primary_domain: "x", siret: "123 456 789 00012", vtc_license_number: "123 456 789 012" };
  expect(msg(2, ok)).toBeNull();
  expect(msg(2, { ...ok, siret: "123" })).toBe("Le SIRET compte 14 chiffres.");
  expect(msg(2, { ...ok, vtc_license_number: "1" })).toBe("La carte VTC compte 12 chiffres.");
});
test("legal_form : auto-entrepreneur prime sur le type de société", () => {
  expect(legalFormOf({ kind: "auto_entrepreneur", company_form: "sarl" })).toBe("auto_entrepreneur");
  expect(legalFormOf({ kind: "societe", company_form: "sarl" })).toBe("sarl");
});

import { expect, test } from "vitest";
import { driverSchema } from "./schema";

const ok = { first_name: "Jean", last_name: "Dupont", phone: "06 12 34 56 78", license_number: "123456789012" };
const msg = (v: unknown) => {
  const r = driverSchema.safeParse(v);
  return r.success ? null : r.error.issues[0].message;
};

test("chauffeur valide", () => {
  expect(msg(ok)).toBeNull();
  expect(msg({ ...ok, phone: "+33612345678" })).toBeNull();
});
test("téléphone non français refusé", () => {
  expect(msg({ ...ok, phone: "+44 7911 123456" })).toBe("Numéro de téléphone français invalide.");
  expect(msg({ ...ok, phone: "abc" })).toBe("Numéro de téléphone français invalide.");
});
test("prénom vide refusé", () => expect(msg({ ...ok, first_name: "" })).toBe("Le prénom est obligatoire."));

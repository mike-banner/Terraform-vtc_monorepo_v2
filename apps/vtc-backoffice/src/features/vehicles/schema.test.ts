import { expect, test } from "vitest";
import { vehicleSchema } from "./schema";

const ok = { brand: "Tesla", model: "Model S", plate_number: "AA-123-BB", category: "berline", capacity: 4, luggage_capacity: 3, status: "active" };
const msg = (v: unknown) => {
  const r = vehicleSchema.safeParse(v);
  return r.success ? null : r.error.issues[0].message;
};

test("véhicule valide", () => expect(msg(ok)).toBeNull());
test("plaque vide refusée", () => expect(msg({ ...ok, plate_number: "  " })).toBe("La plaque est obligatoire."));
test("capacité hors bornes refusée", () => {
  expect(msg({ ...ok, capacity: 0 })).toBe("Au moins 1 passager.");
  expect(msg({ ...ok, capacity: 9 })).toBe("8 passagers au maximum.");
});
test("catégorie hors énumération refusée", () => expect(msg({ ...ok, category: "fusée" })).toBe("Catégorie invalide."));
test("statut hors énumération refusé", () => expect(msg({ ...ok, status: "vendu" })).toBe("Statut invalide."));

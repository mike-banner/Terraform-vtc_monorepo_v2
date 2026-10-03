import { expect, test } from "vitest";
import { isSetupComplete, prerequisiteStatus, type SetupData } from "./prerequisites";

const empty: SetupData = { tenant: null, vehicles: [], rules: [], hasDriverProfile: false };
const tenant = { setup_completed: true, address_line: null, postal_code: null, city: null, stripe_account_id: null };
const done = (d: SetupData, id: string) => prerequisiteStatus(d).find((p) => p.id === id)!.done;

test("tenant vide : aucun prérequis fait", () => {
  expect(prerequisiteStatus(empty).every((p) => !p.done)).toBe(true);
  expect(isSetupComplete(empty)).toBe(false);
});

test("un véhicule actif rend « vehicle » fait, un inactif non", () => {
  expect(done({ ...empty, vehicles: [{ status: "active" }] }, "vehicle")).toBe(true);
  expect(done({ ...empty, vehicles: [{ status: "inactive" }] }, "vehicle")).toBe(false);
});

test("seule une règle active compte", () => {
  expect(done({ ...empty, rules: [{ active: false }] }, "pricing")).toBe(false);
  expect(done({ ...empty, rules: [{ active: true }] }, "pricing")).toBe(true);
});

test("adresse incomplète : non faite", () => {
  expect(done({ ...empty, tenant: { ...tenant, city: "Lyon", postal_code: "69001" } }, "address")).toBe(false);
  expect(done({ ...empty, tenant: { ...tenant, address_line: "1 rue A", city: "Lyon", postal_code: "69001" } }, "address")).toBe(true);
});

test("complet = prérequis bloquants faits, les autres restent facultatifs", () => {
  const d = { ...empty, tenant, vehicles: [{ status: "active" }], rules: [{ active: true }] };
  expect(isSetupComplete(d)).toBe(true);
  expect(done(d, "payment_account")).toBe(false);
  expect(isSetupComplete({ ...d, rules: [] })).toBe(false);
});

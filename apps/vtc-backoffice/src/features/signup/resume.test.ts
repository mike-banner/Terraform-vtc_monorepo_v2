import { expect, test } from "vitest";
import { prefill, resumeStep, splitPhone } from "./resume";

test("sans session : étape 1", () => expect(resumeStep({ signedIn: false })).toBe(0));
test("avec session : étape 2", () => expect(resumeStep({ signedIn: true })).toBe(1));
test("téléphone : préfixe reconnu séparé, sinon +33 par défaut", () => {
  expect(splitPhone("+32470123456")).toEqual({ phone_prefix: "+32", phone_number: "470123456" });
  expect(splitPhone("0612345678")).toEqual({ phone_prefix: "+33", phone_number: "0612345678" });
});
test("préremplissage : aucun dossier, société, auto-entrepreneur", () => {
  expect(prefill("a@b.fr", null).email).toBe("a@b.fr");
  expect(prefill("a@b.fr", { id: "1", legal_form: "sarl" })).toMatchObject({ kind: "societe", company_form: "sarl" });
  expect(prefill("a@b.fr", { id: "1", company_type: "auto_entrepreneur" }).kind).toBe("auto_entrepreneur");
});

import { expect, test } from "vitest";
import { legalSchema, toLegalPayload } from "./schema";

const base = { legal_form: "auto_entrepreneur", siret: "123 456 789 00012", vtc_license_number: "123 456 789 012", rcs_number: "", capital_social: "", vat_number: "" };
const first = (v: unknown) => {
  const r = legalSchema.safeParse(v);
  return r.success ? null : r.error.issues[0].message;
};

test("auto-entrepreneur : RCS, capital et TVA non exigés", () => expect(first(base)).toBeNull());
test("SIRET de 14 chiffres exigé", () => expect(first({ ...base, siret: "123" })).toBe("Le SIRET compte 14 chiffres."));
test("société : RCS, capital et TVA exigés", () => {
  expect(first({ ...base, legal_form: "sasu" })).toBe("Format attendu : RCS PARIS 123 456 789.");
});
test("charge utile : chiffres seuls, TVA préfixée, micro sans capital", () => {
  expect(toLegalPayload(base as never)).toMatchObject({ siret: "12345678900012", vtc_license_number: "123456789012", capital_social: null, vat_number: null });
  const co = toLegalPayload({ ...base, legal_form: "sasu", rcs_number: "rcs paris 123 456 789", capital_social: "1000", vat_number: "FR 12 345 678 901" } as never);
  expect(co).toMatchObject({ rcs_number: "RCS PARIS 123 456 789", capital_social: 1000, vat_number: "FR12345678901" });
});

import { describe, expect, it } from "vitest";
import { buildSearchFilter, sanitizeSearch } from "./search";

describe("sanitizeSearch", () => {
  it("neutralise la virgule", () => expect(sanitizeSearch("a,b")).toBe("a b"));
  it("neutralise les parenthèses", () => expect(sanitizeSearch("x(y)z")).toBe("x y z"));
  it("neutralise % * et antislash", () => {
    expect(sanitizeSearch("ab%cd")).toBe("ab cd");
    expect(sanitizeSearch("ab*cd")).toBe("ab cd");
    expect(sanitizeSearch("ab\\cd")).toBe("ab cd");
  });
  it("moins de 2 caractères : null", () => {
    expect(sanitizeSearch("a")).toBeNull();
    expect(sanitizeSearch("x)")).toBeNull();
    expect(sanitizeSearch(" % ")).toBeNull();
  });
  it("coupe à 100 caractères", () => expect(sanitizeSearch("a".repeat(150))).toHaveLength(100));
  it("conserve une saisie normale", () => expect(sanitizeSearch("  Dupont ")).toBe("Dupont"));
});

describe("buildSearchFilter", () => {
  it("avec clients", () => expect(buildSearchFilter("du", ["1", "2"])).toBe("customer_id.in.(1,2),invoice_number.ilike.%du%"));
  it("sans client", () => expect(buildSearchFilter("FAC", [])).toBe("invoice_number.ilike.%FAC%"));
});

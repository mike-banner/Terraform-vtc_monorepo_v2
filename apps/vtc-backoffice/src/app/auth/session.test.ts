import { describe, expect, it } from "vitest";
import { decodeClaims } from "./session";

const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("decodeClaims", () => {
  it("lit les claims d'un jeton base64url (caractères - et _)", () => {
    // « ??>> » produit « / » en base64 donc « _ » en base64url ; « ~~~ » produit « + » donc « - ».
    const payload = { tenant_id: "t1", tenant_role: "owner", platform_role: null, note: "??>>~~~" };
    const token = `h.${b64url(payload)}.s`;
    expect(token.split(".")[1]).toMatch(/[-_]/);
    expect(decodeClaims(token)).toEqual({ tenant_id: "t1", tenant_role: "owner", platform_role: null });
  });
  it("renvoie null pour un jeton mal formé", () => {
    expect(decodeClaims("abc")).toBeNull();
    expect(decodeClaims("a.!!!.c")).toBeNull();
    expect(decodeClaims("")).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ supabase: { auth: { signInWithPassword: (...a: unknown[]) => signInWithPassword(...a) } } }));

import { demoCredentials, reasonMessage, signIn } from "./login";

describe("demoCredentials", () => {
  it("null si les deux variables sont vides", () => {
    expect(demoCredentials({ DEMO_EMAIL: "", DEMO_PASSWORD: "" })).toBeNull();
  });
  it("null si une seule est fournie", () => {
    expect(demoCredentials({ DEMO_EMAIL: "a@b.c", DEMO_PASSWORD: "" })).toBeNull();
    expect(demoCredentials({ DEMO_EMAIL: "", DEMO_PASSWORD: "x" })).toBeNull();
  });
  it("renvoie les identifiants quand les deux sont fournis", () => {
    expect(demoCredentials({ DEMO_EMAIL: "a@b.c", DEMO_PASSWORD: "x" })).toEqual({ email: "a@b.c", password: "x" });
  });
});

describe("reasonMessage", () => {
  it("texte pour chaque motif connu", () => {
    expect(reasonMessage("suspended")).toMatch(/suspendue/);
    expect(reasonMessage("inactivity")).toMatch(/inactivité/);
    expect(reasonMessage("expired")).toMatch(/expiré/);
  });
  it("null pour une valeur inconnue ou absente", () => {
    expect(reasonMessage("<script>")).toBeNull();
    expect(reasonMessage("toString")).toBeNull();
    expect(reasonMessage(null)).toBeNull();
  });
});

describe("signIn", () => {
  beforeEach(() => signInWithPassword.mockReset());
  it("ok quand Supabase n'a pas d'erreur", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    expect(await signIn("a@b.c", "x")).toEqual({ ok: true });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "a@b.c", password: "x" });
  });
  it("message français pour des identifiants invalides", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    expect(await signIn("a@b.c", "x")).toEqual({ ok: false, message: "Email ou mot de passe incorrect." });
  });
  it("message générique pour toute autre erreur", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "boom" } });
    const r = await signIn("a@b.c", "x");
    expect(r.ok).toBe(false);
  });
});

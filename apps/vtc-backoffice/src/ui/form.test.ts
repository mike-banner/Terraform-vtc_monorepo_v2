import { expect, test } from "vitest";
import { z } from "zod";
import { zodResolver } from "./form";

const schema = z.object({
  nom: z.string().min(1, "Nom requis"),
  a: z.object({ b: z.number({ message: "Nombre requis" }) }),
});
const opts = {} as never;

test("entrée valide", async () => {
  const r = await zodResolver(schema)({ nom: "x", a: { b: 1 } }, undefined, opts);
  expect(r).toEqual({ values: { nom: "x", a: { b: 1 } }, errors: {} });
});

test("entrée invalide : message français du schéma", async () => {
  const r = await zodResolver(schema)({ nom: "", a: { b: 1 } }, undefined, opts);
  expect(r.values).toEqual({});
  expect(r.errors).toEqual({ nom: { type: "validation", message: "Nom requis" } });
});

test("chemin imbriqué remonté avec la clé a.b", async () => {
  const r = await zodResolver(schema)({ nom: "x", a: { b: "z" } } as never, undefined, opts);
  expect(Object.keys(r.errors)).toEqual(["a.b"]);
});

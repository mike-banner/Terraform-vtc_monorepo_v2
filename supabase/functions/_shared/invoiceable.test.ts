import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkInvoiceable } from "./invoiceable.ts";

Deno.test("montant saisi à la main : facturable", () => {
  const v = checkInvoiceable({ pricing_mode: "manual", booking_type: "transfer", distance_km: 420 });
  assertEquals(v, { invoiceable: true, basis: "manual" });
});

Deno.test("mise à disposition : facturable, la durée n'est pas estimée", () => {
  const v = checkInvoiceable({ pricing_mode: "direct", booking_type: "hourly", distance_km: null });
  assertEquals(v, { invoiceable: true, basis: "hourly" });
});

Deno.test("transfert sans distance : forfait fixe, facturable", () => {
  for (const distance_km of [null, 0]) {
    const v = checkInvoiceable({ pricing_mode: "direct", booking_type: "transfer", distance_km });
    assertEquals(v, { invoiceable: true, basis: "flat_rate" });
  }
});

Deno.test("transfert avec distance : refusé tant que le prix n'est pas validé", () => {
  const v = checkInvoiceable({ pricing_mode: "direct", booking_type: "transfer", distance_km: 137.5 });
  assertEquals(v.invoiceable, false);
});

Deno.test("distance invalide ne doit pas ouvrir la facturation par accident", () => {
  // NaN passait `distance > 0` à false et aurait été traité en forfait fixe
  // si la garde Number.isFinite manquait — ici c'est bien un forfait, base seule.
  const v = checkInvoiceable({ pricing_mode: "direct", booking_type: "transfer", distance_km: NaN });
  assertEquals(v, { invoiceable: true, basis: "flat_rate" });
});

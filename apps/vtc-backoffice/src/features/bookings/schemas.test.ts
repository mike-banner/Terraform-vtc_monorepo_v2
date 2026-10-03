import { describe, expect, it } from "vitest";
import { buildUpdatePayload, editBookingSchema, matchFixedRoute, newBookingSchema, toLocalInput, type NewBookingValues } from "./schemas";

const future = toLocalInput(new Date(Date.now() + 86_400_000).toISOString());
const ok: NewBookingValues = {
  booking_type: "transfer", mads_mode: "hour", vehicle_id: "v1", fixed_route_id: "", client_name: "Jeanne Martin", client_email: "j@x.fr",
  pickup: "Gare de Lyon", dropoff: "Orly", pickup_time: future, passenger_count: "1", luggage_count: "0", instructions: "",
  distance_km: "", duration_hours: "1", manual_total: "", payment_mode: "card",
};
const issue = (v: Partial<NewBookingValues>) => {
  const r = newBookingSchema.safeParse({ ...ok, ...v });
  return r.success ? null : `${r.error.issues[0].path.join(".")}: ${r.error.issues[0].message}`;
};

describe("newBookingSchema", () => {
  it("accepte un transfert complet", () => expect(issue({})).toBeNull());
  it("A12 refuse un transfert sans adresse d'arrivée", () => expect(issue({ dropoff: " " })).toBe("dropoff: L'adresse d'arrivée est obligatoire."));
  it("refuse une mise à disposition sans durée ou à durée nulle", () => {
    expect(issue({ booking_type: "hourly", dropoff: "", duration_hours: "" })).toContain("duration_hours");
    expect(issue({ booking_type: "hourly", dropoff: "", duration_hours: "0" })).toContain("duration_hours");
    expect(issue({ booking_type: "hourly", dropoff: "", duration_hours: "-2" })).toContain("duration_hours");
  });
  it("accepte une mise à disposition en heures sans adresse d'arrivée", () => expect(issue({ booking_type: "hourly", dropoff: "", duration_hours: "3" })).toBeNull());
  it("exige une distance en mode kilomètre", () => {
    expect(issue({ booking_type: "hourly", mads_mode: "km", dropoff: "" })).toContain("distance_km");
    expect(issue({ booking_type: "hourly", mads_mode: "km", dropoff: "", distance_km: "12,5" })).toBeNull();
  });
  it("refuse une date passée", () => expect(issue({ pickup_time: "2020-01-01T10:00" })).toBe("pickup_time: La date doit être dans le futur."));
  it("refuse un montant négatif, nul ou au-delà du plafond serveur", () => {
    expect(issue({ manual_total: "-5" })).toContain("manual_total");
    expect(issue({ manual_total: "0" })).toContain("manual_total");
    expect(issue({ manual_total: "100000" })).toContain("manual_total");
    expect(issue({ manual_total: "99999" })).toBeNull();
  });
  it("n'accepte que carte et espèces", () => {
    expect(issue({ payment_mode: "stripe" as never })).toContain("payment_mode");
    expect(issue({ payment_mode: "cash" })).toBeNull();
  });
  it("refuse un e-mail invalide et un véhicule absent", () => {
    expect(issue({ client_email: "nope" })).toContain("client_email");
    expect(issue({ vehicle_id: "" })).toContain("vehicle_id");
  });
});

describe("editBookingSchema et buildUpdatePayload", () => {
  const edit = { booking_type: "transfer" as const, pickup_time: future, pickup_address: "A", dropoff_address: "B", duration_hours: "", manual_total: "50.00" };
  it("manual_total est optionnel", () => expect(editBookingSchema.safeParse({ ...edit, manual_total: "" }).success).toBe(true));
  it("refuse une durée vide en mise à disposition, message en français", () => {
    const r = editBookingSchema.safeParse({ ...edit, booking_type: "hourly" });
    expect(r.success ? "" : r.error.issues[0].message).toBe("Indiquez une durée supérieure à 0.");
  });
  it("A13 manual_total absent du payload s'il est inchangé", () => {
    expect(buildUpdatePayload({ total_amount: 50 }, edit)).not.toHaveProperty("manual_total");
    expect(buildUpdatePayload({ total_amount: "50.00" }, edit)).not.toHaveProperty("manual_total");
  });
  it("manual_total présent s'il a changé", () => expect(buildUpdatePayload({ total_amount: 40 }, edit).manual_total).toBe(50));
  it("mise à disposition : durée envoyée, pas d'adresse d'arrivée", () => {
    const p = buildUpdatePayload({ total_amount: 50 }, { ...edit, booking_type: "hourly", duration_hours: "4" });
    expect(p.duration_hours).toBe(4);
    expect(p).not.toHaveProperty("dropoff_address");
  });
});

describe("matchFixedRoute", () => {
  const routes = [
    { id: "a", price: 50, vehicle_category: "berline", pickup_zone_id: "z1", dropoff_zone_id: "z2" },
    { id: "b", price: 80, vehicle_category: "van", pickup_zone_id: "z1", dropoff_zone_id: "z2" },
  ];
  it("prend le forfait de la catégorie du véhicule pour les mêmes zones", () => expect(matchFixedRoute(routes, "a", "Van")?.id).toBe("b"));
  it("repli sur le forfait choisi", () => expect(matchFixedRoute(routes, "a", "suv")?.id).toBe("a"));
});

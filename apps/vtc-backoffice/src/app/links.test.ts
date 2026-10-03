import { describe, expect, it } from "vitest";
import { MIGRATED_PATHS, bookingUrl, pathFromPageFile } from "./links";

describe("liens", () => {
  it("bookingUrl encode l'identifiant", () => {
    expect(bookingUrl("abc")).toBe("/app/bookings?booking=abc");
    expect(bookingUrl("a b&c")).toBe("/app/bookings?booking=a%20b%26c");
  });
  it("pathFromPageFile dérive le chemin du nom de fichier", () => {
    expect(pathFromPageFile("./pages/VehiclesPage.tsx")).toBe("/app/vehicles");
    expect(pathFromPageFile("./pages/SetupPage.tsx")).toBe("/app/setup");
    expect(pathFromPageFile("./pages/BookingDetailPage.tsx")).toBe("/app/booking-detail");
  });
  it("MIGRATED_PATHS contient les pages React", () => {
    expect(MIGRATED_PATHS.has("/app/vehicles")).toBe(true);
    expect(MIGRATED_PATHS.has("/app/pricing")).toBe(false);
  });
});

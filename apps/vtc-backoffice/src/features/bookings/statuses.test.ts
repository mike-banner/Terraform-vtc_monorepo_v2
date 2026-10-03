import { describe, expect, it } from "vitest";
import { bookingCapabilities, isLate, showAddressAlert, splitMissionNote, statusLabel, statusTone } from "./statuses";

const NOW = Date.parse("2026-10-03T12:00:00Z");
const future = "2026-10-05T10:00:00Z";
const past = "2026-10-01T10:00:00Z";
const b = (o: Record<string, unknown> = {}) =>
  ({ status: "accepted", mission_status: "not_started", pickup_time: future, booking_source: "manual_driver", invoice_number: null, ...o }) as never;
const caps = (o: Record<string, unknown>, role: "owner" | "manager" | "driver") => bookingCapabilities(b(o), { role }, NOW);

describe("bookingCapabilities", () => {
  it("course acceptée à venir : annulation pour tous", () => {
    for (const role of ["owner", "manager", "driver"] as const) {
      expect(caps({}, role).cancelMode).toBe("cancel");
      expect(caps({}, role).canEditInstructions).toBe(true);
    }
  });
  it("acceptée et passée : non réalisée pour owner/manager seulement", () => {
    expect(caps({ pickup_time: past }, "owner").cancelMode).toBe("no_show");
    expect(caps({ pickup_time: past }, "manager").cancelMode).toBe("no_show");
    expect(caps({ pickup_time: past }, "driver").cancelMode).toBeNull();
  });
  it("payée et passée : annulation (remboursement) pour owner/manager seulement", () => {
    expect(caps({ status: "paid", pickup_time: past }, "owner").cancelMode).toBe("cancel");
    expect(caps({ status: "paid", pickup_time: past }, "driver").canCancel).toBe(false);
  });
  it("en attente de tunnel : devis pour owner/manager, pas pour driver", () => {
    const o = { status: "pending", mission_status: "to_validate", booking_source: "customer" };
    expect(caps(o, "owner").canHandleQuote).toBe(true);
    expect(caps(o, "manager").canHandleQuote).toBe(true);
    expect(caps(o, "driver").canHandleQuote).toBe(false);
    expect(caps(o, "owner").canAcceptPaid).toBe(false);
  });
  it("pending saisi à la main : pas de devis", () => {
    expect(caps({ status: "pending", mission_status: "to_validate" }, "owner").canHandleQuote).toBe(false);
  });
  it("refund_failed : reprise du remboursement pour la gestion, plus d'annulation", () => {
    const o = { status: "refund_failed", mission_status: "not_started" };
    expect(caps(o, "owner").canRetryRefund).toBe(true);
    expect(caps(o, "driver").canRetryRefund).toBe(false);
    expect(caps(o, "owner").canAcceptPaid).toBe(false);
    expect(caps(o, "owner").canInvoice).toBe(false);
  });
  it("cancelled_pending_refund : aucune action d'annulation ni de terrain", () => {
    const c = caps({ status: "cancelled_pending_refund" }, "owner");
    expect(c.canTerrain).toBe(false);
    expect(c.canInvoice).toBe(false);
  });
  it("payée à valider : acceptation ouverte", () => {
    expect(caps({ status: "paid", mission_status: "to_validate" }, "driver").canAcceptPaid).toBe(true);
  });
  it("terminée avec facture FAC- : avoir pour la gestion, facture et note visibles", () => {
    const o = { status: "completed", mission_status: "completed", invoice_number: "FAC-2026-0001" };
    expect(caps(o, "owner").canCreditNote).toBe(true);
    expect(caps(o, "driver").canCreditNote).toBe(false);
    expect(caps(o, "owner").canInvoice).toBe(true);
    expect(caps(o, "owner").showRating).toBe(true);
    expect(caps(o, "owner").canCancel).toBe(false);
    expect(caps(o, "owner").canTerrain).toBe(false);
  });
  it("devis DEV- : pas d'avoir", () => {
    expect(caps({ status: "completed", mission_status: "completed", invoice_number: "DEV-2026-0001" }, "owner").canCreditNote).toBe(false);
  });
  it("terrain : accessible non démarrée et en cours, pas à valider", () => {
    expect(caps({}, "driver").canTerrain).toBe(true);
    expect(caps({ mission_status: "in_progress" }, "driver").canTerrain).toBe(true);
    expect(caps({ mission_status: "to_validate" }, "driver").canTerrain).toBe(false);
  });
  it("en cours : plus d'instructions modifiables ni d'annulation", () => {
    const c = caps({ mission_status: "in_progress" }, "owner");
    expect(c.canEditInstructions).toBe(false);
    expect(c.canCancel).toBe(false);
  });
});

describe("statusLabel / statusTone", () => {
  it("annulée prime sur la mission", () => {
    expect(statusLabel({ status: "cancelled", mission_status: "not_started", refund_amount: null })).toBe("Annulée");
    expect(statusTone({ status: "cancelled", mission_status: "not_started" })).toBe("danger");
  });
  it("non réalisée", () => expect(statusLabel({ status: "no_show", mission_status: "not_started", refund_amount: null })).toBe("Non réalisée"));
  it("remboursée avec montant serveur", () => {
    expect(statusLabel({ status: "cancelled_refunded", mission_status: "not_started", refund_amount: 12.5 })).toMatch(/^Remboursée 12,50\s€$/);
  });
  it("échec de remboursement", () => {
    expect(statusLabel({ status: "refund_failed", mission_status: "not_started", refund_amount: null })).toBe("Échec remboursement");
  });
  it("état de mission", () => {
    expect(statusLabel({ status: "accepted", mission_status: "in_progress", refund_amount: null })).toBe("En cours");
    expect(statusTone({ status: "accepted", mission_status: "completed" })).toBe("success");
  });
});

describe("isLate", () => {
  it("non démarrée dépassée de plus de 5 min", () => {
    expect(isLate({ mission_status: "not_started", pickup_time: new Date(NOW - 6 * 60_000).toISOString() }, NOW)).toBe(true);
    expect(isLate({ mission_status: "not_started", pickup_time: new Date(NOW - 4 * 60_000).toISOString() }, NOW)).toBe(false);
    expect(isLate({ mission_status: "to_validate", pickup_time: past }, NOW)).toBe(false);
  });
});

describe("showAddressAlert", () => {
  it("masquée si close ou vérifiée", () => {
    expect(showAddressAlert({ status: "accepted", mission_status: "not_started", address_alert: "hors_zone" })).toBe(true);
    expect(showAddressAlert({ status: "accepted", mission_status: "completed", address_alert: "hors_zone" })).toBe(false);
    expect(showAddressAlert({ status: "cancelled", mission_status: "not_started", address_alert: "a_verifier" })).toBe(false);
    expect(showAddressAlert({ status: "accepted", mission_status: "not_started", address_alert: "verifie" })).toBe(false);
  });
});

describe("splitMissionNote", () => {
  it("balises terrain et notes libres", () => {
    const out = splitMissionNote("[terrain] en_route_at=2026-10-03T10:00:00Z\nBagage fragile");
    expect(out[0]).toMatch(/^En route le /);
    expect(out[1]).toBe("Note : Bagage fragile");
  });
  it("annulation et vide", () => {
    expect(splitMissionNote("[annulation] initiateur=client | motif=malade")).toEqual(["Annulée (client) : malade"]);
    expect(splitMissionNote("")).toEqual([]);
  });
});

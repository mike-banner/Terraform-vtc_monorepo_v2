import type { BadgeTone } from "@/ui";
import type { TenantRole } from "@/lib/guards";
import type { BookingRow } from "./types";

type StatusFields = Pick<BookingRow, "status" | "mission_status">;

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  accepted: "Confirmée",
  accepted_pending_payment: "En attente de paiement",
  paid: "Payée",
  completed: "Terminée",
  cancelled: "Annulée",
  cancelled_pending_refund: "Remboursement en cours",
  cancelled_refunded: "Remboursée",
  cancelled_no_refund: "Annulée",
  deprecated_refunded: "Remboursée",
  no_show: "Non réalisée",
  expired_payment: "Paiement expiré",
  refund_failed: "Échec remboursement",
  to_validate: "À valider",
  not_started: "Non démarrée",
  in_progress: "En cours",
};

export const ADDRESS_ALERT_LABELS: Record<string, string> = {
  hors_zone_depart: "Adresse de départ hors de la zone du trajet choisi",
  hors_zone_arrivee: "Adresse d'arrivée hors de la zone du trajet choisi",
  hors_zone: "Départ et arrivée hors de la zone du trajet choisi",
  a_verifier: "Adresse à vérifier : le code postal n'a pas pu être contrôlé",
  verifie: "Adresse vérifiée",
};
const ALERTS_TO_CHECK = ["hors_zone_depart", "hors_zone_arrivee", "hors_zone", "a_verifier"];

const isCancelled = (b: StatusFields) => String(b.status).startsWith("cancel") || b.status === "no_show";

/** Annulée, non réalisée ou terminée : plus d'alerte d'adresse ni de conflit à montrer. */
export const isClosed = (b: StatusFields) => isCancelled(b) || b.mission_status === "completed";

export const showAddressAlert = (b: Pick<BookingRow, "status" | "mission_status" | "address_alert">) =>
  !isClosed(b) && b.address_alert != null && ALERTS_TO_CHECK.includes(b.address_alert);

/** Annulée / non réalisée prime sur l'état de la mission ; « Remboursée » porte le montant calculé par le serveur. */
export function statusLabel(b: Pick<BookingRow, "status" | "mission_status" | "refund_amount">): string {
  if (b.status === "no_show") return STATUS_LABELS.no_show;
  const closed = isCancelled(b) || b.status === "refund_failed";
  const key = closed
    ? ["cancelled_pending_refund", "cancelled_refunded", "refund_failed"].includes(b.status) ? b.status : "cancelled"
    : String(b.mission_status ?? b.status);
  const label = STATUS_LABELS[key] ?? key;
  if (b.status === "cancelled_refunded" && b.refund_amount != null) {
    // Affichage seul : le montant vient du serveur.
    return `${label} ${b.refund_amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  }
  return label;
}

export function statusTone(b: StatusFields): BadgeTone {
  if (isCancelled(b) || b.status === "refund_failed") return "danger";
  if (b.mission_status === "completed") return "success";
  if (b.mission_status === "in_progress") return "primary";
  if (b.mission_status === "to_validate") return "warning";
  return "neutral";
}

/** Course non démarrée dont l'heure de prise en charge est dépassée de plus de 5 minutes. */
export function isLate(b: Pick<BookingRow, "mission_status" | "pickup_time">, now: number): boolean {
  return b.mission_status === "not_started" && !!b.pickup_time && now > new Date(b.pickup_time).getTime() + 5 * 60_000;
}

export type Capabilities = {
  canEdit: boolean;
  canEditInstructions: boolean;
  canCancel: boolean;
  cancelMode: "cancel" | "no_show" | null;
  canRetryRefund: boolean;
  canAcceptPaid: boolean;
  canHandleQuote: boolean;
  canInvoice: boolean;
  canCreditNote: boolean;
  canTerrain: boolean;
  showRating: boolean;
};

type CapFields = Pick<BookingRow, "status" | "mission_status" | "pickup_time" | "booking_source" | "invoice_number">;

/** Droits d'action de la fiche, repris de scripts/bookings.ts ; le serveur (RPC, RLS) reste l'arbitre. */
export function bookingCapabilities(b: CapFields, profile: { role: TenantRole | null }, now: number = Date.now()): Capabilities {
  const canManage = profile.role === "owner" || profile.role === "manager";
  const preMission = b.mission_status === "to_validate" || b.mission_status === "not_started";
  const cancelled = isCancelled(b);
  const isPast = new Date(b.pickup_time).getTime() <= now;
  const isPaid = b.status === "paid";

  const mode = preMission && isPast && !isPaid ? "no_show" : "cancel";
  const canCancel = preMission && (mode === "no_show" ? canManage && b.status === "accepted" : !isPast || (isPaid && canManage));
  const closed = cancelled || b.status === "refund_failed";

  return {
    canEdit: preMission && (b.status === "pending" || b.status === "accepted"),
    canEditInstructions: preMission && ["pending", "accepted", "accepted_pending_payment", "paid"].includes(b.status),
    canCancel,
    cancelMode: canCancel ? mode : null,
    canRetryRefund: b.status === "refund_failed" && canManage,
    canAcceptPaid: !closed && b.status !== "pending" && (b.mission_status === "to_validate" || (b.mission_status == null && isPaid)),
    canHandleQuote: canManage && b.status === "pending" && b.booking_source === "customer",
    canInvoice: b.mission_status === "completed" && !closed,
    canCreditNote: canManage && String(b.invoice_number ?? "").startsWith("FAC-"),
    canTerrain: !cancelled && b.mission_status !== "completed" && b.mission_status !== "to_validate",
    showRating: b.mission_status === "completed",
  };
}

/** mission_note : journal technique en phrases lisibles (heure de Paris), une ligne par évènement. */
export function splitMissionNote(raw: string): string[] {
  const when = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
  const out: string[] = [];
  for (const line of raw.split("\n").map((l) => l.trim()).filter(Boolean)) {
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^\[terrain\] en_route_at=(\S+)/))) out.push(`En route le ${when(m[1])}`);
    else if ((m = line.match(/^\[terrain\] on_board_at=(\S+)/))) out.push(`Client à bord le ${when(m[1])}`);
    else if ((m = line.match(/^\[terrain\] completed_at=(\S+)/))) out.push(`Course terminée le ${when(m[1])}`);
    else if (line.startsWith("[terrain] completed_at_was_corrected")) out.push("Heure de fin corrigée manuellement");
    else if ((m = line.match(/^\[annulation\] initiateur=(\S+)\s*\|\s*motif=(.*)$/))) out.push(`Annulée (${m[1]}) : ${m[2]}`);
    else if ((m = line.match(/^\[non réalisée\] motif=(.*)$/))) out.push(`Non réalisée, client absent : ${m[1]}`);
    else if ((m = line.match(/^\[remboursement\] échec : (.*)$/))) out.push(`Échec du remboursement : ${m[1]}`);
    else out.push(`Note : ${line}`);
  }
  return out;
}

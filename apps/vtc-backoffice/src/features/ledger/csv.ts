import type { LedgerMovement } from "./api";

const SEP = ";";
const PARIS = "Europe/Paris";
const HEADERS = ["Date", "Heure", "Type", "Client", "Mode", "HT (€)", "TVA (€)", "ID Course"];

// Mise en forme seulement : le signe est déjà celui du serveur.
const amount = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

/** Texte : préfixe apostrophe contre l'injection de formule, guillemets si nécessaire. Les montants n'y passent pas. */
function text(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function movementsToCsv(rows: LedgerMovement[]): string {
  const lines = rows.map((m) => {
    const d = new Date(m.created_at);
    const mode = m.payment_mode === "card" ? "Carte" : m.payment_mode === "cash" ? "Espèces" : "—";
    return [
      text(d.toLocaleDateString("fr-FR", { timeZone: PARIS })),
      text(d.toLocaleTimeString("fr-FR", { timeZone: PARIS, hour: "2-digit", minute: "2-digit" })),
      text(m.movement_type === "payment" ? "Paiement" : "Remboursement"),
      text(m.customer_name ?? "—"),
      text(mode),
      amount(m.signed_net),
      amount(m.signed_vat),
      text(m.booking_id.slice(0, 8)),
    ].join(SEP);
  });
  return [HEADERS.join(SEP), ...lines].join("\n");
}

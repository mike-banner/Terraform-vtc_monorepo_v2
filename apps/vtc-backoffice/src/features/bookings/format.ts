const PARIS = "Europe/Paris";

export const formatEur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { timeZone: PARIS, day: "2-digit", month: "short" });
export const formatDateLong = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { timeZone: PARIS, day: "2-digit", month: "long", year: "numeric" });
export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { timeZone: PARIS, hour: "2-digit", minute: "2-digit" });
export const formatDateTime = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: PARIS, dateStyle: "short", timeStyle: "short" });

export const bookingRef = (id: string) => `#${id.split("-")[0].toUpperCase()}`;

export const customerName = (c: { first_name: string; last_name: string | null } | null) =>
  `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || "Client";

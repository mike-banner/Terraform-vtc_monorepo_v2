import { createElement, type ReactNode } from "react";
import { Link } from "react-router-dom";

/** Toute URL de fiche de course passe ici (D-09) : pas de sous-chemin avant la phase 17. */
export const bookingUrl = (id: string) => `/app/bookings?booking=${encodeURIComponent(id)}`;

/** "./pages/BookingDetailPage.tsx" -> "/app/booking-detail". */
export function pathFromPageFile(file: string): string {
  const name = (file.split("/").pop() ?? "").replace(/Page\.tsx$/, "");
  return `/app/${name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;
}

/** Pages servies par la coque React ; les autres chemins /app/* sont encore des pages Astro. */
export const MIGRATED_PATHS = new Set(Object.keys(import.meta.glob("./pages/*Page.tsx")).map(pathFromPageFile));

/** Navigation interne si la page est migrée, chargement complet sinon. */
export function AppLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const path = to.split(/[?#]/)[0];
  return MIGRATED_PATHS.has(path)
    ? createElement(Link, { to, className }, children)
    : createElement("a", { href: to, className }, children);
}

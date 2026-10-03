import type { ReactNode } from "react";
import { CalendarDays, Car, FileText, LayoutDashboard, LogOut, Settings, Tag, User, type LucideIcon } from "lucide-react";
import { useLocation } from "react-router-dom";
import { ROUTE_POLICY } from "@/lib/guards";
import { supabase } from "@/lib/supabase/client";
import { useActiveMission } from "@/features/missions/api";
import { useDialog } from "@/ui";
import { useProfile, useSession } from "../auth/useSession";
import { useTenant, useTenantStatus } from "../auth/useTenantStatus";
import { AppLink } from "../links";
import * as realtime from "../realtime";
import { ActiveMissionBanner } from "./ActiveMissionBanner";
import { useInactivity } from "./useInactivity";
import { useResume } from "./useResume";
import { useThemeColor } from "./useThemeColor";

const NAV: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: "/app/dashboard", label: "Accueil", Icon: LayoutDashboard },
  { to: "/app/bookings", label: "Courses", Icon: CalendarDays },
  { to: "/app/vehicles", label: "Flotte", Icon: Car },
  { to: "/app/pricing", label: "Tarifs", Icon: Tag },
  { to: "/app/ledger", label: "Fiscal", Icon: FileText },
  { to: "/app/settings", label: "Réglages", Icon: Settings },
  { to: "/app/profile", label: "Profil", Icon: User },
];

const DOT = "inline-block size-2 rounded-full";
const syncProps = {
  dotClassName: { online: `${DOT} bg-primary`, reconnecting: `${DOT} bg-muted-foreground motion-safe:animate-pulse`, offline: `${DOT} bg-destructive` },
  className: "inline-flex shrink-0 items-center gap-1.5",
  labelClassName: "text-xs text-muted-foreground",
};

/** Coque : navigation, état de connexion, session. QueryClient et canal temps réel vivent ici, donc survivent à la navigation entre pages React. */
export function AppShell({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const tenantId = profile?.tenantId ?? null;
  const { pathname } = useLocation();
  const dialog = useDialog();
  const { data: tenant } = useTenant(tenantId);
  const { data: mission } = useActiveMission(profile?.userId, tenantId);

  useSession();
  useTenantStatus(tenantId);
  useResume();
  useInactivity(!!mission);
  useThemeColor();
  // Client partagé injecté : le package ne crée jamais son propre client.
  realtime.useTenantBookingsRealtime(supabase, tenantId);

  const items = NAV.filter((n) => profile?.role && ROUTE_POLICY[n.to]?.includes(profile.role));
  const logout = async () => {
    if (!(await dialog.confirm({ title: "Déconnexion", message: "Voulez-vous vous déconnecter ?", confirmLabel: "Se déconnecter", variant: "danger" }))) return;
    await supabase.auth.signOut();
    window.location.assign("/");
  };
  const link = (active: boolean) => (active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted");

  return (
    <div data-app-shell className="flex h-dvh flex-col bg-background text-foreground md:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col gap-1 border-r border-border p-4 md:flex">
        <p className="mb-4 truncate px-3 font-bold">{tenant?.name ?? "VTC"}</p>
        {items.map(({ to, label, Icon }) => (
          <AppLink key={to} to={to} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${link(pathname === to)}`}>
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </AppLink>
        ))}
        <button type="button" onClick={logout} className="mt-auto flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-destructive hover:bg-muted">
          <LogOut aria-hidden="true" className="size-5" />
          Se déconnecter
        </button>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 pt-[env(safe-area-inset-top)]">
          <span className="truncate text-sm font-bold md:hidden">{tenant?.name ?? "VTC"}</span>
          <span className="ml-auto flex items-center gap-3">
            <realtime.SyncIndicator {...syncProps} />
            <button type="button" onClick={logout} aria-label="Se déconnecter" className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted md:hidden">
              <LogOut aria-hidden="true" className="size-5" />
            </button>
          </span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        <ActiveMissionBanner mission={mission} />
        <nav data-bottom-nav className="flex shrink-0 border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden">
          {items.map(({ to, label, Icon }) => (
            <AppLink key={to} to={to} className={`flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-xs font-semibold ${link(pathname === to)}`}>
              <Icon aria-hidden="true" className="size-5" />
              <span className="w-full truncate text-center">{label}</span>
            </AppLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

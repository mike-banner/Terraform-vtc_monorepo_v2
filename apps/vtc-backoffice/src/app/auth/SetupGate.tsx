import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useProfile } from "./useSession";
import { useTenant } from "./useTenantStatus";

/** Même condition que dashboard.astro : owner dont l'installation n'est pas terminée, depuis le tableau de bord. */
export function SetupGate({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const { data: tenant } = useTenant(profile?.tenantId ?? null);
  const { pathname } = useLocation();
  const toSetup = pathname === "/app/dashboard" && profile?.role === "owner" && !!tenant && !tenant.setup_completed;
  useEffect(() => {
    if (toSetup) window.location.assign("/app/setup");
  }, [toSetup]);
  return toSetup ? null : <>{children}</>;
}

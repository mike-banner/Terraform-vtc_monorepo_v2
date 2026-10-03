import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useSetupData } from "@/features/setup/api";
import { useProfile } from "./useSession";

/** Owner dont les prérequis bloquants manquent (isSetupComplete), depuis le tableau de bord : vers la première connexion guidée. */
export function SetupGate({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const { pathname } = useLocation();
  const onDashboard = pathname === "/app/dashboard" && profile?.role === "owner";
  const { complete } = useSetupData(onDashboard ? (profile?.tenantId ?? null) : null, profile?.userId ?? null);
  const toSetup = onDashboard && complete === false;
  useEffect(() => {
    if (toSetup) window.location.assign("/app/setup");
  }, [toSetup]);
  return toSetup ? null : <>{children}</>;
}

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { TenantRole } from "@/lib/guards";
import { Skeleton } from "@/ui";
import { useProfile } from "./useSession";

/** Confort de navigation : l'autorité reste le middleware, la RLS et les RPC. */
export function RequireRole({ roles, children }: { roles: TenantRole[] | undefined; children: ReactNode }) {
  const { profile, isLoading } = useProfile();
  if (isLoading) return <Skeleton />;
  if (!profile?.role || !roles?.includes(profile.role)) return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}

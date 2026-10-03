import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { TenantRole } from "@/lib/guards";
import { decodeClaims } from "./session";

export type Profile = { userId: string; tenantId: string | null; role: TenantRole | null };

const ROLES = ["owner", "manager", "driver"];
const asRole = (r: string | null | undefined): TenantRole | null => (r && ROLES.includes(r) ? (r as TenantRole) : null);

/** Abonnement unique (appelé par AppShell) : une session perdue renvoie vers la connexion. */
export function useSession(): void {
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") window.location.assign("/login?reason=expired");
    });
    return () => data.subscription.unsubscribe();
  }, []);
}

/** Profil depuis les claims du jeton, repli sur `profiles` comme le middleware (sessions antérieures au hook). */
export function useProfile(): { profile: Profile | null; isLoading: boolean } {
  const q = useQuery({
    queryKey: ["session", "profile"],
    staleTime: Infinity,
    queryFn: async (): Promise<Profile | null> => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return null;
      const claims = decodeClaims(session.access_token);
      if (claims && (claims.tenant_role !== null || claims.platform_role !== null)) {
        return { userId: session.user.id, tenantId: claims.tenant_id, role: asRole(claims.tenant_role) };
      }
      const { data: p } = await supabase.from("profiles").select("tenant_id, tenant_role").eq("id", session.user.id).maybeSingle();
      return { userId: session.user.id, tenantId: p?.tenant_id ?? null, role: asRole(p?.tenant_role) };
    },
  });
  return { profile: q.data ?? null, isLoading: q.isLoading };
}

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

/** Retour au premier plan ou au réseau (D-13) : session perdue = retour à la connexion. Les données se resynchronisent via la phase 15. */
export function useResume(): void {
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) window.location.assign("/login?reason=expired");
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, []);
}

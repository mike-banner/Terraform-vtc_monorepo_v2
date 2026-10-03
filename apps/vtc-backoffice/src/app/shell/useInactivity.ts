import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

import { isIdle } from "./idle";

/** Déconnexion après 30 min sans activité, sauf course en cours. Comparaison d'horloge : une PWA en veille suspend les minuteurs. */

export function useInactivity(missionInProgress: boolean): void {
  const last = useRef(Date.now());
  const busy = useRef(missionInProgress);
  busy.current = missionInProgress;

  useEffect(() => {
    const touch = () => {
      last.current = Date.now();
    };
    const check = () => {
      if (busy.current) return touch(); // pas de coupure pendant une course
      if (!isIdle(last.current, Date.now())) return;
      void supabase.auth.signOut().finally(() => window.location.assign("/login?reason=inactivity"));
    };
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(check, 60_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);
}

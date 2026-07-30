import { supabase } from "@/lib/supabase/client";

// Value injected by InactivityTimeout.astro via define:vars before this module loads
const timeoutMs: number = (window as any).__INACTIVITY_TIMEOUT_MS__ ?? 30 * 60 * 1000;

let inactivityTimer: number | undefined;

const logout = async (): Promise<void> => {
  await supabase.auth.signOut();
  window.location.href = "/login?reason=inactivity";
};

const resetTimer = (): void => {
  if (inactivityTimer) window.clearTimeout(inactivityTimer);
  inactivityTimer = window.setTimeout(() => void logout(), timeoutMs);
};

const activityEvents: Array<keyof DocumentEventMap> = [
  "mousedown",
  "mousemove",
  "keypress",
  "scroll",
  "touchstart",
  "click",
];

const init = (): void => {
  const currentPath = window.location.pathname;
  if (currentPath === "/login" || currentPath === "/") return;

  resetTimer();
  activityEvents.forEach((event) => {
    document.addEventListener(event, resetTimer, { passive: true });
  });
};

document.addEventListener("astro:page-load", init);
init();


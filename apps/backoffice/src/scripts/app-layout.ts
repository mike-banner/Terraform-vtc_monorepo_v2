import { supabase } from "@/lib/supabase/client";

// --- Mission completion banner ---

type ActiveBooking = {
  id: string;
  dropoff_address: string;
  pickup_time: string;
  mission_note: string | null;
};

let currentBannerBooking: ActiveBooking | null = null;

function toLocalInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function parseEnRouteAt(missionNote: string | null, fallback: string): Date {
  const match = missionNote?.match(/\[terrain\] en_route_at=([^\s\n]+)/);
  return match ? new Date(match[1]) : new Date(fallback);
}

async function completeMission(bookingId: string, correctedAt?: string): Promise<boolean> {
  const payload: Record<string, string> = { booking_id: bookingId, action: "completed" };
  if (correctedAt) payload.corrected_at = correctedAt;

  const res = await fetch("/api/missions/terrain-transition", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return res.ok;
}

function openCorrectionModal(booking: ActiveBooking): void {
  const modal = document.querySelector<HTMLElement>("#correction-modal");
  const datetimeInput = document.querySelector<HTMLInputElement>("#correction-datetime");
  const confirmBtn = document.querySelector<HTMLButtonElement>("#correction-confirm");
  const nowBtn = document.querySelector<HTMLButtonElement>("#correction-now");
  const overlay = document.querySelector<HTMLElement>(".correction-overlay");

  if (!modal || !datetimeInput || !confirmBtn || !nowBtn) return;

  const enRouteAt = parseEnRouteAt(booking.mission_note, booking.pickup_time);
  const now = new Date();

  datetimeInput.value = toLocalInputValue(now);
  datetimeInput.min = toLocalInputValue(enRouteAt);
  datetimeInput.max = toLocalInputValue(now);

  modal.classList.add("is-active");

  const close = () => modal.classList.remove("is-active");

  const afterComplete = (ok: boolean) => {
    close();
    if (ok) {
      document.querySelector<HTMLElement>("#mission-banner")?.classList.add("hidden");
      currentBannerBooking = null;
      setTimeout(() => window.location.reload(), 300);
    }
  };

  const onConfirm = async () => {
    confirmBtn.removeEventListener("click", onConfirm);
    nowBtn.removeEventListener("click", onNow);
    overlay?.removeEventListener("click", close);
    const correctedAt = datetimeInput.value ? new Date(datetimeInput.value).toISOString() : undefined;
    const ok = await completeMission(booking.id, correctedAt);
    afterComplete(ok);
  };

  const onNow = async () => {
    confirmBtn.removeEventListener("click", onConfirm);
    nowBtn.removeEventListener("click", onNow);
    overlay?.removeEventListener("click", close);
    const ok = await completeMission(booking.id);
    afterComplete(ok);
  };

  confirmBtn.addEventListener("click", onConfirm);
  nowBtn.addEventListener("click", onNow);
  overlay?.addEventListener("click", close);
}

function initMissionBanner(): void {
  const banner = document.querySelector<HTMLElement>("#mission-banner");
  const addrEl = document.querySelector<HTMLElement>("#mission-banner-addr");
  const completeBtn = document.querySelector<HTMLButtonElement>("#mission-complete-btn");

  if (!banner || !addrEl || !completeBtn) return;

  const showBanner = (booking: ActiveBooking) => {
    currentBannerBooking = booking;
    addrEl.textContent = booking.dropoff_address.split(",")[0].trim();
    banner.classList.remove("hidden");
  };

  const hideBanner = () => {
    banner.classList.add("hidden");
    currentBannerBooking = null;
  };

  const checkBanner = async () => {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, dropoff_address, pickup_time, mission_note")
      .eq("mission_status", "in_progress")
      .order("pickup_time", { ascending: true })
      .limit(1);

    const booking = bookings?.[0] ?? null;
    if (!booking) { hideBanner(); return; }

    showBanner(booking);
  };

  // Complete button
  completeBtn.addEventListener("click", async () => {
    if (!currentBannerBooking) return;

    const booking = currentBannerBooking;
    const enRouteAt = parseEnRouteAt(booking.mission_note, booking.pickup_time);
    const hoursSinceStart = (Date.now() - enRouteAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceStart > 4) {
      openCorrectionModal(booking);
    } else {
      const ok = await completeMission(booking.id);
      if (ok) {
        hideBanner();
        setTimeout(() => window.location.reload(), 300);
      }
    }
  });

  void checkBanner();
  void checkUpcomingNotifications();
  setInterval(() => { void checkBanner(); void checkUpcomingNotifications(); }, 60_000);
}

// --- Upcoming booking notifications ---

async function requestNotificationPermission(): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  await Notification.requestPermission();
}

async function checkUpcomingNotifications(): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const now = Date.now();
  const in20min = now + 20 * 60 * 1000;

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, pickup_time, pickup_address, customers(first_name, last_name)')
    .in('mission_status', ['to_validate', 'not_started'])
    .gte('pickup_time', new Date(now + 60_000).toISOString())
    .lte('pickup_time', new Date(in20min).toISOString());

  bookings?.forEach((booking: any) => {
    const key = `notif_sent_${String(booking.id)}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    const pickupMs = new Date(booking.pickup_time as string).getTime();
    const minutesLeft = Math.round((pickupMs - now) / 60_000);
    const customer = booking.customers as { first_name?: string; last_name?: string } | null;
    const name = customer ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() : 'Client';

    new Notification(`Course dans ${minutesLeft} min`, {
      body: `${name} — ${String(booking.pickup_address)}`,
      icon: '/favicon.svg',
      tag: `booking-${String(booking.id)}`,
    });
  });
}

// ---

const run = (): void => {
  const logoutBtn = document.querySelector<HTMLButtonElement>("#logout-btn");
  const modal = document.querySelector<HTMLElement>("#logout-modal");
  const confirmBtn = document.querySelector<HTMLButtonElement>("#confirm-logout");
  const cancelBtn = document.querySelector<HTMLButtonElement>("#cancel-logout");
  const overlay = document.querySelector<HTMLElement>("#logout-modal .modal-overlay");

  const toggleModal = (): void => {
    modal?.classList.toggle("is-active");
    document.body.classList.toggle("overflow-hidden");
  };

  logoutBtn?.addEventListener("click", toggleModal);
  cancelBtn?.addEventListener("click", toggleModal);
  overlay?.addEventListener("click", toggleModal);

  confirmBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (modal?.classList.contains("is-active")) toggleModal();
  });

  initMissionBanner();
  void requestNotificationPermission();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", run);
} else {
  run();
}

import { supabase } from "@/lib/supabase/client";
import QRCode from "qrcode";
import { calculatePrice, findPricingRule, type PricingRule } from "@/lib/pricing";


type AnyBooking = Record<string, unknown> & {
  id?: string;
  pickup_time?: string;
  pickup_address?: string;
  dropoff_address?: string;
  passenger_count?: number;
  luggage_count?: number;
  total_amount?: number | string;
  status?: string;
  mission_status?: string;
  booking_type?: string;
  mission_note?: string;
  notes?: string;
  rating?: number | null;
  rating_comment?: string | null;
  customers?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
};

let currentDetailBooking: AnyBooking | null = null;

const parseBookingFromRow = (row: Element): AnyBooking => {
  const encodedData = row.getAttribute("data-booking") ?? "";
  if (!encodedData) return {};
  try {
    return JSON.parse(decodeURIComponent(encodedData)) as AnyBooking;
  } catch {
    return {};
  }
};

const updateTerrainUI = (booking: AnyBooking): void => {
  const root = document.getElementById("mission-cockpit-root");
  if (!root) return;

  const notes = (booking.mission_note ?? "") as string;
  const status = (booking.mission_status ?? "") as string;
  const hasTag = (tag: string): boolean => notes.includes(`[terrain] ${tag}_at=`);

  const isEnRoute = hasTag("en_route");
  const isCompleted = status === "completed";

  if (isCompleted || String(booking.status ?? "").startsWith("cancel") || status === "to_validate") {
    root.innerHTML = "";
    return;
  }

  const pickupTime = booking.pickup_time ? new Date(booking.pickup_time) : null;
  const pickupMs = pickupTime && !Number.isNaN(pickupTime.getTime()) ? pickupTime.getTime() : null;
  const availableAtMs = pickupMs ? pickupMs - 15 * 60 * 1000 : null;
  const canStart = availableAtMs ? Date.now() >= availableAtMs : true;

  const runAction = async (action: "en_route" | "completed"): Promise<void> => {
    const btnId = action === "en_route" ? "btn-start" : "btn-complete";
    const btn = document.getElementById(btnId) as HTMLButtonElement | null;
    if (btn) btn.disabled = true;

    try {
      const bookingId = booking.id;
      if (!bookingId) throw new Error("Missing booking id");

      const res = await fetch("/api/missions/terrain-transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, action }),
      });
      const data = (await res.json()) as { success?: boolean; mission_note?: string; error?: string };

      if (data.success) {
        booking.mission_note = data.mission_note ?? booking.mission_note;
        window.location.reload();
      } else {
        alert(data.error || "Erreur");
        updateTerrainUI(booking);
      }
    } catch {
      alert("Erreur réseau");
      updateTerrainUI(booking);
    }
  };

  if (!isEnRoute) {
    root.innerHTML = `
      <div class="mt-6">
        <div class="flex items-center justify-between mb-3">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Pilotage</p>
          ${!canStart && availableAtMs ? `
            <div class="px-2.5 py-1 bg-amber-500/8 rounded-lg border border-amber-500/20 text-[9px] font-black text-amber-400 uppercase tracking-wide tabular-nums">
              Dispo à ${new Date(availableAtMs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          ` : ""}
        </div>
        <button id="btn-start" ${!canStart ? "disabled" : ""}
          class="w-full flex items-center justify-center gap-2 min-h-[52px] px-4 rounded-xl border transition-all
            bg-indigo-600 border-indigo-500 text-white font-black text-[11px] uppercase tracking-widest
            hover:bg-indigo-500 active:scale-95 shadow-lg shadow-indigo-600/20
            disabled:opacity-30 disabled:cursor-not-allowed">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z" />
          </svg>
          Démarrer la course
        </button>
      </div>
    `;
    document.getElementById("btn-start")?.addEventListener("click", () => void runAction("en_route"));
  } else {
    root.innerHTML = `
      <div class="mt-6 space-y-2.5">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Pilotage</p>
        <div class="flex items-center gap-2 px-3 py-2.5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl">
          <div class="w-2 h-2 bg-indigo-400 rounded-full animate-pulse flex-shrink-0"></div>
          <span class="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Course en cours</span>
        </div>
        <button id="btn-complete"
          class="w-full flex items-center justify-center gap-2 min-h-[52px] px-4 rounded-xl border transition-all
            bg-emerald-600 border-emerald-500 text-white font-black text-[11px] uppercase tracking-widest
            hover:bg-emerald-500 active:scale-95 shadow-lg shadow-emerald-600/20">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Terminer la course
        </button>
      </div>
    `;
    document.getElementById("btn-complete")?.addEventListener("click", () => void runAction("completed"));
  }
};

const updateRatingUI = (booking: AnyBooking): void => {
  const section = document.getElementById("modal-rating-section");
  const ratingDisplay = document.getElementById("modal-rating-display");
  const qrSection = document.getElementById("modal-qr-section");
  if (!section || !ratingDisplay || !qrSection) return;

  if (booking.mission_status !== "completed") {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");

  if (booking.rating != null) {
    ratingDisplay.classList.remove("hidden");
    qrSection.classList.add("hidden");

    const starsEl = document.getElementById("modal-rating-stars");
    if (starsEl) {
      starsEl.innerHTML = [1, 2, 3, 4, 5]
        .map((s) => `<svg class="w-5 h-5 ${s <= Number(booking.rating) ? "text-amber-400" : "text-slate-700"}" fill="currentColor" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545-4.756-4.635 6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>`)
        .join("");
    }

    const commentEl = document.getElementById("modal-rating-comment");
    if (commentEl) {
      commentEl.innerText = booking.rating_comment
        ? `"${booking.rating_comment}"`
        : "Aucun commentaire";
    }
  } else {
    ratingDisplay.classList.add("hidden");
    qrSection.classList.remove("hidden");

    const canvas = document.getElementById("modal-qr-canvas") as HTMLCanvasElement | null;
    if (canvas && booking.id) {
      const siteOrigin = (import.meta.env.PUBLIC_SITE_URL as string | undefined)?.replace(/\/$/, "") || window.location.origin;
      const ratingUrl = `${siteOrigin}/rate/${booking.id}`;
      QRCode.toCanvas(canvas, ratingUrl, {
        width: 112,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      }).catch(console.error);
    }
  }
};

const run = (): void => {
  const openBtn = document.querySelector<HTMLButtonElement>("#open-new-booking");
  const closeBtn = document.querySelector<HTMLButtonElement>("#close-new-booking");
  const modal = document.querySelector<HTMLElement>("#new-booking-modal");
  const overlay = modal?.querySelector<HTMLElement>(".modal-overlay") ?? null;
  const form = document.querySelector<HTMLFormElement>("#new-booking-form");

  const detailModal = document.getElementById("detail-booking-modal");
  const driverId = detailModal?.getAttribute("data-driver-id") ?? null;
  const closeDetailBtns = document.querySelectorAll<HTMLButtonElement>(".close-detail-modal");
  const detailOverlay = detailModal?.querySelector<HTMLElement>(".modal-overlay") ?? null;

  const toggleNewBookingModal = (): void => {
    if (!modal) return;
    const isOpen = modal.style.display === "flex";
    if (isOpen) {
      modal.classList.remove("is-active");
      form?.reset();
      setTimeout(() => { if (!modal.classList.contains("is-active")) modal.style.display = "none"; }, 500);
    } else {
      modal.style.display = "flex";
      requestAnimationFrame(() => modal.classList.add("is-active"));
    }
  };

  const toggleDetailModal = (): void => {
    if (!detailModal) return;
    const isOpen = detailModal.style.display === "flex";
    if (isOpen) {
      detailModal.classList.add("opacity-0");
      detailModal.querySelector(".relative")?.classList.add("scale-95");
      setTimeout(() => { if (detailModal.classList.contains("opacity-0")) detailModal.style.display = "none"; }, 500);
    } else {
      detailModal.style.display = "flex";
      requestAnimationFrame(() => {
        detailModal.classList.remove("opacity-0");
        detailModal.querySelector(".relative")?.classList.remove("scale-95");
      });
    }
  };

  overlay?.addEventListener("click", toggleNewBookingModal);
  openBtn?.addEventListener("click", toggleNewBookingModal);
  closeBtn?.addEventListener("click", toggleNewBookingModal);

  closeDetailBtns.forEach((btn) => btn.addEventListener("click", toggleDetailModal));
  detailOverlay?.addEventListener("click", toggleDetailModal);

  const openDetailForRow = (row: HTMLElement): void => {
      const booking = parseBookingFromRow(row);
      updateTerrainUI(booking);
      updateRatingUI(booking);

      const nameEl = document.getElementById("modal-client-name");
      const phoneLinkEl = document.getElementById("modal-client-phone-link") as HTMLAnchorElement | null;
      const pickupEl = document.getElementById("modal-pickup");
      const dropoffEl = document.getElementById("modal-dropoff");
      const passengersEl = document.getElementById("modal-passengers");
      const luggageEl = document.getElementById("modal-luggage");
      const notesEl = document.getElementById("modal-notes");
      const timeEl = document.getElementById("modal-time");
      const mapLinkEl = document.getElementById("modal-map-link") as HTMLAnchorElement | null;
      const dateEl = document.getElementById("modal-date");
      const amountEl = document.getElementById("modal-amount");
      const refEl = document.getElementById("modal-booking-ref");
      const typeEl = document.getElementById("modal-booking-type");
      const statusEl = document.getElementById("modal-status-badge");

      const STATUS_LABELS_FR: Record<string, string> = {
        to_validate: "À valider",
        not_started: "À venir",
        in_progress: "En cours",
        pending: "En attente",
        accepted: "Confirmée",
        paid: "Payée",
        completed: "Terminée",
        cancelled: "Annulée",
        no_show: "Non présentation",
      };

      const firstName = booking.customers?.first_name ?? "";
      const lastName = booking.customers?.last_name ?? "";
      if (nameEl) nameEl.innerText = `${firstName} ${lastName}`.trim() || "Client";

      if (phoneLinkEl) {
        const phone = booking.customers?.phone;
        if (phone) {
          phoneLinkEl.href = `tel:${phone}`;
          phoneLinkEl.style.display = "flex";
        } else {
          phoneLinkEl.style.display = "none";
        }
      }

      if (pickupEl) pickupEl.innerText = String(booking.pickup_address ?? "");
      if (dropoffEl) dropoffEl.innerText = String(booking.dropoff_address ?? "Non spécifiée");
      if (passengersEl) passengersEl.innerText = String(booking.passenger_count ?? 1);
      if (luggageEl) luggageEl.innerText = String(booking.luggage_count ?? 0);
      if (notesEl) notesEl.innerText = String(booking.mission_note ?? booking.notes ?? "Aucune note particulière.");

      const id = booking.id ?? "---";
      if (refEl) refEl.innerText = `REF: #${String(id).split("-")[0].toUpperCase()}`;

      if (statusEl) {
        const status = String(booking.mission_status ?? booking.status ?? "");
        statusEl.innerText = STATUS_LABELS_FR[status] || status;

        const statusColors: Record<string, string> = {
          to_validate: "bg-amber-500/10 text-amber-500 border-amber-500/20",
          not_started: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
          in_progress: "bg-indigo-600/20 text-indigo-400 border-indigo-500/30",
          completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
          pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
          accepted: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
          paid: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
          cancelled: "bg-rose-500/10 text-rose-500 border-rose-500/20",
        };
        const colorClass = statusColors[status] || "bg-white/10 text-white border-white/10";
        statusEl.className = `px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest text-center ${colorClass}`;

        const acceptBtn = document.getElementById("modal-accept-btn") as HTMLButtonElement | null;
        if (acceptBtn) {
          if (status === "paid" || status === "to_validate") {
            acceptBtn.classList.remove("hidden");
            if (!driverId) {
              acceptBtn.classList.add("opacity-50");
              acceptBtn.onclick = () => alert("Profil chauffeur requis.");
            } else {
              acceptBtn.classList.remove("opacity-50");
              acceptBtn.onclick = async () => {
                try {
                  acceptBtn.innerText = "Traitement...";
                  acceptBtn.disabled = true;

                  const bookingId = booking.id;
                  if (!bookingId) throw new Error("Missing booking id");

                  const { error } = await supabase.functions.invoke("accept-booking", {
                    body: { booking_id: bookingId, driver_id: driverId },
                  });
                  if (error) throw error;
                  window.location.reload();
                } catch {
                  alert("Erreur lors de l'acceptation.");
                  acceptBtn.innerText = "Accepter la course";
                  acceptBtn.disabled = false;
                }
              };
            }
          } else {
            acceptBtn.classList.add("hidden");
          }
        }
      }

      if (amountEl) amountEl.innerText = `${Number(booking.total_amount ?? 0).toFixed(2)}€`;
      if (mapLinkEl) {
        const origin = encodeURIComponent(String(booking.pickup_address ?? ""));
        const destination = encodeURIComponent(String(booking.dropoff_address ?? ""));
        mapLinkEl.href = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
      }

      if (typeEl) {
        const isHourly = (booking.booking_type ?? "") === "hourly";
        typeEl.innerText = isHourly ? "MISE À DISPOSITION" : "TRANSFERT";
        typeEl.className = `px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
          isHourly
            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
            : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
        }`;
      }

      const dateObj = booking.pickup_time ? new Date(booking.pickup_time) : null;
      if (dateObj && !Number.isNaN(dateObj.getTime())) {
        if (timeEl) timeEl.innerText = dateObj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        if (dateEl) dateEl.innerText = dateObj.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
      } else {
        if (timeEl) timeEl.innerText = "---";
        if (dateEl) dateEl.innerText = "---";
      }

      // Boutons pré-mission : Modifier + Annuler
      currentDetailBooking = booking;
      const preMission = ["to_validate", "not_started"].includes(String(booking.mission_status ?? ""));

      const editBtn = document.getElementById("modal-edit-btn");
      if (editBtn) editBtn.classList.toggle("hidden", !preMission);

      const cancelSection = document.getElementById("cancel-section");
      if (cancelSection) cancelSection.classList.toggle("hidden", !preMission);

      // Reset panneau annulation
      document.getElementById("cancel-trigger-area")?.classList.remove("hidden");
      document.getElementById("cancel-form-area")?.classList.add("hidden");
      const cancelReasonEl = document.getElementById("cancel-reason") as HTMLTextAreaElement | null;
      if (cancelReasonEl) cancelReasonEl.value = "";

      toggleDetailModal();
  };

  document.querySelectorAll<HTMLElement>(".booking-row").forEach((row) => {
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.style.touchAction = "manipulation";
    row.style.cursor = "pointer";

    // iOS Safari: click events are unreliable on non-interactive elements inside
    // -webkit-overflow-scrolling containers. Use touchend + scroll detection.
    let touchStartY = 0;
    let touchMoved = false;

    row.addEventListener("touchstart", (e) => {
      touchStartY = e.touches[0].clientY;
      touchMoved = false;
    }, { passive: true });

    row.addEventListener("touchmove", () => {
      touchMoved = true;
    }, { passive: true });

    row.addEventListener("touchend", (e) => {
      if (!touchMoved) {
        e.preventDefault();
        openDetailForRow(row);
      }
    });

    row.addEventListener("click", () => openDetailForRow(row));
  });

  const setupCustomDropdown = (
    btnId: string,
    menuId: string,
    hiddenId: string,
    labelId: string,
    optionClass: string,
    onChange?: (val: string) => void,
  ): void => {
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    const hidden = document.getElementById(hiddenId) as HTMLInputElement | null;
    const label = document.getElementById(labelId);

    btn?.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menu?.classList.contains("opacity-100");

      document
        .querySelectorAll<HTMLElement>("[id$='-custom-menu'], [id$='-dropdown-menu']")
        .forEach((m) => {
          m.classList.remove("opacity-100", "scale-100", "pointer-events-auto");
          m.classList.add("opacity-0", "scale-95", "pointer-events-none");
        });

      if (!isOpen) {
        menu?.classList.remove("opacity-0", "scale-95", "pointer-events-none");
        menu?.classList.add("opacity-100", "scale-100", "pointer-events-auto");
      }
    });

    (menu?.querySelectorAll<HTMLElement>(`.${optionClass}`) ?? []).forEach((opt) => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        const val = opt.dataset.value ?? "";
        const lbl = opt.dataset.label ?? "";
        if (hidden) hidden.value = val;
        if (label) label.textContent = lbl;

        menu?.classList.remove("opacity-100", "scale-100", "pointer-events-auto");
        menu?.classList.add("opacity-0", "scale-95", "pointer-events-none");

        onChange?.(val);
      });
    });
  };

  const updatePriceAndFields = (): void => {
    const formEl = document.getElementById("new-booking-form");
    if (!formEl) return;

    const bookingType = (document.getElementById("booking_type_hidden") as HTMLInputElement | null)?.value || "transfer";
    const fixedRouteId = (document.getElementById("fixed_route_id_hidden") as HTMLInputElement | null)?.value || "";
    const vehicleCategory = (document.getElementById("vehicle_category_hidden") as HTMLInputElement | null)?.value || "";
    const durationHours = Number((document.getElementById("duration_hours") as HTMLInputElement | null)?.value || "1");
    const kmInput = document.getElementById("distance_km") as HTMLInputElement | null;
    const manualTotalInput = document.querySelector<HTMLInputElement>("input[name='manual_total']");
    const pickupInput = document.querySelector<HTMLInputElement>("input[name='pickup']");
    const dropoffInput = document.querySelector<HTMLInputElement>("input[name='dropoff']");

    // --- Forfait fixe ---
    if (fixedRouteId && bookingType !== "hourly") {
      try {
        const fixedRoutes = JSON.parse(formEl.getAttribute("data-fixed-routes") || "[]");
        const route = fixedRoutes.find((r: any) => r.id === fixedRouteId);
        if (route) {
          const matched = fixedRoutes.find((r: any) =>
            r.pickup_zone_id === route.pickup_zone_id &&
            r.dropoff_zone_id === route.dropoff_zone_id &&
            r.vehicle_category.toLowerCase() === vehicleCategory.toLowerCase()
          ) || route;
          if (manualTotalInput) manualTotalInput.value = Number(matched.price).toFixed(2);
          if (pickupInput && !pickupInput.value.trim()) pickupInput.value = `${route.pickup_zone?.name || ""} - `;
          if (dropoffInput && !dropoffInput.value.trim()) dropoffInput.value = `${route.dropoff_zone?.name || ""} - `;
        }
      } catch { /* ignore */ }
      return;
    }

    // --- Tarif dynamique (module partagé) ---
    try {
      const rules = JSON.parse(formEl.getAttribute("data-pricing-rules") || "[]") as PricingRule[];
      const rule = findPricingRule(rules, vehicleCategory);
      if (!rule) return;

      const km = Number(kmInput?.value || 0);

      const madsMode = (document.getElementById("mads_mode_hidden") as HTMLInputElement | null)?.value ?? "";
      // Si hourly et aucun mode sélectionné, on ne calcule pas encore
      if (bookingType === "hourly" && !madsMode) return;

      const effectiveType = bookingType === "hourly"
        ? (madsMode === "km" ? "transfer" : "hourly")
        : "transfer";

      if (effectiveType === "transfer" && km <= 0) return;
      if (effectiveType === "hourly" && durationHours <= 0) return;

      const total = calculatePrice({
        bookingType: effectiveType,
        distanceKm: km,
        durationHours,
        rule,
      });

      if (manualTotalInput) manualTotalInput.value = total.toFixed(2);
    } catch { /* ignore */ }
  };

  const durationHoursInput = document.getElementById("duration_hours");
  durationHoursInput?.addEventListener("input", () => {
    updatePriceAndFields();
  });

  const distanceKmInput = document.getElementById("distance_km");
  distanceKmInput?.addEventListener("input", () => {
    updatePriceAndFields();
  });

  const dropoffInput = document.querySelector<HTMLInputElement>("#dropoff-input");
  setupCustomDropdown(
    "type-custom-btn",
    "type-custom-menu",
    "booking_type_hidden",
    "type-custom-label",
    "custom-option",
    (val) => {
      const durationHoursContainer = document.getElementById("duration-hours-container");
      const forfaitSelectorContainer = document.getElementById("forfait-selector-container");
      const distanceKmContainer = document.getElementById("distance-km-container");
      const madsContainer = document.getElementById("mads-mode-container");

      if (!dropoffInput) return;

      // Reset montant, adresses et km/heures à chaque changement de type
      const pickupInput = document.querySelector<HTMLInputElement>("input[name='pickup']");
      const manualTotalInput = document.querySelector<HTMLInputElement>("input[name='manual_total']");
      const kmInput = document.getElementById("distance_km") as HTMLInputElement | null;
      const hoursInput = document.getElementById("duration_hours") as HTMLInputElement | null;
      if (pickupInput) pickupInput.value = "";
      if (dropoffInput) dropoffInput.value = "";
      if (manualTotalInput) manualTotalInput.value = "";
      if (kmInput) kmInput.value = "";
      if (hoursInput) hoursInput.value = "1";

      if (val === "hourly") {
        dropoffInput.required = false;
        dropoffInput.placeholder = "Adresse de fin (Optionnel)";

        madsContainer?.classList.remove("hidden");
        forfaitSelectorContainer?.classList.add("hidden");

        // Réinitialiser le forfait
        const fixedRouteHidden = document.getElementById("fixed_route_id_hidden") as HTMLInputElement | null;
        if (fixedRouteHidden) fixedRouteHidden.value = "";
        const forfaitLabel = document.getElementById("forfait-custom-label");
        if (forfaitLabel) forfaitLabel.textContent = "Aucun forfait";

        // Afficher km ou heure seulement si un mode a déjà été choisi
        const madsMode = (document.getElementById("mads_mode_hidden") as HTMLInputElement | null)?.value ?? "";
        if (madsMode === "km") {
          distanceKmContainer?.classList.remove("hidden");
          distanceKmContainer?.style.setProperty("display", "flex");
          durationHoursContainer?.classList.add("hidden");
          durationHoursContainer?.style.setProperty("display", "none");
        } else if (madsMode === "hour") {
          distanceKmContainer?.classList.add("hidden");
          distanceKmContainer?.style.setProperty("display", "none");
          durationHoursContainer?.classList.remove("hidden");
          durationHoursContainer?.style.setProperty("display", "flex");
        } else {
          // Aucun mode sélectionné : les deux restent cachés
          distanceKmContainer?.classList.add("hidden");
          durationHoursContainer?.classList.add("hidden");
        }
      } else {
        // Transfert — adresse arrivée obligatoire, pas de km/heures
        dropoffInput.required = true;
        dropoffInput.placeholder = "Adresse d'arrivée";

        madsContainer?.classList.add("hidden");
        durationHoursContainer?.classList.add("hidden");
        durationHoursContainer?.style.setProperty("display", "none");
        distanceKmContainer?.classList.add("hidden");
        distanceKmContainer?.style.setProperty("display", "none");
        forfaitSelectorContainer?.classList.remove("hidden");
      }
      updatePriceAndFields();
    },
  );

  setupCustomDropdown(
    "vehicle-custom-btn",
    "vehicle-custom-menu",
    "vehicle_id_hidden",
    "vehicle-custom-label",
    "custom-option-vehicle",
    (val) => {
      const menu = document.getElementById("vehicle-custom-menu");
      const opt = menu?.querySelector<HTMLElement>(`[data-value='${val}']`);
      const category = opt?.dataset.category || "";
      const categoryHidden = document.getElementById("vehicle_category_hidden") as HTMLInputElement | null;
      if (categoryHidden) {
        categoryHidden.value = category;
      }
      updatePriceAndFields();
    }
  );

  setupCustomDropdown(
    "forfait-custom-btn",
    "forfait-custom-menu",
    "fixed_route_id_hidden",
    "forfait-custom-label",
    "custom-option-forfait",
    (val) => {
      if (val) {
        const kmInput = document.getElementById("distance_km") as HTMLInputElement | null;
        if (kmInput) kmInput.value = "";
      }
      // km field stays hidden for transfer — price comes from forfait or manual entry
      updatePriceAndFields();
    }
  );

  // Sous-dropdown mise à dispo : km ↔ heure
  setupCustomDropdown(
    "mads-mode-btn",
    "mads-mode-menu",
    "mads_mode_hidden",
    "mads-mode-label",
    "custom-option-mads",
    (val) => {
      const durationHoursContainer = document.getElementById("duration-hours-container");
      const distanceKmContainer = document.getElementById("distance-km-container");
      if (val === "km") {
        distanceKmContainer?.classList.remove("hidden");
        distanceKmContainer?.style.setProperty("display", "flex");
        durationHoursContainer?.classList.add("hidden");
        durationHoursContainer?.style.setProperty("display", "none");
      } else {
        distanceKmContainer?.classList.add("hidden");
        distanceKmContainer?.style.setProperty("display", "none");
        durationHoursContainer?.classList.remove("hidden");
        durationHoursContainer?.style.setProperty("display", "flex");
      }
      updatePriceAndFields();
    },
  );

  setupCustomDropdown("payment-custom-btn", "payment-custom-menu", "payment_mode_hidden", "payment-custom-label", "custom-option-payment");

  const setupHeaderDropdown = (btnId: string, menuId: string): void => {
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    btn?.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menu?.classList.contains("opacity-100");
      document
        .querySelectorAll<HTMLElement>("[id$='-custom-menu'], [id$='-dropdown-menu']")
        .forEach((m) => {
          m.classList.remove("opacity-100", "scale-100", "pointer-events-auto");
          m.classList.add("opacity-0", "scale-95", "pointer-events-none");
        });
      if (!isOpen) {
        menu?.classList.remove("opacity-0", "scale-95", "pointer-events-none");
        menu?.classList.add("opacity-100", "scale-100", "pointer-events-auto");
      }
    });
  };

  setupHeaderDropdown("status-dropdown-button", "status-dropdown-menu");
  setupHeaderDropdown("type-dropdown-button", "type-dropdown-menu");

  window.addEventListener("click", () => {
    document.querySelectorAll<HTMLElement>("[id$='-custom-menu'], [id$='-dropdown-menu']").forEach((m) => {
      m.classList.remove("opacity-100", "scale-100", "pointer-events-auto");
      m.classList.add("opacity-0", "scale-95", "pointer-events-none");
    });
  });


  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector<HTMLButtonElement>("button[type='submit']");
    const originalText = submitBtn?.textContent ?? "";

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Création en cours...";
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const rawPickupTime = data.pickup_time as string;
    const payload = {
      ...data,
      pickup_time: rawPickupTime ? new Date(rawPickupTime).toISOString() : rawPickupTime,
      manual_total: data.manual_total,
    };

    try {
      const res = await fetch("/api/tenant/create-booking", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      const result = (await res.json()) as { success?: boolean; error?: string };
      if (result.success) {
        const { showToast } = await import('./toast');
        showToast('Course créée', 'success');
        setTimeout(() => { window.location.href = "/app/bookings"; }, 1600);
      } else {
        const { showToast } = await import('./toast');
        showToast(`Erreur : ${result.error || "Inconnue"}`, 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    } catch {
      const { showToast } = await import('./toast');
      showToast('Erreur réseau — vérifie ta connexion', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });

  // ── ANNULATION CHAUFFEUR ──────────────────────────────────────────────────
  const cancelBookingBtn = document.getElementById("cancel-booking-btn");
  const cancelFormArea = document.getElementById("cancel-form-area");
  const cancelTriggerArea = document.getElementById("cancel-trigger-area");
  const cancelConfirmBtn = document.getElementById("cancel-confirm-btn");
  const cancelBackBtn = document.getElementById("cancel-back-btn");

  cancelBookingBtn?.addEventListener("click", () => {
    cancelTriggerArea?.classList.add("hidden");
    cancelFormArea?.classList.remove("hidden");
  });

  cancelBackBtn?.addEventListener("click", () => {
    cancelFormArea?.classList.add("hidden");
    cancelTriggerArea?.classList.remove("hidden");
    const r = document.getElementById("cancel-reason") as HTMLTextAreaElement | null;
    if (r) r.value = "";
  });

  cancelConfirmBtn?.addEventListener("click", async () => {
    const reasonEl = document.getElementById("cancel-reason") as HTMLTextAreaElement | null;
    const reason = reasonEl?.value.trim() ?? "";
    if (!reason) {
      reasonEl?.focus();
      reasonEl?.classList.add("border-rose-500");
      return;
    }
    reasonEl?.classList.remove("border-rose-500");

    const bookingId = currentDetailBooking?.id;
    if (!bookingId) return;

    cancelConfirmBtn.textContent = "Annulation…";
    (cancelConfirmBtn as HTMLButtonElement).disabled = true;

    try {
      const res = await fetch("/api/tenant/booking-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", booking_id: bookingId, reason }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (data.success) {
        window.location.reload();
      } else {
        alert(data.error ?? "Erreur lors de l'annulation.");
        cancelConfirmBtn.textContent = "Confirmer l'annulation";
        (cancelConfirmBtn as HTMLButtonElement).disabled = false;
      }
    } catch {
      alert("Erreur réseau.");
      cancelConfirmBtn.textContent = "Confirmer l'annulation";
      (cancelConfirmBtn as HTMLButtonElement).disabled = false;
    }
  });

  // ── MODIFICATION COURSE ───────────────────────────────────────────────────
  const editModal = document.getElementById("edit-booking-modal");
  const editModalInner = document.getElementById("edit-modal-inner");
  const closeEditModalBtn = document.getElementById("close-edit-modal");
  const editModalOverlay = editModal?.querySelector<HTMLElement>(".edit-modal-overlay");
  const editForm = document.getElementById("edit-booking-form") as HTMLFormElement | null;

  const openEditModal = () => {
    if (!editModal || !currentDetailBooking) return;
    const b = currentDetailBooking;

    (document.getElementById("edit-booking-id") as HTMLInputElement).value = String(b.id ?? "");
    (document.getElementById("edit-booking-type") as HTMLInputElement).value = String(b.booking_type ?? "");
    (document.getElementById("edit-vehicle-id") as HTMLInputElement).value = String((b as any).vehicle_id ?? "");

    // Pickup time → format datetime-local
    if (b.pickup_time) {
      const d = new Date(b.pickup_time as string);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
      (document.getElementById("edit-pickup-time") as HTMLInputElement).value = local;
    }

    (document.getElementById("edit-pickup-address") as HTMLInputElement).value = String(b.pickup_address ?? "");
    (document.getElementById("edit-dropoff-address") as HTMLInputElement).value = String(b.dropoff_address ?? "");

    const isHourly = b.booking_type === "hourly";
    document.getElementById("edit-dropoff-container")?.classList.toggle("hidden", isHourly);
    document.getElementById("edit-distance-container")?.classList.toggle("hidden", isHourly);
    document.getElementById("edit-duration-container")?.classList.toggle("hidden", !isHourly);

    if (!isHourly) {
      (document.getElementById("edit-distance-km") as HTMLInputElement).value = String((b as any).distance_km ?? "");
    } else {
      (document.getElementById("edit-duration-hours") as HTMLInputElement).value = String((b as any).duration_hours ?? 1);
    }

    updateEditPricePreview();

    editModal.style.display = "flex";
    requestAnimationFrame(() => editModalInner?.classList.remove("scale-95"));
  };

  const closeEditModal = () => {
    if (!editModal) return;
    editModalInner?.classList.add("scale-95");
    setTimeout(() => { editModal.style.display = "none"; }, 300);
  };

  document.getElementById("modal-edit-btn")?.addEventListener("click", openEditModal);
  closeEditModalBtn?.addEventListener("click", closeEditModal);
  editModalOverlay?.addEventListener("click", closeEditModal);

  // Live price preview dans le modal édition
  const updateEditPricePreview = () => {
    const priceEl = document.getElementById("edit-price-preview");
    if (!priceEl || !editForm) return;

    const rules = JSON.parse(editForm.getAttribute("data-pricing-rules") || "[]") as import("@/lib/pricing").PricingRule[];
    const vehicleCategory = (document.getElementById("edit-vehicle-id") as HTMLInputElement)?.value ?? "";
    const bookingType = (document.getElementById("edit-booking-type") as HTMLInputElement)?.value ?? "transfer";

    const rule = findPricingRule(rules, vehicleCategory);
    if (!rule) { priceEl.textContent = "---€"; return; }

    const km = Number((document.getElementById("edit-distance-km") as HTMLInputElement)?.value || 0);
    const hours = Number((document.getElementById("edit-duration-hours") as HTMLInputElement)?.value || 1);

    const price = calculatePrice({
      bookingType: bookingType === "hourly" ? "hourly" : "transfer",
      distanceKm: km,
      durationHours: hours,
      rule,
    });

    priceEl.textContent = price > 0 ? `${price.toFixed(2)}€` : "---€";
  };

  document.getElementById("edit-distance-km")?.addEventListener("input", updateEditPricePreview);
  document.getElementById("edit-duration-hours")?.addEventListener("input", updateEditPricePreview);

  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("edit-submit-btn") as HTMLButtonElement | null;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Enregistrement…"; }

    const bookingId = (document.getElementById("edit-booking-id") as HTMLInputElement)?.value;
    const bookingType = (document.getElementById("edit-booking-type") as HTMLInputElement)?.value;
    const pickupTime = (document.getElementById("edit-pickup-time") as HTMLInputElement)?.value;
    const pickupAddress = (document.getElementById("edit-pickup-address") as HTMLInputElement)?.value;
    const dropoffAddress = (document.getElementById("edit-dropoff-address") as HTMLInputElement)?.value;
    const distanceKm = (document.getElementById("edit-distance-km") as HTMLInputElement)?.value;
    const durationHours = (document.getElementById("edit-duration-hours") as HTMLInputElement)?.value;

    const payload: Record<string, unknown> = {
      action: "update",
      booking_id: bookingId,
      pickup_time: new Date(pickupTime).toISOString(),
      pickup_address: pickupAddress,
    };

    if (bookingType !== "hourly") {
      payload.dropoff_address = dropoffAddress;
      if (distanceKm) payload.distance_km = Number(distanceKm);
    } else {
      if (durationHours) payload.duration_hours = Number(durationHours);
    }

    try {
      const res = await fetch("/api/tenant/booking-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (data.success) {
        window.location.reload();
      } else {
        alert(data.error ?? "Erreur lors de la modification.");
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Enregistrer les modifications"; }
      }
    } catch {
      alert("Erreur réseau.");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Enregistrer les modifications"; }
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (modal?.style.display === "flex") toggleNewBookingModal();
    if (detailModal?.style.display === "flex") toggleDetailModal();
    if (editModal?.style.display === "flex") closeEditModal();
  });

  const checkLateBookings = () => {
    const now = Date.now();
    document.querySelectorAll<HTMLElement>("[data-booking]").forEach(row => {
      try {
        const data = JSON.parse(decodeURIComponent(row.getAttribute("data-booking") ?? "{}"));
        if (data.mission_status !== "not_started" || !data.pickup_time) return;
        const isLate = now > new Date(data.pickup_time as string).getTime() + 5 * 60 * 1000;
        if (isLate) {
          row.style.outline = "1px solid rgba(239,68,68,0.45)";
          row.style.boxShadow = "0 0 0 1px rgba(239,68,68,0.25), 0 0 16px rgba(239,68,68,0.08)";
          row.style.borderColor = "rgba(239,68,68,0.4)";
        }
      } catch {}
    });
  };

  checkLateBookings();
  setInterval(checkLateBookings, 60_000);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", run);
} else {
  run();
}


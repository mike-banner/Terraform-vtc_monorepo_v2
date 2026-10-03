import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DialogProvider, ToastHost } from "@/ui";
import type { BookingRow } from "../../types";
import { CancelPanel } from "./CancelPanel";

const rpc = vi.fn();
const invoke = vi.fn();
const online = { canWrite: true, offlineMessage: "Hors ligne : action indisponible." };

vi.mock("@/lib/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock("@/app/useOnline", () => ({ useOnline: () => ({ status: "online", ...online }) }));
vi.mock("@/app/realtime", () => ({ BOOKINGS_KEYS: { all: ["bookings"], lists: ["bookings", "list"], detail: (id: string) => ["bookings", "detail", id] } }));

const PREVIEW = [
  { case_code: "client", rate: 1, amount: 100, paid: true },
  { case_code: "no_show", rate: null, amount: null, paid: true },
  { case_code: "driver_fault", rate: 1, amount: 100, paid: true },
  { case_code: "other", rate: null, amount: null, paid: true },
];
const booking = { id: "b-1" } as BookingRow;

function setup(caps: Parameters<typeof CancelPanel>[0]["caps"]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DialogProvider>
        <ToastHost>
          <CancelPanel booking={booking} caps={caps} />
        </ToastHost>
      </DialogProvider>
    </QueryClientProvider>,
  );
}
const cancelCaps = { cancelMode: "cancel", canRetryRefund: false } as const;

beforeEach(() => {
  rpc.mockReset();
  invoke.mockReset();
  online.canWrite = true;
  rpc.mockImplementation(async (fn: string) => (fn === "cancellation_preview" ? { data: PREVIEW, error: null } : { data: "ok", error: null }));
  invoke.mockResolvedValue({ data: { refund_status: "succeeded" }, error: null });
});

describe("CancelPanel", () => {
  it("affiche les 4 cas de l'aperçu et le montant remboursé du serveur", async () => {
    setup(cancelCaps);
    await userEvent.click(screen.getByRole("button", { name: "Annuler la course" }));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(4));
    expect(screen.getByText(/Montant remboursé : 100,00/)).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith("cancellation_preview", { p_booking_id: "b-1" });
  });

  it("le taux n'apparaît que pour no_show et other, et relance l'aperçu avec p_rate après 300 ms", async () => {
    setup(cancelCaps);
    await userEvent.click(screen.getByRole("button", { name: "Annuler la course" }));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(4));
    expect(screen.queryByLabelText(/Taux de remboursement/)).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText("Cas d'annulation"), "no_show");
    fireEvent.change(await screen.findByLabelText(/Taux de remboursement/), { target: { value: "40" } });
    expect(rpc).not.toHaveBeenCalledWith("cancellation_preview", { p_booking_id: "b-1", p_rate: 0.4 });
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("cancellation_preview", { p_booking_id: "b-1", p_rate: 0.4 }));
  });

  it("garde Confirmer désactivé tant que le motif est vide, puis annule avec le cas et le motif", async () => {
    setup(cancelCaps);
    await userEvent.click(screen.getByRole("button", { name: "Annuler la course" }));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(4));
    const confirmBtn = screen.getByRole("button", { name: "Confirmer l'annulation" }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText("Motif (obligatoire)"), "Client injoignable");
    expect(confirmBtn.disabled).toBe(false);
    await userEvent.click(confirmBtn);
    const buttons = await screen.findAllByRole("button", { name: "Confirmer l'annulation" });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("cancel-booking", { body: { booking_id: "b-1", case: "client", rate: undefined, note: "Client injoignable" } }));
  });

  it("mode no_show : appelle mark_booking_no_show avec le motif", async () => {
    setup({ cancelMode: "no_show", canRetryRefund: false });
    await userEvent.click(screen.getByRole("button", { name: "Non réalisée (client absent)" }));
    expect(screen.queryByLabelText("Cas d'annulation")).toBeNull();
    await userEvent.type(screen.getByLabelText("Motif (obligatoire)"), "Absent");
    await userEvent.click(screen.getByRole("button", { name: "Confirmer : non réalisée" }));
    const buttons = await screen.findAllByRole("button", { name: "Confirmer : non réalisée" });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("mark_booking_no_show", { p_booking_id: "b-1", p_reason: "Absent" }));
    expect(rpc).not.toHaveBeenCalledWith("cancellation_preview", expect.anything());
  });

  it("refund_failed : « Relancer le remboursement » appelle cancel-booking avec retry", async () => {
    setup({ cancelMode: null, canRetryRefund: true });
    await userEvent.click(screen.getByRole("button", { name: "Relancer le remboursement" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("cancel-booking", { body: { booking_id: "b-1", retry: true } }));
  });

  it("hors ligne : tous les boutons d'écriture sont désactivés avec le message", async () => {
    online.canWrite = false;
    setup({ cancelMode: "cancel", canRetryRefund: true });
    const buttons = screen.getAllByRole("button") as HTMLButtonElement[];
    expect(buttons.length).toBe(2);
    for (const b of buttons) {
      expect(b.disabled).toBe(true);
      expect(b.title).toBe(online.offlineMessage);
    }
  });
});

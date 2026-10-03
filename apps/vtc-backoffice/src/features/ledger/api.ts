import { useQuery } from "@tanstack/react-query";
import { rpc } from "@/lib/app-error";

export type LedgerMode = "all" | "card" | "cash";
export type LedgerTotals = { gross: number; net: number; vat: number; count: number };
export type LedgerYear = { months: ({ month: number } & LedgerTotals)[]; totals: LedgerTotals };
export type LedgerMovement = {
  id: string;
  created_at: string;
  movement_type: string;
  signed_gross: number;
  signed_net: number;
  signed_vat: number;
  booking_id: string;
  pickup_time: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  payment_mode: string | null;
  booking_status: string | null;
  customer_name: string | null;
  invoice_number: string | null;
  credit_note_number: string | null;
};
export type LedgerMonth = { totals: LedgerTotals; movements: LedgerMovement[] };

export const isRefund = (m: Pick<LedgerMovement, "movement_type">) => m.movement_type !== "payment";

// Montants et signes viennent des RPC (D-02) : aucune somme ni inversion de signe ici.
export const useLedgerYear = (year: number) =>
  useQuery({ queryKey: ["ledger", "year", year], queryFn: () => rpc<LedgerYear>("tenant_ledger_year", { p_year: year }) });

export const useLedgerMonth = (year: number, month: number | null, mode: LedgerMode) =>
  useQuery({
    queryKey: ["ledger", "month", year, month, mode],
    enabled: month != null,
    queryFn: () => rpc<LedgerMonth>("tenant_ledger_month", { p_year: year, p_month: month, p_mode: mode }),
  });

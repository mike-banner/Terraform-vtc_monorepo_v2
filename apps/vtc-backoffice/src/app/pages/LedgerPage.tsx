import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import { downloadExport } from "@/features/ledger/downloadExport";
import { MonthDetail } from "@/features/ledger/MonthDetail";
import { MONTH_FULL, MonthGrid } from "@/features/ledger/MonthGrid";
import type { LedgerMode } from "@/features/ledger/api";
import { Button, useToast } from "@/ui";
import { PageHeader } from "../shell/PageHeader";

const FIRST_YEAR = 2026;

export default function LedgerPage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [busy, setBusy] = useState<"fec" | "csv" | null>(null);
  const thisYear = new Date().getFullYear();
  const y = Number(params.get("year"));
  const year = Number.isInteger(y) && y >= FIRST_YEAR && y <= thisYear ? y : thisYear;
  const mo = Number(params.get("month"));
  const month = Number.isInteger(mo) && mo >= 1 && mo <= 12 ? mo : null;
  const mode: LedgerMode = params.get("mode") === "card" || params.get("mode") === "cash" ? (params.get("mode") as LedgerMode) : "all";
  const years = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);

  const go = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v == null || (k === "mode" && v === "all")) p.delete(k);
      else p.set(k, v);
    }
    setParams(p);
  };
  const exportYear = async (kind: "fec" | "csv") => {
    setBusy(kind);
    try {
      await downloadExport(kind, { fiscal_year: String(year) });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : "L'export a échoué.", tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-8">
      <PageHeader title={month ? `${MONTH_FULL[month - 1]} ${year}` : `Exercice ${year}`} />
      <div className="flex flex-wrap items-center gap-2">
        {month ? (
          <Button variant="secondary" onClick={() => go({ month: null, mode: null })}>
            Exercice {year}
          </Button>
        ) : null}
        <label className="flex items-center gap-2 text-sm font-bold">
          Année
          <select
            value={year}
            onChange={(e) => go({ year: e.target.value, month: null })}
            className="min-h-11 rounded-xl border border-border bg-card px-3"
          >
            {years.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" loading={busy === "csv"} onClick={() => exportYear("csv")}>
            <Download aria-hidden="true" className="size-4" />
            CSV annuel
          </Button>
          <Button variant="secondary" loading={busy === "fec"} onClick={() => exportYear("fec")}>
            <Download aria-hidden="true" className="size-4" />
            FEC annuel
          </Button>
        </div>
      </div>
      {month ? <MonthDetail year={year} month={month} mode={mode} onMode={(m) => go({ mode: m })} /> : <MonthGrid year={year} onSelect={(m) => go({ month: String(m) })} />}
    </div>
  );
}

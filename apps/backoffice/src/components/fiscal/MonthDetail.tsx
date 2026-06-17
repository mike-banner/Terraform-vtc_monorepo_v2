// src/components/fiscal/MonthDetail.tsx
import { Download, Search, X } from "lucide-react";
import React, { useMemo, useState } from "react";

interface Movement {
  id: string;
  created_at: string;
  booking_id: string;
  gross_amount: number;
  net_amount: number;
  vat_amount: number;
  bookings?: {
    id: string;
    pickup_time: string;
    payment_mode: string;
    customers?: {
      first_name?: string;
      last_name?: string;
      company_name?: string;
    };
  };
}

interface Props {
  movements: Movement[];
  monthLabel: string;
}

type ModeFilter = "all" | "card" | "cash";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function clientName(mv: Movement): string {
  const c = mv.bookings?.customers;
  if (!c) return "—";
  return c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
}

function exportCSV(rows: Movement[], monthLabel: string) {
  const headers = ["Date", "Heure", "Client", "Mode", "HT (€)", "TVA (€)", "ID Course"];
  const lines = rows.map((mv) => {
    const d = new Date(mv.created_at);
    const date = d.toLocaleDateString("fr-FR");
    const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const mode = mv.bookings?.payment_mode === "card" ? "Carte" : mv.bookings?.payment_mode === "cash" ? "Espèces" : "—";
    return [
      date,
      time,
      clientName(mv),
      mode,
      fmt(mv.net_amount ?? 0),
      fmt(mv.vat_amount ?? 0),
      mv.booking_id?.substring(0, 8) ?? "—",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(";");
  });

  const bom = "﻿";
  const csv = bom + [headers.join(";"), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fiscal-${monthLabel.toLowerCase().replace(/\s+/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export const MonthDetail: React.FC<Props> = ({ movements, monthLabel }) => {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<ModeFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements.filter((mv) => {
      const nameMatch = !q || clientName(mv).toLowerCase().includes(q);
      const modeMatch =
        mode === "all" ||
        (mode === "card" && mv.bookings?.payment_mode === "card") ||
        (mode === "cash" && mv.bookings?.payment_mode === "cash");
      return nameMatch && modeMatch;
    });
  }, [movements, search, mode]);

  const hasFilter = search.trim() !== "" || mode !== "all";

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-4">
        {/* Search input */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-8 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mode pills */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {(["all", "card", "cash"] as ModeFilter[]).map((m) => {
            const label = m === "all" ? "Tous" : m === "card" ? "Carte" : "Espèces";
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                  active
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : "bg-white/[0.04] text-slate-500 hover:bg-white/[0.08] hover:text-white border border-white/[0.06]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Export */}
        <button
          onClick={() => exportCSV(filtered, monthLabel)}
          className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex-shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
      </div>

      {/* Results count when filter active */}
      {hasFilter && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-slate-500 font-medium">
            {filtered.length} résultat{filtered.length !== 1 ? "s" : ""} sur {movements.length}
          </span>
          <button
            onClick={() => { setSearch(""); setMode("all"); }}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
          >
            Réinitialiser
          </button>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ minWidth: "360px" }}>
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-3 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[64px]">Date</th>
                  <th className="px-3 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Client</th>
                  <th className="px-2 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[56px]">Mode</th>
                  <th className="px-2 py-2.5 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest w-[64px]">HT</th>
                  <th className="px-2 py-2.5 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest w-[64px]">TVA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((mv) => {
                  const d = new Date(mv.created_at);
                  const c = mv.bookings?.customers;
                  const firstName = c?.first_name?.trim() || "";
                  const lastName = c?.last_name?.trim() || "";
                  const company = c?.company_name?.trim() || "";
                  const payMode = mv.bookings?.payment_mode;
                  return (
                    <tr key={mv.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-3 py-3 w-[64px]">
                        <div className="text-xs font-black text-white tabular-nums">
                          {d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        </div>
                        <div className="text-[10px] text-slate-600 mt-0.5 tabular-nums">
                          {d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="px-3 py-3 min-w-0">
                        {company ? (
                          <div className="text-xs font-bold text-white leading-tight truncate">{company}</div>
                        ) : (
                          <>
                            <div className="text-xs font-bold text-white leading-tight truncate">{firstName || "—"}</div>
                            {lastName && <div className="text-xs font-semibold text-slate-400 leading-tight truncate">{lastName}</div>}
                          </>
                        )}
                      </td>
                      <td className="px-2 py-3 w-[56px]">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                            payMode === "card"
                              ? "bg-indigo-500/10 text-indigo-400"
                              : "bg-white/[0.05] text-slate-400"
                          }`}
                        >
                          {payMode === "card" ? "Carte" : payMode === "cash" ? "Cash" : payMode ?? "—"}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right w-[64px]">
                        <span className="text-xs text-slate-300 tabular-nums font-semibold whitespace-nowrap">
                          {fmt(mv.net_amount ?? 0)} €
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right w-[64px]">
                        <span className={`text-xs tabular-nums font-semibold whitespace-nowrap ${(mv.vat_amount ?? 0) > 0 ? "text-emerald-400" : "text-slate-700"}`}>
                          {fmt(mv.vat_amount ?? 0)} €
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl px-6 py-12 text-center">
          {hasFilter ? (
            <>
              <div className="text-slate-400 text-sm font-bold mb-1">Aucune transaction trouvée</div>
              <div className="text-slate-600 text-xs">
                Essayez un autre nom ou{" "}
                <button
                  onClick={() => { setSearch(""); setMode("all"); }}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  réinitialisez les filtres
                </button>
              </div>
            </>
          ) : (
            <div className="text-slate-600 text-sm font-medium">
              Aucune transaction enregistrée pour ce mois.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

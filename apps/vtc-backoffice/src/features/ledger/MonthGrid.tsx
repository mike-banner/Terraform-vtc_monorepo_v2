import { formatEur } from "@/features/bookings/format";
import { Card, ErrorState, Skeleton } from "@/ui";
import { useLedgerYear, type LedgerTotals } from "./api";

export const MONTH_FULL = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const Kpi = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-lg font-bold tabular-nums">{value}</p>
  </div>
);

export function Totals({ totals }: { totals: LedgerTotals }) {
  return (
    <Card className="grid grid-cols-2 gap-4 md:grid-cols-4" data-testid="ledger-totals">
      <Kpi label="Total TTC" value={formatEur(totals.gross)} />
      <Kpi label="Chiffre d'affaires HT" value={formatEur(totals.net)} />
      <Kpi label="TVA collectée" value={formatEur(totals.vat)} />
      <Kpi label="Courses" value={String(totals.count)} />
    </Card>
  );
}

export function MonthGrid({ year, onSelect }: { year: number; onSelect: (month: number) => void }) {
  const { data, isLoading, isError, refetch } = useLedgerYear(year);
  if (isLoading) return <Skeleton lines={6} />;
  if (isError || !data) return <ErrorState message="Impossible de charger l'exercice." onRetry={() => refetch()} />;
  const now = new Date();
  const reachable = (m: number) => year < now.getFullYear() || (year === now.getFullYear() && m <= now.getMonth() + 1);

  return (
    <div className="space-y-4">
      <Totals totals={data.totals} />
      <ul className="grid gap-(--gap-grid) [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
        {data.months.map((m) => (
          <li key={m.month}>
            <button
              type="button"
              disabled={!reachable(m.month)}
              onClick={() => onSelect(m.month)}
              data-month={m.month}
              className="block min-h-11 w-full rounded-(--radius-card) border border-border bg-card p-3 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="block font-bold">{MONTH_FULL[m.month - 1]}</span>
              {reachable(m.month) ? (
                <>
                  <span className="block text-lg font-bold tabular-nums">{formatEur(m.gross)}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">HT {formatEur(m.net)} · TVA {formatEur(m.vat)}</span>
                  <span className="block text-xs text-muted-foreground">{m.count} course{m.count > 1 ? "s" : ""}</span>
                </>
              ) : (
                <span className="block text-sm text-muted-foreground">À venir</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

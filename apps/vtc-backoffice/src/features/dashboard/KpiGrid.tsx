import { useKpi, useRating } from "./queries";

const fr = (n: number, o?: Intl.NumberFormatOptions) => n.toLocaleString("fr-FR", o);

function Kpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl p-2 text-center lg:p-4">
      <p className="mb-1 text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums lg:text-3xl">
        {value}
        {unit ? <span className="ml-0.5 text-primary">{unit}</span> : null}
      </p>
    </div>
  );
}

/** Valeurs de tenant_dashboard_kpi affichées telles quelles : aucune somme côté navigateur. */
export function KpiGrid() {
  const kpi = useKpi();
  const rating = useRating();
  const dash = "–";
  return (
    <div role="group" aria-label="Indicateurs" className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
      <Kpi label="Balance" value={kpi.data ? fr(kpi.data.monthlyNetRevenue, { minimumFractionDigits: 0 }) : dash} unit="€" />
      <Kpi label="Missions" value={kpi.data ? fr(kpi.data.totalCount) : dash} />
      <Kpi label="Note" value={rating.data != null ? fr(rating.data, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : dash} unit="★" />
    </div>
  );
}

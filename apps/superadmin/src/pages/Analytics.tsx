import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3 } from 'lucide-react';

// Une ligne par tenant, plus une ligne de total (tenant_id null).
// Tous les montants sont agrégés en base par platform_tenant_analytics :
// ici on ne fait que les afficher (règle du projet : aucun calcul financier côté client).
interface AnalyticsRow {
  tenant_id: string | null;
  tenant_name: string;
  tenant_status: string | null;
  bookings_count: number;
  completed_count: number;
  cancelled_count: number;
  collected_gross: number;
  refunded_gross: number;
  revenue_gross: number;
  revenue_net: number;
  vat_collected: number;
}

type Period = 'month' | '30d' | '12m';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'Mois en cours' },
  { value: '30d', label: '30 derniers jours' },
  { value: '12m', label: '12 derniers mois' },
];

const periodRange = (period: Period): { from: string; to: string } => {
  const now = new Date();
  const to = new Date(now.getTime() + 1000); // borne haute exclue : inclure l'instant présent
  const from =
    period === 'month'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : period === '30d'
        ? new Date(now.getTime() - 30 * 24 * 3600 * 1000)
        : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  return { from: from.toISOString(), to: to.toISOString() };
};

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export const Analytics = () => {
  const [period, setPeriod] = useState<Period>('month');
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // setState uniquement dans le callback : react-hooks/set-state-in-effect.
  const fetchAnalytics = (p: Period) => {
    const { from, to } = periodRange(p);
    return supabase
      .rpc('platform_tenant_analytics', { p_from: from, p_to: to })
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
          setRows([]);
        } else {
          setError(null);
          setRows((data ?? []) as AnalyticsRow[]);
        }
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAnalytics(period);
  }, [period]);

  const changePeriod = (p: Period) => {
    setLoading(true);
    setPeriod(p);
  };

  const tenantRows = rows.filter((r) => r.tenant_id !== null);
  const total = rows.find((r) => r.tenant_id === null);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap gap-4 justify-between items-center border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-primary flex items-center">
          <BarChart3 className="mr-3 h-6 w-6 text-muted" />
          Analytics plateforme
        </h1>
        <select
          value={period}
          onChange={(e) => changePeriod(e.target.value as Period)}
          className="text-sm text-body bg-surface border border-border px-3 py-1.5 rounded-md shadow-sm"
          aria-label="Période"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-danger-subtle text-danger p-3 rounded-md text-sm border border-danger-soft">
          Erreur : {error}
        </div>
      )}

      {total && !loading && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <Kpi label="Courses" value={String(total.bookings_count)} hint={`${total.completed_count} terminées · ${total.cancelled_count} annulées`} />
          <Kpi label="CA brut (TTC)" value={euros.format(total.revenue_gross)} hint={`${euros.format(total.refunded_gross)} remboursés`} />
          <Kpi label="CA net (HT)" value={euros.format(total.revenue_net)} />
          <Kpi label="TVA collectée" value={euros.format(total.vat_collected)} />
        </div>
      )}

      {loading ? (
        <div className="text-muted">Chargement des données...</div>
      ) : (
        <div className="bg-surface rounded-lg border border-border shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-background">
              <tr>
                {['Entreprise', 'Courses', 'Terminées', 'Annulées', 'Encaissé', 'Remboursé', 'CA brut', 'CA net HT', 'TVA'].map((h, i) => (
                  <th key={h} className={`px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {tenantRows.map((r) => (
                <tr key={r.tenant_id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">
                    {r.tenant_name}
                    {r.tenant_status === 'suspended' && <span className="ml-2 text-xs text-danger">suspendu</span>}
                  </td>
                  <Num>{r.bookings_count}</Num>
                  <Num>{r.completed_count}</Num>
                  <Num>{r.cancelled_count}</Num>
                  <Num>{euros.format(r.collected_gross)}</Num>
                  <Num>{euros.format(r.refunded_gross)}</Num>
                  <Num strong>{euros.format(r.revenue_gross)}</Num>
                  <Num>{euros.format(r.revenue_net)}</Num>
                  <Num>{euros.format(r.vat_collected)}</Num>
                </tr>
              ))}
              {tenantRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-muted">Aucune entreprise.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Kpi = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="bg-surface rounded-lg border border-border shadow-sm p-4">
    <div className="text-xs font-medium text-muted uppercase tracking-wider">{label}</div>
    <div className="mt-1 text-2xl font-bold text-primary">{value}</div>
    {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
  </div>
);

const Num = ({ children, strong }: { children: ReactNode; strong?: boolean }) => (
  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${strong ? 'font-semibold text-primary' : 'text-body'}`}>
    {children}
  </td>
);

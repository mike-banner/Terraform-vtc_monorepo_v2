import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Power, PowerOff, Building } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  email: string | null;
  status: string;
  created_at: string;
}

export const TenantsList = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // setState uniquement dans le callback : react-hooks/set-state-in-effect.
  const fetchTenants = () =>
    // Since we are Super Admin, RLS should let us fetch all tenants
    supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setTenants(data as Tenant[]);
        } else {
          console.error(error);
        }
        setLoading(false);
      });

  useEffect(() => {
    fetchTenants();
  }, []);

  const refresh = () => {
    setLoading(true);
    fetchTenants();
  };

  const toggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const confirmMsg = newStatus === 'suspended' 
      ? "Êtes-vous sûr de vouloir SUSPENDRE cette entreprise ? Elle perdra l'accès au backoffice immédiatement." 
      : "Voulez-vous réactiver cette entreprise ?";

    if (!window.confirm(confirmMsg)) return;

    // L'écriture est autorisée par la policy `tenants_platform_admin_write`
    // (super_admin uniquement) — sans elle l'UPDATE passait à 0 ligne.
    const { data, error } = await supabase
      .from('tenants')
      .update({ status: newStatus })
      .eq('id', tenantId)
      .select('id');

    // `.select()` est indispensable : un UPDATE filtré par RLS renvoie 0 ligne
    // SANS erreur — l'UI affichait alors un faux succès.
    if (!error && data && data.length > 0) {
      setTenants(tenants.map(t => t.id === tenantId ? { ...t, status: newStatus } : t));
    } else {
      alert("Erreur lors de la modification du statut : " + (error?.message ?? 'droits insuffisants (super_admin requis)'));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-primary flex items-center">
          <Building className="mr-3 h-6 w-6 text-muted" />
          Liste des Entreprises
        </h1>
        <button 
          onClick={refresh}
          className="text-sm text-body hover:text-primary bg-surface border border-border px-3 py-1.5 rounded-md shadow-sm"
        >
          Rafraîchir
        </button>
      </div>

      {loading ? (
        <div className="text-muted">Chargement des données...</div>
      ) : (
        <div className="bg-surface rounded-lg border border-border shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-background">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Date d'inscription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                  Actions (Kill Switch)
                </th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">
                    {tenant.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                    {tenant.email ?? '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                    {new Date(tenant.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                      ${tenant.status === 'active' ? 'bg-success-soft text-success-strong' : 'bg-danger-soft text-danger-strong'}
                    `}>
                      {tenant.status || 'active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => toggleTenantStatus(tenant.id, tenant.status || 'active')}
                      className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-on-primary focus:outline-none focus:ring-2 focus:ring-offset-2
                        ${(tenant.status || 'active') === 'active' 
                          ? 'bg-danger hover:bg-danger-hover focus:ring-danger-ring' 
                          : 'bg-success hover:bg-success-hover focus:ring-success-ring'}
                      `}
                    >
                      {(tenant.status || 'active') === 'active' ? (
                        <>
                          <PowerOff className="mr-1.5 h-4 w-4" /> Suspendre
                        </>
                      ) : (
                        <>
                          <Power className="mr-1.5 h-4 w-4" /> Activer
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted">
                    Aucune entreprise trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Power, PowerOff, Building } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  contact_email: string;
  status: string;
  created_at: string;
}

export const TenantsList = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = async () => {
    setLoading(true);
    // Since we are Super Admin, RLS should let us fetch all tenants
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTenants(data as Tenant[]);
    } else {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const toggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const confirmMsg = newStatus === 'suspended' 
      ? "Êtes-vous sûr de vouloir SUSPENDRE cette entreprise ? Elle perdra l'accès au backoffice immédiatement." 
      : "Voulez-vous réactiver cette entreprise ?";

    if (!window.confirm(confirmMsg)) return;

    const { error } = await supabase
      .from('tenants')
      .update({ status: newStatus })
      .eq('id', tenantId);

    if (!error) {
      setTenants(tenants.map(t => t.id === tenantId ? { ...t, status: newStatus } : t));
    } else {
      alert("Erreur lors de la modification du statut.");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center">
          <Building className="mr-3 h-6 w-6 text-slate-500" />
          Liste des Entreprises
        </h1>
        <button 
          onClick={fetchTenants}
          className="text-sm text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-md shadow-sm"
        >
          Rafraîchir
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500">Chargement des données...</div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date d'inscription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions (Kill Switch)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {tenant.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {tenant.contact_email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {new Date(tenant.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                      ${tenant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                    `}>
                      {tenant.status || 'active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => toggleTenantStatus(tenant.id, tenant.status || 'active')}
                      className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2
                        ${(tenant.status || 'active') === 'active' 
                          ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                          : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'}
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
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
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

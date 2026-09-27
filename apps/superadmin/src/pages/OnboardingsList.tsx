import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Check, X, ClipboardCheck } from 'lucide-react';

interface Onboarding {
  id: string;
  company_name: string;
  first_name: string;
  last_name: string;
  legal_form: string | null;
  siret: string | null;
  vtc_license_number: string;
  primary_domain: string;
  phone: string;
  created_at: string | null;
}

export const OnboardingsList = () => {
  const [onboardings, setOnboardings] = useState<Onboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // setState uniquement dans le callback : react-hooks/set-state-in-effect.
  const fetchOnboardings = () =>
    // Lecture autorisée par la policy `onboarding_select_platform`.
    supabase
      .from('onboarding')
      .select('id, company_name, first_name, last_name, legal_form, siret, vtc_license_number, primary_domain, phone, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setOnboardings(data as Onboarding[]);
        } else {
          console.error(error);
        }
        setLoading(false);
      });

  useEffect(() => {
    fetchOnboardings();
  }, []);

  const refresh = () => {
    setLoading(true);
    fetchOnboardings();
  };

  const approve = async (ob: Onboarding) => {
    if (!window.confirm(`Approuver « ${ob.company_name} » ? Le tenant sera créé immédiatement.`)) return;
    setBusyId(ob.id);
    // approve_onboarding_tx vérifie elle-même le platform_role de l'appelant.
    const { error } = await supabase.rpc('approve_onboarding_tx', { onboarding_uuid: ob.id });
    setBusyId(null);
    if (error) {
      alert("Erreur lors de l'approbation : " + error.message);
      return;
    }
    setOnboardings(onboardings.filter(o => o.id !== ob.id));
  };

  const reject = async (ob: Onboarding) => {
    if (!window.confirm(`Rejeter le dossier « ${ob.company_name} » ?`)) return;
    setBusyId(ob.id);
    // `.select()` : un UPDATE filtré par RLS renvoie 0 ligne sans erreur.
    const { data, error } = await supabase
      .from('onboarding')
      .update({ status: 'rejected' })
      .eq('id', ob.id)
      .eq('status', 'pending')
      .select('id');
    setBusyId(null);
    if (error || !data || data.length === 0) {
      alert('Erreur lors du rejet : ' + (error?.message ?? 'dossier introuvable ou droits insuffisants'));
      return;
    }
    setOnboardings(onboardings.filter(o => o.id !== ob.id));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-primary flex items-center">
          <ClipboardCheck className="mr-3 h-6 w-6 text-muted" />
          Dossiers d'onboarding en attente
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
        <div className="bg-surface rounded-lg border border-border shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-background">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Entreprise</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Dirigeant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Forme / SIRET</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Carte VTC</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Déposé le</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {onboardings.map((ob) => (
                <tr key={ob.id} data-onboarding-id={ob.id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="font-medium text-primary">{ob.company_name}</div>
                    <div className="text-muted">{ob.primary_domain}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                    <div>{ob.first_name} {ob.last_name}</div>
                    <div>{ob.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                    <div className="uppercase">{ob.legal_form ?? '—'}</div>
                    <div>{ob.siret ?? '—'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{ob.vtc_license_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                    {ob.created_at ? new Date(ob.created_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => approve(ob)}
                      disabled={busyId === ob.id}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded shadow-sm text-on-primary bg-success hover:bg-success-hover disabled:opacity-50"
                    >
                      <Check className="mr-1.5 h-4 w-4" /> Approuver
                    </button>
                    <button
                      onClick={() => reject(ob)}
                      disabled={busyId === ob.id}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded shadow-sm text-on-primary bg-danger hover:bg-danger-hover disabled:opacity-50"
                    >
                      <X className="mr-1.5 h-4 w-4" /> Rejeter
                    </button>
                  </td>
                </tr>
              ))}

              {onboardings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    Aucun dossier en attente.
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

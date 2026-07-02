// src/components/dashboard/StripeConnectionCard.tsx

import { supabase } from '@/lib/supabase/client';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface StripeConnectionCardProps {
  tenantId: string;
  monthlyRevenue: number;
  totalCount: number;
  rating: number;
}

type StripeStatus = {
  type: 'onboarding' | 'dashboard';
  url: string;
};

export const StripeConnectionCard: React.FC<StripeConnectionCardProps> = ({
  tenantId,
  monthlyRevenue,
  totalCount,
  rating,
}) => {
  const [loading, setLoading] = useState(true);
  const [initialAccountIdMissing, setInitialAccountIdMissing] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStripeInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Charger les infos du tenant
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .select('id, stripe_account_id')
          .eq('id', tenantId)
          .limit(1)
          .maybeSingle();

        if (tenantError) throw tenantError;
        if (!tenant) throw new Error('Tenant non trouvé.');
        setStripeAccountId(tenant.stripe_account_id);
        setInitialAccountIdMissing(!tenant.stripe_account_id);

        // 2. Appeler la function Stripe
        // Le user précise que Stripe est la source de vérité, on appelle systématiquement
        const { data, error: functionError } = await supabase.functions.invoke(
          'create-stripe-onboarding',
          {
            body: { tenant_id: tenantId },
          },
        );

        if (functionError) throw functionError;

        const status = data as StripeStatus;
        setStripeStatus(status);
      } catch (err: any) {
        console.error('Error loading Stripe status:', err);
        setError(err.message || 'Une erreur est survenue lors du chargement de Stripe');
      } finally {
        setLoading(false);
      }
    };

    if (tenantId) {
      loadStripeInfo();
    }
  }, [tenantId]);

  const handleAction = () => {
    if (stripeStatus?.url) {
      window.open(stripeStatus.url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className='bg-card/50 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 animate-pulse text-center'>
        <div className='h-8 w-48 bg-white/5 rounded-full mx-auto mb-4' />
        <div className='h-4 w-32 bg-white/5 rounded-full mx-auto opacity-50' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-red-500/5 backdrop-blur-xl border border-red-500/10 rounded-[2rem] p-8'>
        <div className='flex items-center gap-5'>
          <div className='w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500'>
            <AlertTriangle className='w-6 h-6' />
          </div>
          <div>
            <h3 className='text-sm font-black uppercase text-foreground tracking-tight'>
              Erreur Stripe
            </h3>
            <p className='text-red-500/60 text-[10px] font-medium uppercase tracking-widest'>
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isDashboard = stripeStatus?.type === 'dashboard';

  // Configuration dynamique
  let title = '';
  let buttonLabel = '';

  if (initialAccountIdMissing) {
    title = 'Connexion Stripe requise';
    buttonLabel = 'Connecter Stripe';
  } else if (stripeStatus?.type === 'onboarding') {
    title = 'Configuration incomplète';
    buttonLabel = 'Finaliser Stripe';
  } else {
    title = 'Compte Stripe actif';
    buttonLabel = 'Dashboard Stripe';
  }

  return (
    <div
      onClick={stripeStatus?.url ? handleAction : undefined}
      className={`relative overflow-hidden bg-card/80 backdrop-blur-xl border rounded-[2rem] px-4 sm:px-8 py-5 sm:py-6 shadow-2xl transition-all duration-500 group w-full ${
        stripeStatus?.url ? 'cursor-pointer' : ''
      } ${isDashboard ? 'border-emerald-500/20' : 'border-primary/20'}`}>
      {/* Background Glow */}
      <div
        className={`absolute -top-24 -right-24 w-64 h-64 blur-[100px] opacity-10 rounded-full transition-all duration-700 ${
          isDashboard ? 'bg-emerald-500' : 'bg-primary'
        }`}
      />

      <div className='relative flex flex-col lg:flex-row lg:items-center justify-between gap-6'>
        {/* KPIs Section */}
        <div className='grid grid-cols-3 gap-2 md:gap-10 flex-1'>
          {/* Col 1: Total Revenue */}
          <div className='flex flex-col items-center text-center group/kpi hover:bg-white/[0.03] p-2 rounded-2xl transition-all'>
            <p className='text-[10px] md:text-[10px] font-black uppercase text-muted-foreground tracking-wider md:tracking-[0.2em] mb-1 md:mb-2 h-3 flex items-center justify-center whitespace-nowrap group-hover/kpi:text-primary transition-colors'>
              Balance
            </p>
            <div className='flex items-baseline gap-0.5 md:gap-1 leading-none'>
              <span className='text-base md:text-xl lg:text-2xl font-black tabular-nums text-foreground tracking-tighter leading-none group-hover/kpi:scale-110 transition-transform'>
                {monthlyRevenue.toLocaleString('fr-FR', {
                  minimumFractionDigits: 0,
                })}
              </span>
              <span className='text-primary font-black text-xs md:text-sm lg:text-base transition-colors leading-none'>
                €
              </span>
            </div>
          </div>

          {/* Col 2: Total Mission (All-time) */}
          <div className='flex flex-col items-center text-center group/kpi hover:bg-white/[0.03] p-2 rounded-2xl transition-all border-l border-white/5'>
            <p className='text-[10px] md:text-[10px] font-black uppercase text-muted-foreground tracking-wider md:tracking-[0.2em] mb-1 md:mb-2 h-3 flex items-center justify-center whitespace-nowrap group-hover/kpi:text-primary transition-colors'>
              Missions
            </p>
            <div className='flex items-baseline leading-none'>
              <span className='text-base md:text-xl lg:text-2xl font-black tabular-nums text-foreground tracking-tighter leading-none group-hover/kpi:scale-110 transition-transform'>
                {totalCount}
              </span>
            </div>
          </div>

          {/* Col 3: Note */}
          <div className='flex flex-col items-center text-center group/kpi hover:bg-white/[0.03] p-2 rounded-2xl transition-all border-l border-white/5'>
            <p className='text-[10px] md:text-[10px] font-black uppercase text-muted-foreground tracking-wider md:tracking-[0.2em] mb-1 md:mb-2 h-3 flex items-center justify-center whitespace-nowrap group-hover/kpi:text-amber-400 transition-colors'>
              Note
            </p>
            <div className='flex items-baseline gap-0.5 md:gap-1 leading-none'>
              <span className='text-base md:text-xl lg:text-2xl font-black tabular-nums text-foreground tracking-tighter leading-none group-hover/kpi:scale-110 transition-transform'>
                {rating.toFixed(1)}
              </span>
              <span className='text-amber-500 font-black text-[10px] md:text-xs lg:text-sm transition-colors leading-none'>
                ★
              </span>
            </div>
          </div>
        </div>

        {/* Action Section */}
        <div className='flex flex-col md:items-end gap-5 shrink-0'>
          <div className='flex items-center gap-3'>
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors duration-500 ${
                initialAccountIdMissing
                  ? 'bg-slate-500/10 text-slate-500 border-slate-500/10'
                  : stripeStatus?.type === 'onboarding'
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/10'
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10'
              }`}>
              <span
                className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${
                  initialAccountIdMissing
                    ? 'bg-slate-500'
                    : stripeStatus?.type === 'onboarding'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
              />
              {initialAccountIdMissing
                ? 'Non configuré'
                : stripeStatus?.type === 'onboarding'
                  ? 'En cours'
                  : 'Actif'}
            </div>
            <h3 className='text-xs font-black uppercase text-muted-foreground tracking-widest leading-none'>
              Stripe Connect
            </h3>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleAction(); }}
            disabled={!stripeStatus?.url}
            className={`px-4 py-3 md:px-6 md:py-3.5 text-xs font-black uppercase tracking-wider rounded-lg md:rounded-xl transition-all active:scale-95 shadow-xl inline-flex items-center justify-center gap-2 shrink-0 min-h-[44px] ${
              isDashboard
                ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'
            }`}>
            {buttonLabel}
            <ExternalLink className='w-3.5 h-3.5' />
          </button>
        </div>
      </div>
    </div>
  );
};

// src/pages/api/tenant/export-fec.ts
// Export du journal des ventes au format FEC (art. A47 A-1 du LPF), par exercice.
// La mise en forme comptable vit dans src/lib/fec.ts (testée en CI).
import { createServerClient } from '@vtc/database';
import { parseCookieHeader } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import type { APIRoute } from 'astro';
import { buildFec, fecFilename, toLatin9, type FecMovement } from '../../../lib/fec';

// Date et heure locales de Paris, triables : "2026-03-15T11:00:00".
const parisDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }).replace(' ', 'T');

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  const { user, profile } = locals as any;
  if (!user || !profile?.tenant_id) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Rôle vérifié par le middleware (ROUTE_POLICY : owner + manager).

  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () =>
          parseCookieHeader(request.headers.get('Cookie') ?? '').map((c) => ({
            name: c.name,
            value: c.value ?? '',
          })),
        setAll: (cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            cookies.set(name, value, options)
          ),
      },
    }
  );

  // Le FEC se produit par exercice : pas d'export mensuel.
  const fiscalYear = parseInt(new URL(request.url).searchParams.get('fiscal_year') ?? '', 10);
  if (!Number.isInteger(fiscalYear)) {
    return new Response('Param fiscal_year requis', { status: 400 });
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('siret, fiscal_year_start_month')
    .eq('id', profile.tenant_id)
    .single() as any;

  if (!tenant?.siret) {
    return new Response('SIRET manquant : renseignez-le dans les réglages avant d\'exporter le FEC.', { status: 400 });
  }

  // Mêmes bornes d'exercice que l'export CSV.
  const fiscalStartMonth: number = tenant.fiscal_year_start_month ?? 1;
  const start = new Date(fiscalYear, fiscalStartMonth - 1, 1);
  const endYear = fiscalStartMonth === 1 ? fiscalYear : fiscalYear + 1;
  const endMonth = fiscalStartMonth === 1 ? 12 : fiscalStartMonth - 1;
  const closing = new Date(endYear, endMonth, 0);
  const end = new Date(endYear, endMonth, 0, 23, 59, 59);

  const { data: movements, error } = await supabase
    .from('financial_movements')
    .select(`
      id, created_at, movement_type, direction, gross_amount, vat_amount,
      bookings!inner ( id, payment_mode, invoice_number, pickup_address, dropoff_address )
    `)
    .eq('tenant_id', profile.tenant_id)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: true }) as any;

  if (error) {
    return new Response(`Erreur: ${error.message}`, { status: 500 });
  }

  const rows: FecMovement[] = (movements ?? []).map((m: any) => ({
    created_at: parisDateTime(m.created_at),
    movement_type: m.movement_type,
    direction: m.direction,
    gross_amount: m.gross_amount,
    vat_amount: m.vat_amount,
    payment_mode: m.bookings?.payment_mode ?? null,
    piece_ref: m.bookings?.invoice_number ?? `COURSE-${String(m.bookings?.id ?? m.id).slice(0, 8)}`,
    label: `Course ${m.bookings?.pickup_address ?? ''} > ${m.bookings?.dropoff_address ?? ''}`.slice(0, 120),
  }));

  return new Response(toLatin9(buildFec(rows)), {
    headers: {
      'Content-Type': 'text/plain; charset=iso-8859-15',
      'Content-Disposition': `attachment; filename="${fecFilename(tenant.siret, closing)}"`,
    },
  });
};

// src/pages/api/tenant/export-csv.ts
import { createServerClient } from '@vtc/database';
import { parseCookieHeader } from '@supabase/ssr';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  const { user, profile } = locals as any;
  if (!user || !profile?.tenant_id) {
    return new Response('Unauthorized', { status: 401 });
  }

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
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            cookies.set(name, value, options)
          ),
      },
    }
  );

  const url = new URL(request.url);
  const monthParam = url.searchParams.get('month');   // "2026-06"
  const fiscalYear = url.searchParams.get('fiscal_year'); // "2026"

  // Récupération du fiscal_year_start_month du tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('fiscal_year_start_month')
    .eq('id', profile.tenant_id)
    .single() as any;

  const fiscalStartMonth: number = tenant?.fiscal_year_start_month ?? 1;

  // Calcul des bornes de date
  let startDate: string;
  let endDate: string;
  let filename: string;

  if (monthParam) {
    const [y, m] = monthParam.split('-').map(Number);
    startDate = new Date(y, m - 1, 1).toISOString();
    endDate   = new Date(y, m, 0, 23, 59, 59).toISOString();
    filename  = `export-comptable-${monthParam}.csv`;
  } else if (fiscalYear) {
    const fy = parseInt(fiscalYear);
    // Exercice fiscal : de fiscalStartMonth de l'année fy à fiscalStartMonth-1 de fy+1
    startDate = new Date(fy, fiscalStartMonth - 1, 1).toISOString();
    const endYear  = fiscalStartMonth === 1 ? fy : fy + 1;
    const endMonth = fiscalStartMonth === 1 ? 12 : fiscalStartMonth - 1;
    endDate   = new Date(endYear, endMonth, 0, 23, 59, 59).toISOString();
    filename  = `export-comptable-exercice-${fy}.csv`;
  } else {
    return new Response('Param month (YYYY-MM) ou fiscal_year requis', { status: 400 });
  }

  const { data: movements, error } = await supabase
    .from('financial_movements')
    .select(`
      id, created_at, movement_type, direction,
      gross_amount, net_amount, vat_amount,
      stripe_payment_intent_id, created_by_event,
      bookings!inner (
        id, pickup_address, dropoff_address, pickup_time,
        payment_mode, invoice_number,
        customers (first_name, last_name, company_name)
      )
    `)
    .eq('tenant_id', profile.tenant_id)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true }) as any;

  if (error) {
    return new Response(`Erreur: ${error.message}`, { status: 500 });
  }

  const rows: string[] = [];
  const sep = ';';
  rows.push([
    'Date',
    'N° Facture',
    'Client',
    'Adresse départ',
    'Adresse arrivée',
    'Date course',
    'Type mouvement',
    'Mode paiement',
    'Montant TTC',
    'TVA',
    'Montant HT',
    'Réf. Stripe',
    'Source',
  ].join(sep));

  for (const m of movements ?? []) {
    const b = m.bookings;
    const c = b?.customers;
    const clientName = c
      ? (c.company_name || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim())
      : '';
    const courseDate = b?.pickup_time
      ? new Date(b.pickup_time).toLocaleDateString('fr-FR')
      : '';

    rows.push([
      new Date(m.created_at).toLocaleDateString('fr-FR'),
      b?.invoice_number ?? '',
      `"${clientName.replace(/"/g, '""')}"`,
      `"${(b?.pickup_address ?? '').replace(/"/g, '""')}"`,
      `"${(b?.dropoff_address ?? '').replace(/"/g, '""')}"`,
      courseDate,
      m.movement_type,
      b?.payment_mode ?? '',
      String(m.gross_amount ?? 0).replace('.', ','),
      String(m.vat_amount ?? 0).replace('.', ','),
      String(m.net_amount ?? 0).replace('.', ','),
      m.stripe_payment_intent_id ?? '',
      m.created_by_event ?? '',
    ].join(sep));
  }

  const csv = '﻿' + rows.join('\r\n'); // BOM UTF-8 pour Excel FR

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};

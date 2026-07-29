import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

// Polyfill WebSocket pour Node 20
if (!globalThis.WebSocket) {
  (globalThis as any).WebSocket = ws;
}

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log("🚀 Seeding avancé du compte test-demo (Tarifs, Flotte, Clients, Courses, Factures)...");

  const demoEmail = 'test-demo@vtc.fr';
  const demoPassword = 'TestDemo2026!';

  // 1. Auth User
  const { data: usersData } = await supabase.auth.admin.listUsers();
  let user = usersData?.users.find(u => u.email === demoEmail);

  if (!user) {
    console.log("Création de l'user Auth...");
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { first_name: 'Alexandre', last_name: 'Dupont' }
    });
    if (createError) {
      console.error("Erreur création user:", createError);
      process.exit(1);
    }
    user = newUser.user;
  } else {
    console.log("Utilisateur existant:", user.id);
    await supabase.auth.admin.updateUserById(user.id, { password: demoPassword });
  }

  const userId = user.id;

  // 2. Tenant
  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('name', 'VTC Elite Demo')
    .maybeSingle();

  let tenantId = existingTenant?.id;

  if (!tenantId) {
    console.log("Création du tenant VTC Elite Demo...");
    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: 'VTC Elite Demo',
        primary_domain: 'test-demo.vtc.fr',
        email: demoEmail,
        phone: '01 42 68 55 00',
        siret: '99988877700011',
        legal_form: 'sasu',
        company_type: 'societe',
        capital_social: 10000,
        address: '25 Avenue des Champs-Élysées, 75008 Paris',
        vat_number: 'FR99988877700',
        setup_completed: true
      })
      .select()
      .single();

    if (tenantError) {
      console.error("Erreur création tenant:", tenantError);
      process.exit(1);
    }
    tenantId = newTenant.id;
  } else {
    // S'assurer que setup_completed est true
    await supabase.from('tenants').update({ setup_completed: true }).eq('id', tenantId);
  }

  // 3. Profile Owner
  await supabase.from('profiles').upsert({
    id: userId,
    tenant_id: tenantId,
    tenant_role: 'owner',
    first_name: 'Alexandre',
    last_name: 'Dupont'
  });

  // 4. Règles Tarifaires (Pricing Rules)
  console.log("Configuration des règles tarifaires...");
  await supabase.from('pricing_rules').delete().eq('tenant_id', tenantId);
  await supabase.from('pricing_rules').insert([
    {
      tenant_id: tenantId,
      service_category: 'berline_eco',
      base_price: 15.00,
      price_per_km: 2.20,
      minimum_fare: 25.00,
      active: true
    },
    {
      tenant_id: tenantId,
      service_category: 'berline_business',
      base_price: 25.00,
      price_per_km: 3.50,
      minimum_fare: 45.00,
      active: true
    },
    {
      tenant_id: tenantId,
      service_category: 'van_prestige',
      base_price: 35.00,
      price_per_km: 4.20,
      minimum_fare: 65.00,
      active: true
    }
  ]);

  // 5. Chauffeurs de la flotte (Drivers)
  console.log("Création des chauffeurs...");
  // Check / Upsert Driver Titulaire
  const { data: existingOwnerDriver } = await supabase
    .from('drivers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  let ownerDriverId = existingOwnerDriver?.id;
  if (!ownerDriverId) {
    const { data: d1 } = await supabase.from('drivers').insert({
      tenant_id: tenantId,
      user_id: userId,
      first_name: 'Alexandre',
      last_name: 'Dupont',
      phone: '06 12 34 56 78',
      license_number: 'VTC-75-2026-001'
    }).select().single();
    ownerDriverId = d1?.id;
  }

  // 6. Flotte de Véhicules (Vehicles)
  console.log("Configuration des véhicules...");
  await supabase.from('vehicles').delete().eq('tenant_id', tenantId);
  await supabase.from('vehicles').insert([
    {
      tenant_id: tenantId,
      driver_id: ownerDriverId,
      brand: 'Mercedes-Benz',
      model: 'Classe S 580e Executive',
      plate_number: 'EK-789-VT'
    },
    {
      tenant_id: tenantId,
      brand: 'BMW',
      model: 'i7 xDrive60 Limousine',
      plate_number: 'FS-456-EV'
    },
    {
      tenant_id: tenantId,
      brand: 'Mercedes-Benz',
      model: 'Classe V 300d Extra-Long',
      plate_number: 'GH-123-VN'
    }
  ]);

  // 7. Base de Clients (Customers)
  console.log("Création du répertoire clients...");
  await supabase.from('customers').delete().eq('tenant_id', tenantId);

  const { data: customersData, error: custError } = await supabase.from('customers').insert([
    {
      tenant_id: tenantId,
      first_name: 'Jean',
      last_name: 'Moreau',
      email: 'jean.moreau@example.com',
      phone: '06 98 76 54 32',
      city: 'Paris',
      postal_code: '75008'
    },
    {
      tenant_id: tenantId,
      first_name: 'Sophie',
      last_name: 'Bernard',
      email: 'sophie.bernard@luxury-events.fr',
      phone: '06 11 22 33 44',
      city: 'Neuilly-sur-Seine',
      postal_code: '92200'
    },
    {
      tenant_id: tenantId,
      first_name: 'Cabinet Lazard',
      last_name: '& Associés',
      email: 'facturation@lazard-associes.com',
      phone: '01 40 50 60 70',
      city: 'Paris',
      postal_code: '75001'
    }
  ]).select();

  if (custError) {
    console.error("Erreur insertion clients:", custError);
  }

  const c1 = customersData?.[0]?.id;
  const c2 = customersData?.[1]?.id;
  const c3 = customersData?.[2]?.id;

  // 8. Nettoyage et Création des Courses Multi-Dates (Bookings & Financial Movements)
  console.log("Création du planning des courses & historique comptable...");
  await supabase.from('financial_movements').delete().eq('tenant_id', tenantId);
  await supabase.from('bookings').delete().eq('current_tenant_id', tenantId);

  const now = new Date();

  // Dates relatives
  const datePass5Days = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const datePass2Days = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const dateTodayInProgress = new Date(now.getTime() - 30 * 60 * 1000).toISOString(); // Démarré il y a 30m
  const dateTomorrowUpcoming = new Date(now.getTime() + 14 * 60 * 60 * 1000).toISOString(); // Demain matin
  const dateIn3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

  // Insert Bookings
  const { data: bookingsData, error: bookError } = await supabase.from('bookings').insert([
    {
      original_tenant_id: tenantId,
      current_tenant_id: tenantId,
      customer_id: c1,
      booking_type: 'transfer',
      booking_source: 'customer',
      pricing_mode: 'direct',
      pickup_address: 'Hôtel Le Meurice, 228 Rue de Rivoli, 75001 Paris',
      dropoff_address: 'Aéroport Paris-Charles de Gaulle (CDG), Terminal 2E',
      pickup_time: datePass5Days,
      subtotal_amount: 127.27,
      vat_amount: 12.73,
      total_amount: 140.00,
      payment_mode: 'card',
      status: 'completed',
      mission_status: 'completed'
    },
    {
      original_tenant_id: tenantId,
      current_tenant_id: tenantId,
      customer_id: c2,
      booking_type: 'transfer',
      booking_source: 'customer',
      pricing_mode: 'direct',
      pickup_address: '25 Avenue Montaigne, 75008 Paris',
      dropoff_address: 'Château de Versailles, Place d\'Armes, 78000 Versailles',
      pickup_time: datePass2Days,
      subtotal_amount: 190.91,
      vat_amount: 19.09,
      total_amount: 210.00,
      payment_mode: 'stripe',
      status: 'paid',
      mission_status: 'completed'
    },
    {
      original_tenant_id: tenantId,
      current_tenant_id: tenantId,
      customer_id: c3,
      booking_type: 'transfer',
      booking_source: 'customer',
      pricing_mode: 'direct',
      pickup_address: 'Aéroport de Paris-Orly (ORY), Terminal 4',
      dropoff_address: 'Hôtel George V, 31 Avenue George V, 75008 Paris',
      pickup_time: dateTodayInProgress,
      subtotal_amount: 86.36,
      vat_amount: 8.64,
      total_amount: 95.00,
      payment_mode: 'card',
      status: 'accepted',
      mission_status: 'in_progress'
    },
    {
      original_tenant_id: tenantId,
      current_tenant_id: tenantId,
      customer_id: c2,
      booking_type: 'hourly',
      booking_source: 'manual_driver',
      pricing_mode: 'manual',
      pickup_address: 'Place Vendôme, 75001 Paris',
      dropoff_address: 'Fondation Louis Vuitton, 8 Avenue du Mahatma Gandhi, 75116 Paris',
      pickup_time: dateTomorrowUpcoming,
      subtotal_amount: 163.64,
      vat_amount: 16.36,
      total_amount: 180.00,
      payment_mode: 'card',
      status: 'accepted',
      mission_status: 'not_started'
    },
    {
      original_tenant_id: tenantId,
      current_tenant_id: tenantId,
      customer_id: c3,
      booking_type: 'transfer',
      booking_source: 'customer',
      pricing_mode: 'direct',
      pickup_address: 'Gare de Lyon, Place Louis-Armand, 75012 Paris',
      dropoff_address: 'Palais des Congrès, 2 Place de la Porte Maillot, 75017 Paris',
      pickup_time: dateIn3Days,
      subtotal_amount: 68.18,
      vat_amount: 6.82,
      total_amount: 75.00,
      payment_mode: 'cash',
      status: 'pending',
      mission_status: 'to_validate'
    }
  ]).select();

  if (bookError) {
    console.error("Erreur insertion bookings:", bookError);
  }

  // 9. Insérer les mouvements financiers pour les 2 courses terminées
  const b1 = bookingsData?.[0];
  const b2 = bookingsData?.[1];

  if (b1 && b2) {
    console.log("Génération des mouvements comptables & factures...");
    await supabase.from('financial_movements').insert([
      {
        booking_id: b1.id,
        tenant_id: tenantId,
        movement_type: 'payment',
        direction: 'credit',
        gross_amount: 140.00,
        net_amount: 126.00,
        vat_amount: 14.00,
        created_by_event: 'seed_demo'
      },
      {
        booking_id: b2.id,
        tenant_id: tenantId,
        movement_type: 'payment',
        direction: 'credit',
        gross_amount: 210.00,
        net_amount: 189.00,
        vat_amount: 21.00,
        created_by_event: 'seed_demo'
      }
    ]);
  }

  console.log("\n=======================================================");
  console.log("✅ SEED COMPLET DU COMPTE DEMO EFFECTUÉ AVEC SUCCÈS !");
  console.log("=======================================================");
  console.log(`- Email Login   : ${demoEmail}`);
  console.log(`- Mot de Passe  : ${demoPassword}`);
  console.log(`- Entreprise    : VTC Elite Demo`);
  console.log(`- Tarifs        : 3 grilles (Eco 2.20€, Business 3.50€, Van 4.20€)`);
  console.log(`- Véhicules     : 3 véhicules de prestige`);
  console.log(`- Courses       : 5 courses (2 terminées & facturées, 1 en cours, 2 à venir)`);
  console.log("=======================================================");
}

main().catch((err) => {
  console.error("Erreur script seed:", err);
  process.exit(1);
});

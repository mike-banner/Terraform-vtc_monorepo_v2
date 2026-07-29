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
  console.log("🚀 Initialisation du compte test-demo...");

  const demoEmail = 'test-demo@vtc.fr';
  const demoPassword = 'TestDemo2026!';

  // 1. Vérifier si l'utilisateur existe déjà
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  let user = usersData?.users.find(u => u.email === demoEmail);

  if (!user) {
    console.log("Création de l'utilisateur Auth...");
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { first_name: 'Alexandre', last_name: 'Dupont' }
    });

    if (createError) {
      console.error("Erreur lors de la création de l'user:", createError);
      process.exit(1);
    }
    user = newUser.user;
  } else {
    console.log("Utilisateur démo déjà existant:", user.id);
    // Mettre à jour le mot de passe si besoin
    await supabase.auth.admin.updateUserById(user.id, { password: demoPassword });
  }

  const userId = user.id;

  // 2. Créer / Récupérer le Tenant
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
        setup_completed: true
      })
      .select()
      .single();

    if (tenantError) {
      console.error("Erreur création tenant:", tenantError);
      process.exit(1);
    }
    tenantId = newTenant.id;
  }

  // 3. Assurer le Profil Owner
  console.log("Mise à jour du profil utilisateur...");
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      tenant_id: tenantId,
      tenant_role: 'owner',
      first_name: 'Alexandre',
      last_name: 'Dupont'
    });

  if (profileError) {
    console.error("Erreur profil:", profileError);
  }

  // 4. Assurer le Chauffeur (Driver)
  const { data: existingDriver } = await supabase
    .from('drivers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  let driverId = existingDriver?.id;
  if (!driverId) {
    console.log("Création du chauffeur...");
    const { data: newDriver, error: driverError } = await supabase
      .from('drivers')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        first_name: 'Alexandre',
        last_name: 'Dupont',
        phone: '06 12 34 56 78',
        license_number: 'VTC-75-2026-DEMO'
      })
      .select()
      .single();

    if (!driverError) driverId = newDriver.id;
  }

  // 5. Assurer le Véhicule
  const { data: existingVehicle } = await supabase
    .from('vehicles')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!existingVehicle && driverId) {
    console.log("Création du véhicule...");
    await supabase.from('vehicles').insert({
      tenant_id: tenantId,
      driver_id: driverId,
      brand: 'Mercedes-Benz',
      model: 'Classe S 580e',
      plate_number: 'EK-789-VT'
    });
  }

  // 6. Client de démo
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  let customerId = existingCustomer?.id;
  if (!customerId) {
    console.log("Création d'un client démo...");
    const { data: newCust, error: custError } = await supabase
      .from('customers')
      .insert({
        tenant_id: tenantId,
        first_name: 'Jean',
        last_name: 'Moreau',
        email: 'jean.moreau@example.com',
        phone: '06 98 76 54 32'
      })
      .select()
      .single();

    if (!custError) customerId = newCust.id;
  }

  // 7. Exemples de Réservations (Bookings)
  const { count } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('current_tenant_id', tenantId);

  if ((count || 0) === 0 && customerId) {
    console.log("Création des courses de démonstration...");
    const now = new Date();
    const todayCDG = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(); // +2h
    const tomorrowOrly = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // +24h

    await supabase.from('bookings').insert([
      {
        original_tenant_id: tenantId,
        current_tenant_id: tenantId,
        customer_id: customerId,
        pickup_address: 'Aéroport Paris-Charles de Gaulle (CDG), Terminal 2E',
        dropoff_address: 'Hotel Plaza Athénée, 25 Avenue Montaigne, 75008 Paris',
        pickup_time: todayCDG,
        total_amount: 120.00,
        status: 'confirmed',
        mission_status: 'not_started'
      },
      {
        original_tenant_id: tenantId,
        current_tenant_id: tenantId,
        customer_id: customerId,
        pickup_address: 'Gare de Lyon, Place Louis-Armand, 75012 Paris',
        dropoff_address: 'Aéroport de Paris-Orly (ORY), Terminal 4',
        pickup_time: tomorrowOrly,
        total_amount: 85.00,
        status: 'confirmed',
        mission_status: 'not_started'
      }
    ]);
  }

  console.log("\n✅ Compte test-demo prêt avec succès!");
  console.log(`- Email    : ${demoEmail}`);
  console.log(`- Password : ${demoPassword}`);
  console.log(`- Tenant   : VTC Elite Demo (${tenantId})`);
}

main().catch((err) => {
  console.error("Erreur script seed:", err);
  process.exit(1);
});

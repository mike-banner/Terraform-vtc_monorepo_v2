import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kpnkhmtxzigxtfnkmzru.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function investigate() {
  const { data: owner, error: oe } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', 'd175569d-7ef1-4fa9-85e0-dabd22d7e727'.split('-').slice(0, 5).join('-')) // Wait, I don't have the ID.
    .limit(1);

  // Let's just find the first tenant and its profiles
  const { data: tenants, error: te } = await supabase.from('tenants').select('id, name').limit(1);
  if (te || !tenants.length) {
    console.error('Tenant fetch error', te);
    return;
  }

  const tenantId = tenants[0].id;
  console.log('Investigating Tenant:', tenants[0].name, '(', tenantId, ')');

  // 1. List all profiles for this tenant
  const { data: allProfiles, error: pe } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, tenant_role')
    .eq('tenant_id', tenantId);

  console.log('\n--- Profiles for Tenant ---');
  console.table(allProfiles);

  // 2. List all drivers for this tenant
  const { data: drivers, error: de } = await supabase
    .from('drivers')
    .select('id, user_id, rank, first_name, last_name')
    .eq('tenant_id', tenantId);

  console.log('\n--- Drivers for Tenant ---');
  console.table(drivers);

  // 3. Find profiles without driver records
  const driverUserIds = new Set(drivers?.map((d) => d.user_id));
  const orphans = allProfiles?.filter((p) => !driverUserIds.has(p.id));

  console.log('\n--- Orphan Profiles (Potential deleted drivers) ---');
  console.table(orphans);
}

investigate();

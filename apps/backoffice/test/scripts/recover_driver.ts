import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kpnkhmtxzigxtfnkmzru.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function recoverDriver() {
  const tenantId = '3ef4a599-6787-4179-b7d7-7dfff05340df';
  const userId = '376f169e-b868-4f0a-b22a-4680f111b20e';

  // 1. Double check profile details
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', userId)
    .single();

  if (!profile) {
    console.error('Profile not found');
    return;
  }

  // 2. Create driver record
  const { data: driver, error } = await supabase
    .from('drivers')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      first_name: profile.first_name || 'Driver',
      last_name: profile.last_name || 'One',
      license_number: 'PENDING-RECOVERY',
      phone: '0000000000',
    })
    .select();

  if (error) {
    console.error('Error creating driver:', error);
  } else {
    console.log('Driver recovered:', driver);
  }
}

recoverDriver();

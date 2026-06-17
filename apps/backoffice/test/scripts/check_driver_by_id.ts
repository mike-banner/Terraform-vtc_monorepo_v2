import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kpnkhmtxzigxtfnkmzru.supabase.co';
const supabaseServiceRoleKey = 'sb_secret_ia9cDlWioZ-RN2XPFx9Z0A_i2_dEelC';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkDriverById() {
  const userId = '376f169e-b868-4f0a-b22a-4680f111b20e';

  const { data: driver, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching driver:', error);
  } else {
    console.log('Driver found:', driver);
  }
}

checkDriverById();

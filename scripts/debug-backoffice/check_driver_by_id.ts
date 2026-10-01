import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kpnkhmtxzigxtfnkmzru.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

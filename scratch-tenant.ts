import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('tenants').insert({
    name: 'VTC E2E Corp',
    siret: '12345678900012',
    vat_number: 'FR12123456789',
    address: '123 Rue de la Paix, Paris',
    status: 'active'
  }).select().single();
  console.log("Error:", error);
  console.log("Data:", data);
}
test();

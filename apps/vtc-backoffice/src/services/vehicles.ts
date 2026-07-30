import { supabase } from '@/lib/supabase/client';

export const getVehicles = async (tenantId: string) => {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const createVehicle = async (vehicle: {
  tenant_id: string;
  brand: string;
  model: string;
  plate_number: string;
  category: any;
  capacity: number;
  status: string;
}) => {
  // Règle : un seul véhicule actif. Si on en crée un actif, on désactive les autres.
  if (vehicle.status === 'active') {
    await supabase
      .from('vehicles')
      .update({ status: 'inactive' })
      .eq('tenant_id', vehicle.tenant_id);
  }

  const { data, error } = await supabase
    .from('vehicles')
    .insert(vehicle as any)
    .select()
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const updateVehicle = async (id: string, updates: any, tenantId?: string) => {
  // Règle : un seul véhicule actif. Si on en active un, on désactive les autres du tenant.
  if (updates.status === 'active' && tenantId) {
    await supabase
      .from('vehicles')
      .update({ status: 'inactive' })
      .eq('tenant_id', tenantId)
      .neq('id', id);
  }

  const { data, error } = await supabase
    .from('vehicles')
    .update(updates)
    .eq('id', id)
    .select()
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Update vehicle error:', error);
    throw error;
  }
  return data;
};

export const deleteVehicle = async (id: string) => {
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) throw error;
};

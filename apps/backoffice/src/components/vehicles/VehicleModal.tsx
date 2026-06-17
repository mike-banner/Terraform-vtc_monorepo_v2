// src/components/vehicles/VehicleModal.tsx
import { createVehicle, updateVehicle } from '@/services/vehicles';
import { Car, Plus, X } from 'lucide-react';
import React, { useState } from 'react';

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  plate_number: string;
  category: string | null;
  capacity: number | null;
  luggage_capacity?: number | null;
  status?: string | null;
}

interface VehicleModalProps {
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicle?: Vehicle | null;
}

export const VehicleModal: React.FC<VehicleModalProps> = ({
  tenantId,
  isOpen,
  onClose,
  onSuccess,
  vehicle,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const vehicleData: any = {
      tenant_id: tenantId,
      brand: formData.get('brand') as string,
      model: formData.get('model') as string,
      plate_number: formData.get('plate_number') as string,
      category: formData.get('category') as string,
      capacity: parseInt(formData.get('capacity') as string) || 4,
      luggage_capacity: parseInt(formData.get('luggage_capacity') as string) || 3,
      status: (formData.get('status') as string) || 'active',
    };

    try {
      if (vehicle?.id) {
        await updateVehicle(vehicle.id, vehicleData, tenantId);
      } else {
        await createVehicle(vehicleData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-black/80 transition-all'>
      <div className='relative glass max-w-lg w-full rounded-[2.5rem] border border-white/10 shadow-2xl p-8 animate-in fade-in zoom-in duration-300'>
        <button
          onClick={onClose}
          className='absolute top-8 right-8 text-slate-500 hover:text-white transition-colors'>
          <X className='w-6 h-6' />
        </button>

        <div className='flex items-center gap-4 mb-10'>
          <div className='w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 shadow-lg shadow-indigo-500/10'>
            <Car className='w-6 h-6' />
          </div>
          <div>
            <h3 className='text-2xl font-black uppercase text-white tracking-tighter leading-none mb-1'>
              {vehicle ? 'Modifier' : 'Nouveau'} véhicule
            </h3>
            <p className='text-[10px] font-bold uppercase tracking-widest text-slate-500'>
              {vehicle ? 'Mise à jour des informations' : 'Enregistrer un véhicule'}
            </p>
          </div>
        </div>

        {error && (
          <div className='mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold uppercase tracking-widest text-center'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='grid grid-cols-2 gap-6'>
            <div className='space-y-2'>
              <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                Marque
              </label>
              <input
                name='brand'
                required
                defaultValue={vehicle?.brand}
                placeholder='Mercedes, Tesla, etc.'
                className='w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700'
              />
            </div>
            <div className='space-y-2'>
              <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                Modèle
              </label>
              <input
                name='model'
                required
                defaultValue={vehicle?.model}
                placeholder='Classe E, Model S, etc.'
                className='w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700'
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-6'>
            <div className='space-y-2'>
              <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                Plaque d'immatriculation
              </label>
              <input
                name='plate_number'
                required
                defaultValue={vehicle?.plate_number}
                placeholder='AA-123-BB'
                className='w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700 uppercase'
              />
            </div>
            <div className='space-y-2'>
              <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                Statut
              </label>
              <div className='relative group'>
                <select
                  name='status'
                  required
                  defaultValue={vehicle?.status || 'active'}
                  className='w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer'>
                  <option value='active' className='bg-[#050505] text-white'>
                    Opérationnel (Activé)
                  </option>
                  <option value='inactive' className='bg-[#050505] text-white'>
                    Hors Service (Inactif)
                  </option>
                </select>
                <div className='absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-white transition-colors'>
                  <Car className='w-4 h-4 opacity-40' />
                </div>
              </div>
              <p className='text-[10px] font-bold text-indigo-400/70 uppercase tracking-[0.05em] px-2'>
                L'activation désactive automatiquement vos autres véhicules.
              </p>
            </div>
          </div>

          <div className='grid grid-cols-2 gap-6'>
            <div className='space-y-2'>
              <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                Catégorie
              </label>
              <div className='relative group'>
                <select
                  name='category'
                  required
                  defaultValue={vehicle?.category || 'berline'}
                  className='w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer'>
                  <option value='berline' className='bg-[#050505] text-white'>
                    Berline
                  </option>
                  <option value='van' className='bg-[#050505] text-white'>
                    Van
                  </option>
                  <option value='suv' className='bg-[#050505] text-white'>
                    SUV
                  </option>
                  <option value='minibus' className='bg-[#050505] text-white'>
                    Minibus
                  </option>
                  <option value='luxury' className='bg-[#050505] text-white'>
                    Luxe
                  </option>
                </select>
                <div className='absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-white transition-colors'>
                  <Plus className='w-4 h-4 rotate-45 transform' />
                </div>
              </div>
            </div>
            <div className='grid grid-cols-2 gap-6'>
              <div className='space-y-2'>
                <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                  Passagers (Max)
                </label>
                <input
                  name='capacity'
                  type='number'
                  required
                  min='1'
                  defaultValue={vehicle?.capacity || 4}
                  className='w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700'
                />
              </div>
              <div className='space-y-2'>
                <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                  Bagages (Max)
                </label>
                <input
                  name='luggage_capacity'
                  type='number'
                  required
                  min='0'
                  defaultValue={vehicle?.luggage_capacity ?? 3}
                  className='w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700'
                />
              </div>
            </div>
          </div>

          <div className='flex gap-3 mt-6'>
            {vehicle && (
              <button
                type='button'
                onClick={async () => {
                  if (error === 'CONFIRM_DELETE') {
                    try {
                      setLoading(true);
                      const { deleteVehicle } = await import('@/services/vehicles');
                      await deleteVehicle(vehicle.id);
                      onSuccess();
                      onClose();
                    } catch (err) {
                      setError('Erreur lors de la suppression');
                    } finally {
                      setLoading(false);
                    }
                  } else {
                    setError('CONFIRM_DELETE');
                  }
                }}
                disabled={loading}
                className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl border transition-all disabled:opacity-50 ${
                  error === 'CONFIRM_DELETE'
                    ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-600/20'
                    : 'text-rose-500 border-rose-500/20 hover:bg-rose-500/5'
                }`}>
                {error === 'CONFIRM_DELETE' ? 'Confirmer ?' : 'Supprimer'}
              </button>
            )}
            <button
              type='submit'
              disabled={loading}
              onClick={() => {
                if (error === 'CONFIRM_DELETE') setError(null);
              }}
              className={`flex-[2] flex items-center justify-center gap-3 py-4 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.98] ${
                vehicle
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20 w-full'
              }`}>
              {loading ? (
                <span className='w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin' />
              ) : (
                <>
                  <Plus className={`w-4 h-4 ${vehicle ? 'rotate-45' : ''}`} />
                  <span>{vehicle ? 'Enregistrer' : 'Créer le véhicule'}</span>
                </>
              )}
            </button>
          </div>
          {error === 'CONFIRM_DELETE' && (
            <p className='text-[10px] font-bold text-rose-500 uppercase tracking-widest text-center mt-4 animate-pulse'>
              Cliquez à nouveau pour confirmer la suppression
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

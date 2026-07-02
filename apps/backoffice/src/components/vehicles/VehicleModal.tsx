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
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm bg-background/80 transition-all'>
      <div className='relative bg-card max-w-lg w-full rounded-[calc(var(--radius)+8px)] border border-border shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200'>
        <button
          onClick={onClose}
          className='absolute top-6 right-6 text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 rounded-lg transition-colors'>
          <X className='w-5 h-5' />
        </button>

        <div className='flex items-center gap-3 mb-8'>
          <div className='w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary flex-shrink-0'>
            <Car className='w-5 h-5' />
          </div>
          <div>
            <h3 className='text-lg font-heading font-black uppercase text-foreground leading-none tracking-tight'>
              {vehicle ? 'Modifier' : 'Nouveau'} véhicule
            </h3>
            <p className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1'>
              {vehicle ? 'Mise à jour des informations' : 'Enregistrer un véhicule'}
            </p>
          </div>
        </div>

        {error && (
          <div className='mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-[var(--radius)] text-rose-500 text-xs font-bold uppercase tracking-widest text-center'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-5'>
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1.5'>
              <label className='text-[10px] font-semibold uppercase text-muted-foreground tracking-wider ml-1'>
                Marque
              </label>
              <input
                name='brand'
                required
                defaultValue={vehicle?.brand}
                placeholder='Mercedes, Tesla, etc.'
                className='w-full bg-background border border-border rounded-[var(--radius)] px-4 py-2.5 text-foreground font-semibold text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground'
              />
            </div>
            <div className='space-y-1.5'>
              <label className='text-[10px] font-semibold uppercase text-muted-foreground tracking-wider ml-1'>
                Modèle
              </label>
              <input
                name='model'
                required
                defaultValue={vehicle?.model}
                placeholder='Classe E, Model S, etc.'
                className='w-full bg-background border border-border rounded-[var(--radius)] px-4 py-2.5 text-foreground font-semibold text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground'
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1.5'>
              <label className='text-[10px] font-semibold uppercase text-muted-foreground tracking-wider ml-1'>
                Plaque d'immatriculation
              </label>
              <input
                name='plate_number'
                required
                defaultValue={vehicle?.plate_number}
                placeholder='AA-123-BB'
                className='w-full bg-background border border-border rounded-[var(--radius)] px-4 py-2.5 text-foreground font-semibold text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground uppercase'
              />
            </div>
            <div className='space-y-1.5'>
              <label className='text-[10px] font-semibold uppercase text-muted-foreground tracking-wider ml-1'>
                Statut
              </label>
              <div className='relative group'>
                <select
                  name='status'
                  required
                  defaultValue={vehicle?.status || 'active'}
                  className='w-full bg-background border border-border rounded-[var(--radius)] px-4 py-2.5 text-foreground font-semibold text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all appearance-none cursor-pointer'>
                  <option value='active' className='bg-card text-foreground'>
                    Opérationnel (Activé)
                  </option>
                  <option value='inactive' className='bg-card text-foreground'>
                    Hors Service (Inactif)
                  </option>
                </select>
                <div className='absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-hover:text-foreground transition-colors'>
                  <Car className='w-4 h-4' />
                </div>
              </div>
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1.5'>
              <label className='text-[10px] font-semibold uppercase text-muted-foreground tracking-wider ml-1'>
                Catégorie
              </label>
              <div className='relative group'>
                <select
                  name='category'
                  required
                  defaultValue={vehicle?.category || 'berline'}
                  className='w-full bg-background border border-border rounded-[var(--radius)] px-4 py-2.5 text-foreground font-semibold text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all appearance-none cursor-pointer'>
                  <option value='berline' className='bg-card text-foreground'>
                    Berline
                  </option>
                  <option value='van' className='bg-card text-foreground'>
                    Van
                  </option>
                  <option value='suv' className='bg-card text-foreground'>
                    SUV
                  </option>
                  <option value='minibus' className='bg-card text-foreground'>
                    Minibus
                  </option>
                  <option value='luxury' className='bg-card text-foreground'>
                    Luxe
                  </option>
                </select>
                <div className='absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-hover:text-foreground transition-colors'>
                  <Plus className='w-4 h-4 rotate-45 transform' />
                </div>
              </div>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-1.5'>
                <label className='text-[10px] font-semibold uppercase text-muted-foreground tracking-wider ml-1'>
                  Passagers
                </label>
                <input
                  name='capacity'
                  type='number'
                  required
                  min='1'
                  defaultValue={vehicle?.capacity || 4}
                  className='w-full bg-background border border-border rounded-[var(--radius)] px-3 py-2.5 text-foreground font-semibold text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground'
                />
              </div>
              <div className='space-y-1.5'>
                <label className='text-[10px] font-semibold uppercase text-muted-foreground tracking-wider ml-1'>
                  Bagages
                </label>
                <input
                  name='luggage_capacity'
                  type='number'
                  required
                  min='0'
                  defaultValue={vehicle?.luggage_capacity ?? 3}
                  className='w-full bg-background border border-border rounded-[var(--radius)] px-3 py-2.5 text-foreground font-semibold text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground'
                />
              </div>
            </div>
          </div>

          <div className='flex gap-3 mt-4 pt-2'>
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
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-[var(--radius)] transition-all disabled:opacity-50 ${
                  error === 'CONFIRM_DELETE'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/20'
                    : 'bg-background border border-border text-rose-500 hover:bg-rose-500/10'
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
              className={`flex-[2] flex items-center justify-center gap-2 py-3 text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-[var(--radius)] transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                vehicle
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  : 'bg-primary hover:bg-primary/90 shadow-primary/20 w-full'
              }`}>
              {loading ? (
                <span className='w-4 h-4 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin' />
              ) : (
                <>
                  <Plus className={`w-4 h-4 ${vehicle ? 'hidden' : ''}`} />
                  <span>{vehicle ? 'Enregistrer' : 'Créer le véhicule'}</span>
                </>
              )}
            </button>
          </div>
          {error === 'CONFIRM_DELETE' && (
            <p className='text-[10px] font-bold text-rose-500 uppercase tracking-widest text-center mt-3 animate-pulse'>
              Cliquez à nouveau pour confirmer la suppression
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

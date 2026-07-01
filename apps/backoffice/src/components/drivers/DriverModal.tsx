// src/components/drivers/DriverModal.tsx
import { createDriver, updateDriver } from "@/services/drivers";
import { Save, UserPlus, X } from "lucide-react";
import React, { useState } from "react";

interface DriverModalProps {
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  driver?: any;
}

export const DriverModal: React.FC<DriverModalProps> = ({
  tenantId,
  isOpen,
  onClose,
  onSuccess,
  driver,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const driverData = {
      tenant_id: tenantId,
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      phone: formData.get("phone") as string,
      license_number: formData.get("license_number") as string,
    };
    try {
      if (driver) {
        await updateDriver(driver.id, driverData);
      } else {
        await createDriver(driverData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/40 transition-all placeholder:text-muted-foreground/40';

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-black/80'>
      <div className='relative bg-card border border-border max-w-lg w-full rounded-2xl shadow-2xl p-8 animate-in fade-in zoom-in duration-200'>
        <button
          onClick={onClose}
          className='absolute top-6 right-6 p-2 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors'>
          <X className='w-4 h-4' />
        </button>

        <div className='flex items-center gap-4 mb-8'>
          <div className='w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary flex-shrink-0'>
            <UserPlus className='w-5 h-5' />
          </div>
          <div>
            <h3 className='text-lg font-black uppercase text-foreground tracking-tighter leading-none mb-0.5'>
              {driver ? "Modifier Chauffeur" : "Nouveau Chauffeur"}
            </h3>
            <p className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground'>
              {driver ? "Mettre à jour les informations" : "Ajouter un collaborateur"}
            </p>
          </div>
        </div>

        {error && (
          <div className='mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs font-medium'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1.5'>
              <label className='text-[10px] font-bold uppercase text-muted-foreground tracking-widest'>Prénom</label>
              <input name='first_name' required defaultValue={driver?.first_name} placeholder='Jean' className={inputClass} />
            </div>
            <div className='space-y-1.5'>
              <label className='text-[10px] font-bold uppercase text-muted-foreground tracking-widest'>Nom</label>
              <input name='last_name' required defaultValue={driver?.last_name} placeholder='Dupont' className={inputClass} />
            </div>
          </div>

          <div className='space-y-1.5'>
            <label className='text-[10px] font-bold uppercase text-muted-foreground tracking-widest'>Portable</label>
            <input name='phone' required defaultValue={driver?.phone} placeholder='06 12 34 56 78' className={inputClass} />
          </div>

          <div className='space-y-1.5'>
            <label className='text-[10px] font-bold uppercase text-muted-foreground tracking-widest'>Carte Pro VTC</label>
            <input name='license_number' required defaultValue={driver?.license_number} placeholder='000 000 000 000' className={`${inputClass} font-mono tracking-widest uppercase`} />
          </div>

          <button
            type='submit'
            disabled={loading}
            className='w-full mt-2 flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95'>
            {loading ? (
              <span className='w-4 h-4 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin' />
            ) : (
              <>
                {driver ? <Save className='w-4 h-4' /> : <UserPlus className='w-4 h-4' />}
                <span>{driver ? "Enregistrer les modifications" : "Créer le chauffeur"}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

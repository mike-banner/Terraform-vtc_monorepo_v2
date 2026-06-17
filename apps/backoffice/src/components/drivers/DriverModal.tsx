// src/components/drivers/DriverModal.tsx
import { createDriver, updateDriver } from "@/services/drivers";
import { Save, UserPlus, X } from "lucide-react";
import React, { useState } from "react";

interface DriverModalProps {
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  driver?: any; // If provided, we are in edit mode
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
            <UserPlus className='w-6 h-6' />
          </div>
          <div>
            <h3 className='text-2xl font-black uppercase text-white tracking-tighter leading-none mb-1'>
              {driver ? "Modifier Chauffeur" : "Nouveau Chauffeur"}
            </h3>
            <p className='text-[10px] font-bold uppercase tracking-widest text-slate-500'>
              {driver
                ? "Mettre à jour les informations"
                : "Ajouter un collaborateur"}
            </p>
          </div>
        </div>

        {error && (
          <div className='mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold uppercase tracking-widest'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='grid grid-cols-2 gap-6'>
            <div className='space-y-2'>
              <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                {" "}
                Prénom{" "}
              </label>
              <input
                name='first_name'
                required
                defaultValue={driver?.first_name}
                placeholder='Jean'
                className='w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700'
              />
            </div>
            <div className='space-y-2'>
              <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                {" "}
                Nom{" "}
              </label>
              <input
                name='last_name'
                required
                defaultValue={driver?.last_name}
                placeholder='Dupont'
                className='w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700'
              />
            </div>
          </div>

          <div className='space-y-2'>
            <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
              {" "}
              Portable{" "}
            </label>
            <input
              name='phone'
              required
              defaultValue={driver?.phone}
              placeholder='06 12 34 56 78'
              className='w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700'
            />
          </div>

          <div className='space-y-2'>
            <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
              {" "}
              Numéro de Carte Pro{" "}
            </label>
            <input
              name='license_number'
              required
              defaultValue={driver?.license_number}
              placeholder='VTC-123456789'
              className='w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700 uppercase'
            />
          </div>

          <button
            type='submit'
            disabled={loading}
            className='w-full mt-6 flex items-center justify-center gap-3 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.98]'>
            {loading ? (
              <span className='w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin' />
            ) : (
              <>
                {driver ? (
                  <Save className='w-4 h-4' />
                ) : (
                  <UserPlus className='w-4 h-4' />
                )}
                <span>
                  {driver
                    ? "Enregistrer les modifications"
                    : "Créer le chauffeur"}
                </span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

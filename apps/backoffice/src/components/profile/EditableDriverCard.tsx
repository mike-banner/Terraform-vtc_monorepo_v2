import { supabase } from '@/lib/supabase/client';
import { Check, CreditCard, Edit2, Phone, User, X } from 'lucide-react';
import React, { useState } from 'react';

interface EditableDriverCardProps {
  driver: any;
  profile: any;
}

export const EditableDriverCard: React.FC<EditableDriverCardProps> = ({ driver, profile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState(driver?.first_name?.trim() || profile?.first_name?.trim() || '');
  const [lastName, setLastName] = useState(driver?.last_name?.trim() || profile?.last_name?.trim() || '');
  const [phone, setPhone] = useState(driver?.phone || '');
  const [licenseNumber, setLicenseNumber] = useState(driver?.license_number || '');
  const [error, setError] = useState<string | null>(null);

  // Formateur pour la carte VTC (12 chiffres groupés par 3)
  const formatVtc = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 12);
    return digits.match(/.{1,3}/g)?.join(' ') || digits;
  };

  const handleLicenseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatVtc(e.target.value);
    setLicenseNumber(formatted);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('drivers')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone,
          license_number: licenseNumber.replace(/\s/g, ''),
        })
        .eq('id', driver.id);

      if (updateError) throw updateError;

      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFirstName(driver?.first_name?.trim() || profile?.first_name?.trim() || '');
    setLastName(driver?.last_name?.trim() || profile?.last_name?.trim() || '');
    setPhone(driver?.phone || '');
    setLicenseNumber(formatVtc(driver?.license_number || ''));
    setIsEditing(false);
    setError(null);
  };

  return (
    <div className='glass p-6 md:p-8 rounded-[2.5rem] border border-white/10 bg-white/[0.02] flex flex-col gap-6 relative overflow-hidden transition-all group w-full'>
      {/* HEADER SECTION (Identity Always visible) */}
      <div className='flex items-center gap-5 relative z-10'>
        <div className='w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-600/20 flex items-center justify-center text-white flex-shrink-0 transition-transform group-hover:scale-105'>
          <User className='w-8 h-8' />
        </div>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-3'>
            <p className='text-[10px] md:text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em] leading-none mb-1'>
              Chauffeur Titulaire
            </p>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className='p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-all opacity-0 group-hover:opacity-100'>
                <Edit2 className='w-3.5 h-3.5' />
              </button>
            )}
          </div>
          <h3 className='text-xl md:text-3xl font-black text-white uppercase tracking-tighter leading-none'>
            {firstName} {lastName}
          </h3>
        </div>
      </div>

      {/* INFO LINES SECTION */}
      <div className='space-y-4 pt-6 border-t border-white/5 w-full'>
        {isEditing ? (
          <div className='space-y-5 animate-in fade-in slide-in-from-top-2 duration-300 max-w-lg'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>Prénom</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder='Jean'
                  className='w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-medium'
                />
              </div>
              <div className='space-y-2'>
                <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>Nom</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder='Dupont'
                  className='w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-medium'
                />
              </div>
            </div>
            <div className='space-y-2'>
              <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                Portable
              </label>
              <div className='relative'>
                <Phone className='absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 opacity-50' />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder='06 12 34 56 78'
                  className='w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-medium'
                />
              </div>
            </div>

            <div className='space-y-2'>
              <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                Carte Pro VTC
              </label>
              <div className='relative'>
                <CreditCard className='absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 opacity-50' />
                <input
                  value={licenseNumber}
                  onChange={handleLicenseChange}
                  placeholder='000 000 000 000'
                  className='w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-mono tracking-widest'
                />
              </div>
            </div>

            {error && (
              <div className='p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-widest'>
                {error}
              </div>
            )}

            <div className='flex items-center gap-3 pt-2'>
              <button
                onClick={handleSave}
                disabled={loading}
                className='flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2'>
                {loading ? (
                  <span className='w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin' />
                ) : (
                  <Check className='w-4 h-4' />
                )}
                <span>Enregistrer</span>
              </button>
              <button
                onClick={handleCancel}
                className='px-6 py-4 bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-2'>
                <X className='w-4 h-4' />
                <span>Annuler</span>
              </button>
            </div>
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {/* Phone Row */}
            <div className='flex items-center gap-4 bg-white/[0.03] p-4 rounded-2xl border border-white/5 group/row hover:bg-white/[0.05] transition-all'>
              <div className='w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover/row:scale-110 transition-transform'>
                <Phone className='w-5 h-5' />
              </div>
              <div>
                <p className='text-[10px] font-black uppercase text-slate-500 tracking-widest mb-0.5'>
                  Portable
                </p>
                <p className='text-sm md:text-base font-bold text-white tracking-widest'>
                  {phone || '---'}
                </p>
              </div>
            </div>

            {/* License Row */}
            <div className='flex items-center gap-4 bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10 group/row hover:bg-indigo-500/[0.08] transition-all'>
              <div className='w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover/row:scale-110 transition-transform'>
                <CreditCard className='w-5 h-5' />
              </div>
              <div className='flex-1'>
                <p className='text-[10px] font-black uppercase text-slate-500 tracking-widest mb-0.5'>
                  Carte VTC
                </p>
                <p className='text-sm md:text-base font-black text-indigo-400 tabular-nums tracking-widest'>
                  {formatVtc(licenseNumber) || '---'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Decorative Glow */}
      <div className='absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none' />
    </div>
  );
};

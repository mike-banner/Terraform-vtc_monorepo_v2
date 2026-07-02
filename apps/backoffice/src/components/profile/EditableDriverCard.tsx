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

  const formatVtc = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 12);
    return digits.match(/.{1,3}/g)?.join(' ') || digits;
  };

  const handleLicenseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLicenseNumber(formatVtc(e.target.value));
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
    <div className='bg-card border border-border rounded-[var(--radius)] p-5 md:p-6 flex flex-col gap-5 w-full'>

      {/* HEADER */}
      <div className='flex items-center gap-4'>
        <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0'>
          <User className='w-5 h-5' />
        </div>
        <div className='flex-1 min-w-0'>
          <p className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1'>
            Chauffeur Titulaire
          </p>
          <h3 className='text-lg md:text-xl font-heading font-black text-foreground uppercase tracking-tight leading-none truncate'>
            {firstName} {lastName}
          </h3>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className='p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0'>
            <Edit2 className='w-4 h-4' />
          </button>
        )}
      </div>

      {/* INFO / EDIT */}
      <div className='border-t border-border/50 pt-4 w-full'>
        {isEditing ? (
          <div className='space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 max-w-lg'>
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <label className='text-[10px] font-bold uppercase text-muted-foreground tracking-widest'>Prénom</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder='Jean'
                  className='w-full bg-background border border-border rounded-[var(--radius)] px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all font-medium'
                />
              </div>
              <div className='space-y-1.5'>
                <label className='text-[10px] font-bold uppercase text-muted-foreground tracking-widest'>Nom</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder='Dupont'
                  className='w-full bg-background border border-border rounded-[var(--radius)] px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all font-medium'
                />
              </div>
            </div>
            <div className='space-y-1.5'>
              <label className='text-[10px] font-bold uppercase text-muted-foreground tracking-widest'>Téléphone</label>
              <div className='relative'>
                <Phone className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder='06 12 34 56 78'
                  className='w-full bg-background border border-border rounded-[var(--radius)] pl-11 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all font-medium'
                />
              </div>
            </div>
            <div className='space-y-1.5'>
              <label className='text-[10px] font-bold uppercase text-muted-foreground tracking-widest'>Carte Pro VTC</label>
              <div className='relative'>
                <CreditCard className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                <input
                  value={licenseNumber}
                  onChange={handleLicenseChange}
                  placeholder='000 000 000 000'
                  className='w-full bg-background border border-border rounded-[var(--radius)] pl-11 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all font-mono tracking-widest'
                />
              </div>
            </div>
            {error && (
               <div className='mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-[var(--radius)] text-rose-500 text-xs font-bold uppercase tracking-widest text-center'>
                {error}
              </div>
            )}
            <div className='flex items-center gap-3 pt-2'>
              <button
                onClick={handleSave}
                disabled={loading}
                className='flex-1 py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-[var(--radius)] transition-all shadow-sm shadow-primary/20 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2'>
                {loading ? (
                  <span className='w-4 h-4 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin' />
                ) : (
                  <Check className='w-4 h-4' />
                )}
                <span>Enregistrer</span>
              </button>
              <button
                onClick={handleCancel}
                className='px-5 py-3 bg-background hover:bg-muted border border-border text-muted-foreground text-[10px] font-bold uppercase tracking-widest rounded-[var(--radius)] transition-all flex items-center gap-2'>
                <X className='w-4 h-4' />
                <span>Annuler</span>
              </button>
            </div>
          </div>
        ) : (
          <div className='flex flex-col gap-4'>
            <div className='flex items-center gap-3'>
              <Phone className='w-4 h-4 text-muted-foreground flex-shrink-0' />
              <div className='flex-1 min-w-0'>
                <p className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest'>Téléphone</p>
                <p className='text-sm font-semibold text-foreground'>{phone || '—'}</p>
              </div>
            </div>
            <div className='flex items-center gap-3'>
              <CreditCard className='w-4 h-4 text-muted-foreground flex-shrink-0' />
              <div className='flex-1 min-w-0'>
                <p className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest'>Carte Pro VTC</p>
                <p className='text-sm font-black text-primary tabular-nums tracking-widest font-mono'>
                  {formatVtc(licenseNumber) || '—'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

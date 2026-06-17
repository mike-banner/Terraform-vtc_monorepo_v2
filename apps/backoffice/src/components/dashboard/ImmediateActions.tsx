// src/components/dashboard/ImmediateActions.tsx
import { FileText, Navigation, Phone, Star } from 'lucide-react';
import React, { useState } from 'react';
import { RatingQRModal } from './RatingQRModal';

interface ImmediateActionsProps {
  bookingId: string;
  customerPhone: string;
  pickupAddress: string;
  tenantName: string;
  pickupTime: string;
  invoiceUrl?: string | null;
  missionStatus?: string;
  rating?: number | null;
}

export const ImmediateActions: React.FC<ImmediateActionsProps> = ({
  bookingId,
  customerPhone,
  pickupAddress,
  tenantName,
  pickupTime,
  invoiceUrl,
  missionStatus,
  rating,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isCompleted = missionStatus === 'completed';
  const alreadyRated = rating !== null && rating !== undefined;

  return (
    <>
      <div className='flex flex-wrap lg:flex-row gap-1.5 md:gap-2'>
        <a
          href={`tel:${customerPhone}`}
          className='flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 md:px-6 py-2 md:py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg md:rounded-xl text-[10px] md:text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95'>
          <Phone className='w-3 h-3 text-emerald-500' />
          <span>Appeler</span>
        </a>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            pickupAddress,
          )}`}
          target='_blank'
          className='flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 md:px-6 py-2 md:py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg md:rounded-xl text-[10px] md:text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-xl shadow-indigo-600/20 active:scale-95'>
          <Navigation className='w-3 h-3' />
          <span>Nav</span>
        </a>

        {isCompleted && alreadyRated ? (
          <button
            disabled
            className='flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 md:px-6 py-2 md:py-3 bg-white/5 border border-white/5 rounded-lg md:rounded-xl text-[10px] md:text-[10px] font-black uppercase tracking-widest text-slate-600 cursor-not-allowed'>
            <Star className='w-3 h-3 fill-current text-amber-500/50' />
            <span>Déjà noté</span>
          </button>
        ) : (
          <button
            onClick={() =>
              isCompleted
                ? setIsModalOpen(true)
                : alert("Veuillez d'abord TERMINER la mission pour recueillir l'avis passager.")
            }
            className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
              isCompleted
                ? 'bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-500'
                : 'bg-white/5 text-slate-500 border border-white/5 opacity-50'
            }`}>
            <Star className={`w-3 h-3 ${isCompleted ? 'fill-current' : ''}`} />
            <span>{isCompleted ? 'QR Avis' : 'Note'}</span>
          </button>
        )}

        {isCompleted && invoiceUrl ? (
          <a
            href={invoiceUrl}
            target='_blank'
            className='flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 md:px-6 py-2 md:py-3 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 rounded-lg md:rounded-xl text-[10px] md:text-[10px] font-black uppercase tracking-widest text-emerald-500 transition-all active:scale-95'>
            <FileText className='w-3 h-3' />
            <span>Doc</span>
          </a>
        ) : (
          <button
            onClick={() => alert(isCompleted ? 'Génération de la facture...' : 'Mission en cours : Terminez la course pour émettre la facture.')}
            className='flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 md:px-6 py-2 md:py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg md:rounded-xl text-[10px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all active:scale-95'>
            <FileText className='w-3 h-3' />
            <span>Doc</span>
          </button>
        )}
      </div>

      {!isCompleted && missionStatus === 'in_progress' && (
        <div className="mt-2 text-[10px] font-black text-rose-500 uppercase tracking-widest animate-pulse">
           ⚠️ Course en cours... N'oubliez pas de Terminer la mission à l'arrivée.
        </div>
      )}

      <RatingQRModal
        bookingId={bookingId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tenantName={tenantName}
      />
    </>
  );
};

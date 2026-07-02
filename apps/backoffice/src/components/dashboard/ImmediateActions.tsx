// src/components/dashboard/ImmediateActions.tsx
import { supabase } from '@/lib/supabase/client';
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
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  const isCompleted = missionStatus === 'completed';
  const alreadyRated = rating !== null && rating !== undefined;

  const handleGenerateInvoice = async () => {
    if (!isCompleted) {
      alert('Mission en cours : Terminez la course pour émettre la facture.');
      return;
    }
    try {
      setIsGeneratingInvoice(true);
      const { data, error } = await supabase.functions.invoke('generate-invoice', {
        body: { booking_id: bookingId }
      });
      if (error) throw error;
      if (data?.invoice_url) {
        window.open(data.invoice_url, '_blank');
        window.location.reload();
      } else if (data?.already_generated) {
        alert("La facture a déjà été générée.");
      } else {
        alert("Facture générée.");
        window.location.reload();
      }
    } catch (err: any) {
      alert("Erreur lors de la génération de la facture : " + err.message);
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

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
            className='flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 md:px-6 py-2 md:py-3 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 rounded-lg md:rounded-xl text-[10px] md:text-[10px] font-bold uppercase tracking-widest text-emerald-500 transition-all shadow-sm active:scale-95'>
            <FileText className='w-3 h-3' />
            <span>Doc</span>
          </a>
        ) : (
          <button
            onClick={handleGenerateInvoice}
            disabled={isGeneratingInvoice}
            className='flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 md:px-6 py-2 md:py-3 bg-background hover:bg-muted border border-border rounded-lg md:rounded-xl text-[10px] md:text-[10px] font-bold uppercase tracking-widest text-foreground transition-all shadow-sm active:scale-95 disabled:opacity-50'>
            {isGeneratingInvoice ? (
                <span className='w-3 h-3 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin' />
            ) : (
                <FileText className='w-3 h-3 text-muted-foreground' />
            )}
            <span>{isGeneratingInvoice ? '...' : 'Doc'}</span>
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

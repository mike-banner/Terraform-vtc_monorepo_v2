// src/components/dashboard/RatingQRModal.tsx
import { Star, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import React, { useEffect, useState } from 'react';

interface RatingQRModalProps {
  bookingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  tenantName: string;
}

export const RatingQRModal: React.FC<RatingQRModalProps> = ({
  bookingId,
  isOpen,
  onClose,
  tenantName,
}) => {
  if (!isOpen || !bookingId) return null;

  // Use the current origin for the rating URL
  const [ratingUrl, setRatingUrl] = useState('');

  useEffect(() => {
    const siteOrigin = (import.meta.env.PUBLIC_SITE_URL as string | undefined)?.replace(/\/$/, "") || window.location.origin;
    setRatingUrl(`${siteOrigin}/rate/${bookingId}`);
  }, [bookingId]);

  return (
    <div className='fixed inset-0 z-[150] flex items-center justify-center p-6 backdrop-blur-md bg-black/90 animate-in fade-in duration-300'>
      <div className='relative glass max-w-sm w-full rounded-[3rem] border border-white/10 shadow-2xl p-10 flex flex-col items-center text-center animate-in zoom-in duration-500'>
        <button
          onClick={onClose}
          className='absolute top-8 right-8 text-slate-500 hover:text-white transition-colors'>
          <X className='w-6 h-6' />
        </button>

        <div className='w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mb-8 shadow-xl shadow-rose-500/10'>
          <Star className='w-8 h-8 fill-current' />
        </div>

        <h3 className='text-2xl font-black uppercase text-white tracking-widest leading-tight mb-2'>
          Évaluer la course
        </h3>
        <p className='text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-10 leading-relaxed'>
          Présentez ce QR Code au passager pour recueillir son avis sur {tenantName}
        </p>

        <div className='p-6 bg-white rounded-[2rem] shadow-2xl shadow-white/5 mb-10'>
          {ratingUrl && <QRCodeSVG value={ratingUrl} size={200} level='H' includeMargin={false} />}
        </div>

        <div className='w-full p-4 bg-white/5 border border-white/5 rounded-2xl'>
          <p className='text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2'>
            Lien direct
          </p>
          <p className='text-[10px] font-bold text-indigo-400 truncate'>{ratingUrl}</p>
        </div>

        <button
          onClick={onClose}
          className='mt-10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors'>
          Fermer le cockpit
        </button>
      </div>
    </div>
  );
};

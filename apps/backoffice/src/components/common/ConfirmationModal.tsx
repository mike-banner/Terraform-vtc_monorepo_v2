// src/components/common/ConfirmationModal.tsx
import { AlertCircle, X } from "lucide-react";
import React from "react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: "danger" | "primary" | "success";
  loading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  confirmVariant = "primary",
  loading = false,
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: "bg-red-600 hover:bg-red-500 shadow-red-600/20",
    primary: "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20",
    success: "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20",
  };

  const iconStyles = {
    danger: "bg-red-500/10 border-red-500/20 text-red-500",
    primary: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500",
    success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
  };

  return (
    <div className='fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-md bg-black/80 transition-all'>
      <div className='relative glass max-w-sm w-full rounded-[2.5rem] border border-white/10 shadow-2xl p-8 animate-in fade-in zoom-in duration-300 transform scale-100'>
        <button
          onClick={onClose}
          className='absolute top-8 right-8 text-slate-500 hover:text-white transition-colors'>
          <X className='w-5 h-5' />
        </button>

        <div
          className={`w-12 h-12 border rounded-2xl flex items-center justify-center mb-6 ${iconStyles[confirmVariant]}`}>
          <AlertCircle className='w-6 h-6' />
        </div>

        <h3 className='text-2xl font-black uppercase text-white mb-2 tracking-tighter'>
          {title}
        </h3>
        <p className='text-slate-400 text-sm font-medium mb-8 leading-relaxed'>
          {message}
        </p>

        <div className='flex flex-col sm:flex-row gap-3 font-black uppercase text-[10px] tracking-widest'>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-4 text-white rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 ${variantStyles[confirmVariant]}`}>
            {loading ? (
              <span className='w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin inline-block' />
            ) : (
              confirmLabel
            )}
          </button>
          <button
            onClick={onClose}
            className='flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-all border border-white/5 active:scale-95'>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

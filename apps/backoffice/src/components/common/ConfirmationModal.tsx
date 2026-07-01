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
    danger: "bg-red-600 hover:bg-red-500 text-white shadow-red-600/20",
    primary: "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20",
  };

  const iconStyles = {
    danger: "bg-red-500/10 border-red-500/20 text-red-500",
    primary: "bg-primary/10 border-primary/20 text-primary",
    success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
  };

  return (
    <div className='fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-sm bg-black/80'>
      <div className='relative bg-card border border-border max-w-sm w-full rounded-2xl shadow-2xl p-8 animate-in fade-in zoom-in duration-200'>
        <button
          onClick={onClose}
          className='absolute top-6 right-6 p-2 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors'>
          <X className='w-4 h-4' />
        </button>

        <div className={`w-10 h-10 border rounded-xl flex items-center justify-center mb-5 ${iconStyles[confirmVariant]}`}>
          <AlertCircle className='w-5 h-5' />
        </div>

        <h3 className='text-lg font-black uppercase text-foreground mb-2 tracking-tighter'>
          {title}
        </h3>
        <p className='text-muted-foreground text-sm font-medium mb-6 leading-relaxed'>
          {message}
        </p>

        <div className='flex flex-col sm:flex-row gap-3 font-black uppercase text-[10px] tracking-widest'>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-3 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 ${variantStyles[confirmVariant]}`}>
            {loading ? (
              <span className='w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin inline-block' />
            ) : (
              confirmLabel
            )}
          </button>
          <button
            onClick={onClose}
            className='flex-1 py-3 bg-white/5 hover:bg-white/10 text-muted-foreground rounded-xl transition-all border border-border active:scale-95'>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

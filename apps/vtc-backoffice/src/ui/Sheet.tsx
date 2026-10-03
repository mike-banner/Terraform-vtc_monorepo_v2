import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Panneau modal : plein écran sous md, latéral à partir de md. Bouton Fermer toujours visible. */
export function Sheet({
  open,
  onClose,
  title,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      const before = document.activeElement as HTMLElement | null;
      d.showModal();
      return () => {
        if (d.open) d.close();
        before?.focus?.();
      };
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-full max-w-none bg-card p-0 text-card-foreground backdrop:bg-background/70 md:ml-auto md:max-w-xl"
    >
      <div className="flex h-dvh flex-col pb-[env(safe-area-inset-bottom)]">
        <header className="sticky top-0 flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-2">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button type="button" aria-label="Fermer" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-muted">
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <footer className="border-t border-border p-4">{footer}</footer> : null}
      </div>
    </dialog>
  );
}

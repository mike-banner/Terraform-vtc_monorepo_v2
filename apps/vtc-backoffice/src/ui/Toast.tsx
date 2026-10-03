import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Tone = "success" | "error" | "info";
type Item = { id: number; message: string; tone: Tone };

const ToastCtx = createContext<{ show: (t: { message: string; tone?: Tone }) => void } | null>(null);

const tones: Record<Tone, string> = {
  success: "border-success text-success-foreground",
  error: "border-destructive text-destructive",
  info: "border-info text-info-foreground",
};

/** Monte la région aria-live ; le texte est rendu en JSX (jamais en HTML brut). */
export function ToastHost({ children }: { children?: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const n = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const show = useCallback(({ message, tone = "success" }: { message: string; tone?: Tone }) => {
    const id = ++n.current;
    setItems((l) => [...l, { id, message, tone }]);
    const t = setTimeout(() => {
      timers.current.delete(t);
      setItems((l) => l.filter((x) => x.id !== id));
    }, 5000);
    timers.current.add(t);
  }, []);
  useEffect(() => {
    const ts = timers.current;
    return () => ts.forEach(clearTimeout);
  }, []);
  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded-xl border bg-card px-4 py-3 text-sm font-bold ${tones[t.tone]}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast hors ToastHost");
  return c;
}

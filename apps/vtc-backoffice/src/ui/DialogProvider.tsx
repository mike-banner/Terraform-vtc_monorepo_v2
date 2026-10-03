import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { Input, Textarea } from "./Field";

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
};
type PromptOpts = { title: string; label: string; required?: boolean; multiline?: boolean; initial?: string };
type AlertOpts = { title: string; message?: string };

type Api = {
  confirm(o: ConfirmOpts): Promise<boolean>;
  prompt(o: PromptOpts): Promise<string | null>;
  alert(o: AlertOpts): Promise<void>;
};

type Req =
  | { kind: "confirm"; o: ConfirmOpts; done: (v: boolean) => void }
  | { kind: "prompt"; o: PromptOpts; done: (v: string | null) => void }
  | { kind: "alert"; o: AlertOpts; done: () => void };

const Ctx = createContext<Api | null>(null);

export function useDialog(): Api {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDialog hors DialogProvider");
  return c;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Req | null>(null);

  // ponytail: une seule boîte à la fois ; une 2e demande annule la 1re (résout false/null).
  const ask = useCallback(<R,>(make: (done: (v: R) => void) => Req, cancelValue: R) => {
    return new Promise<R>((resolve) => {
      setReq((prev) => {
        if (prev) (prev.done as (v: unknown) => void)(prev.kind === "alert" ? undefined : cancelValue);
        return make(resolve);
      });
    });
  }, []);

  const api = useRef<Api>({
    confirm: (o) => ask<boolean>((done) => ({ kind: "confirm", o, done }), false),
    prompt: (o) => ask<string | null>((done) => ({ kind: "prompt", o, done }), null),
    alert: (o) => ask<void>((done) => ({ kind: "alert", o, done: () => done() }), undefined),
  });

  return (
    <Ctx.Provider value={api.current}>
      {children}
      {req ? (
        <Box
          req={req}
          close={() => setReq(null)}
        />
      ) : null}
    </Ctx.Provider>
  );
}

function Box({ req, close }: { req: Req; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [text, setText] = useState(req.kind === "prompt" ? (req.o.initial ?? "") : "");
  const [error, setError] = useState<string>();

  useEffect(() => {
    const d = ref.current;
    const before = document.activeElement as HTMLElement | null;
    d?.showModal();
    return () => {
      if (d?.open) d.close();
      before?.focus?.();
    };
  }, []);

  const cancel = () => {
    if (req.kind === "confirm") req.done(false);
    else if (req.kind === "prompt") req.done(null);
    else req.done();
    close();
  };
  const ok = () => {
    if (req.kind === "prompt") {
      if (req.o.required && !text.trim()) {
        setError("Ce champ est obligatoire.");
        return;
      }
      req.done(text);
    } else if (req.kind === "confirm") req.done(true);
    else req.done();
    close();
  };

  const o = req.o;
  const message = "message" in o ? o.message : undefined;
  const danger = req.kind === "confirm" && req.o.variant === "danger";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-(--radius-card) border border-border bg-card p-0 text-card-foreground backdrop:bg-background/70"
    >
      <div className="space-y-4 p-4 lg:p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 id={titleId} className="text-lg font-bold">
            {o.title}
          </h2>
          <button type="button" aria-label="Fermer" onClick={cancel} className="inline-flex size-11 lg:pointer-fine:size-9 shrink-0 items-center justify-center rounded-xl hover:bg-muted">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {req.kind === "prompt" ? (
          <div className="space-y-1">
            <label htmlFor={`${titleId}-f`} className="block text-sm font-bold">
              {req.o.label}
            </label>
            {req.o.multiline ? (
              <Textarea id={`${titleId}-f`} rows={4} value={text} aria-invalid={error ? true : undefined} onChange={(e) => setText(e.target.value)} />
            ) : (
              <Input id={`${titleId}-f`} value={text} aria-invalid={error ? true : undefined} onChange={(e) => setText(e.target.value)} />
            )}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          {req.kind !== "alert" ? (
            <Button variant="secondary" onClick={cancel}>
              {(req.kind === "confirm" && req.o.cancelLabel) || "Annuler"}
            </Button>
          ) : null}
          <Button variant={danger ? "danger" : "primary"} onClick={ok}>
            {(req.kind === "confirm" && req.o.confirmLabel) || "OK"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

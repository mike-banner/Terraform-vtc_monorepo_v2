import type { ReactNode } from "react";
import { Button } from "./Button";

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div role="status" aria-label="Chargement" className="space-y-3">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 rounded-md bg-muted motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-(--radius-card) border border-dashed border-border p-8 text-center">
      <p className="font-bold text-foreground">{title}</p>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-(--radius-card) border border-destructive/40 p-8 text-center">
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  );
}

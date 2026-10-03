import { SyncIndicator } from '@vtc/realtime';

const DOT = 'inline-block h-2 w-2 rounded-full';

// Pastille d'état : lit le store partagé, peut être posée plusieurs fois sans ouvrir de canal.
export function SyncPill({ compact = false }: { compact?: boolean }) {
  return (
    <SyncIndicator
      className="inline-flex items-center gap-1.5 flex-shrink-0"
      dotClassName={{
        online: `${DOT} bg-primary`,
        reconnecting: `${DOT} bg-muted-foreground animate-pulse`,
        offline: `${DOT} bg-destructive`,
      }}
      labelClassName={compact ? 'sr-only' : 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground'}
    />
  );
}

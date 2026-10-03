import type { ConnectionState } from './sync-state.mjs';
import { useConnectionState } from './connection';

export const CONNECTION_LABELS: Record<ConnectionState, string> = {
  online: 'Connecté',
  reconnecting: 'Reconnexion…',
  offline: 'Hors ligne',
};

type Props = { className?: string; dotClassName: Record<ConnectionState, string>; labelClassName?: string };

// Aucune classe Tailwind en dur : les apps passent leurs propres tokens.
export function SyncIndicator({ className, dotClassName, labelClassName }: Props) {
  const { state, lastEventAt } = useConnectionState();
  const label = CONNECTION_LABELS[state];
  const title = lastEventAt ? `${label} · dernier changement ${new Date(lastEventAt).toLocaleTimeString('fr-FR')}` : label;
  return (
    <span role="status" aria-live="polite" title={title} className={className} data-state={state}>
      <span aria-hidden="true" className={dotClassName[state]} />
      <span className={labelClassName}>{label}</span>
    </span>
  );
}

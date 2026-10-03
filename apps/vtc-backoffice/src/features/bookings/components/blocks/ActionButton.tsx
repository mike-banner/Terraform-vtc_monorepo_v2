import { Button, type ButtonProps } from "@/ui";
import { useOnline } from "@/app/useOnline";

/** Bouton d'écriture : désactivé hors ligne (D-11, message en infobulle) et pendant l'appel (anti double soumission). */
export function ActionButton({ disabled, loading, ...p }: ButtonProps) {
  const { canWrite, offlineMessage } = useOnline();
  return <Button {...p} disabled={disabled || !canWrite || loading} loading={loading} title={canWrite ? p.title : offlineMessage} />;
}

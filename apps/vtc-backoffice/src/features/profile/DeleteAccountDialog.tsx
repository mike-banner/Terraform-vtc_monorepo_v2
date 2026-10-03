import { useState } from "react";
import { invokeFn } from "@/lib/app-error";
import { supabase } from "@/lib/supabase/client";
import { Button, useDialog, useToast } from "@/ui";
import { useOnline } from "@/app/useOnline";

/** Zone de danger : avertissement, puis saisie de la phrase exacte ; le serveur vérifie encore le rôle owner. */
export function DeleteAccountDialog({ tenantName }: { tenantName: string }) {
  const dialog = useDialog();
  const toast = useToast();
  const { canWrite, offlineMessage } = useOnline();
  const [busy, setBusy] = useState(false);
  const phrase = `SUPPRESSION COMPTE ${tenantName}`;

  const run = async () => {
    const warned = await dialog.confirm({
      title: "Supprimer le compte entreprise ?",
      message: "Votre société, votre accès au tableau de bord et toutes vos données seront désactivés. Cette action est irréversible.",
      confirmLabel: "Continuer",
      variant: "danger",
    });
    if (!warned) return;
    const typed = await dialog.prompt({ title: "Supprimer le compte", label: `Tapez exactement : ${phrase}`, required: true });
    if (typed === null) return;
    if (typed !== phrase) {
      toast.show({ message: "La phrase saisie ne correspond pas, rien n'a été supprimé.", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      await invokeFn("delete-tenant-account", {});
      await supabase.auth.signOut();
      window.location.assign("/login");
    } catch (e) {
      setBusy(false);
      toast.show({ message: e instanceof Error ? e.message : "Erreur lors de la suppression.", tone: "error" });
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">La suppression désactivera votre société, votre accès au tableau de bord et toutes vos données. Irréversible.</p>
      <Button variant="danger" onClick={run} loading={busy} disabled={!canWrite}>
        Supprimer le compte entreprise
      </Button>
      {!canWrite ? <p className="text-xs text-muted-foreground">{offlineMessage}</p> : null}
    </div>
  );
}

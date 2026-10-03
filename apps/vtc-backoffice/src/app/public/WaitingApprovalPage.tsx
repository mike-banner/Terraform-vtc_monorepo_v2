import { Clock } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button, Card, useDialog } from "@/ui";

export default function WaitingApprovalPage() {
  const dialog = useDialog();
  const logout = async () => {
    if (!(await dialog.confirm({ title: "Déconnexion", message: "Voulez-vous vous déconnecter ?", confirmLabel: "Se déconnecter", variant: "danger" }))) return;
    await supabase.auth.signOut();
    window.location.assign("/");
  };
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 text-foreground">
      <Card className="w-full max-w-lg space-y-6 p-8 text-center">
        <Clock aria-hidden="true" className="mx-auto size-12 text-primary" />
        <h1 className="text-2xl font-bold">Dossier en cours d'examen</h1>
        <div className="space-y-4 leading-relaxed text-muted-foreground">
          <p>Merci d'avoir complété votre inscription. Nos équipes vérifient actuellement vos documents et les informations de votre véhicule.</p>
          <p className="border-t border-border pt-4 text-sm">
            Cette étape prend généralement <strong className="text-primary">moins de 24 heures</strong>. Vous recevrez un e-mail dès que votre compte sera activé.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <a href="/signup?edit=true" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
            Modifier mon dossier
          </a>
          <Button variant="secondary" onClick={() => void logout()}>
            Déconnexion
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">VTC HUB &bull; Service Qualité</p>
      </Card>
    </main>
  );
}

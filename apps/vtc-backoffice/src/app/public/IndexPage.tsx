import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button, Card } from "@/ui";

const FEATURES = [
  ["Comptabilité", "Chaque paiement et chaque remboursement est enregistré dans un grand livre qui ne se modifie pas."],
  ["Véhicules et chauffeurs", "Gérez votre flotte et les fiches de vos chauffeurs."],
  ["Réservations", "Créez vos courses, envoyez les devis et encaissez par Stripe."],
  ["Tableau de bord", "Votre chiffre du mois, vos prochaines courses et l'état de votre compte Stripe."],
] as const;

// ADR-009 : le rôle plateforme n'a que cet accueil ; il vient des claims du jeton (déjà authentifié par le middleware).
function platformRoleOf(accessToken: string | undefined): boolean {
  try {
    const payload = accessToken?.split(".")[1];
    if (!payload) return false;
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return Boolean(claims.platform_role);
  } catch {
    return false;
  }
}

export default function IndexPage() {
  const [admin, setAdmin] = useState(false);
  const [about, setAbout] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setAdmin(platformRoleOf(data.session?.access_token)));
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.assign("/");
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 text-foreground">
      <Card className="w-full max-w-2xl space-y-6 p-8 text-center sm:p-12">
        <h1 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">Le backoffice des chauffeurs VTC</h1>
        <p className="mx-auto max-w-xl text-muted-foreground">Réservations, tarifs, véhicules et comptabilité au même endroit.</p>
        {admin ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Vous êtes connecté en tant qu'administrateur plateforme.
              <br />
              Cet espace est réservé aux chauffeurs et agences.
            </p>
            <Button variant="danger" onClick={() => void logout()}>
              Se déconnecter
            </Button>
          </div>
        ) : (
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <a href="/signup" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-8 text-sm font-bold text-primary-foreground">
              Démarrer maintenant
            </a>
            <Button variant="secondary" onClick={() => setAbout((v) => !v)} aria-expanded={about}>
              En savoir plus
            </Button>
          </div>
        )}
        {about && !admin ? (
          <section aria-label="À propos" className="space-y-4 text-left">
            <div className="grid gap-3 sm:grid-cols-2">
              {FEATURES.map(([title, text]) => (
                <div key={title} className="rounded-xl border border-border p-4">
                  <h2 className="mb-1 text-sm font-bold">{title}</h2>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} VTC HUB</p>
      </Card>
    </main>
  );
}

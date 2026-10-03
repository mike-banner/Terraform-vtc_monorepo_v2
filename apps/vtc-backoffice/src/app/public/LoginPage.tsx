import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { env } from "@/lib/env";
import { Button, Field, Input, zodResolver } from "@/ui";
import { demoCredentials, reasonMessage, signIn } from "./login";

const schema = z.object({
  email: z.string().min(1, "Saisissez votre adresse e-mail.").email("Adresse e-mail invalide."),
  password: z.string().min(1, "Saisissez votre mot de passe."),
});
type Values = z.infer<typeof schema>;

const demo = demoCredentials(env);

export default function LoginPage() {
  const [params] = useSearchParams();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });

  // ?error= vient d'un lien externe : texte rendu en JSX (échappé), jamais interprété.
  const notice = failure ?? reasonMessage(params.get("reason")) ?? params.get("error");

  const submit = async ({ email, password }: Values) => {
    if (busy) return; // double soumission : une seule requête de connexion
    setBusy(true);
    setFailure(null);
    const r = await signIn(email, password);
    if (r.ok) {
      // Le middleware route selon le rôle ; aucune URL de redirection n'est lue de la requête.
      window.location.assign("/dashboard");
      return;
    }
    setFailure(r.message);
    setBusy(false);
  };

  return (
    <main className="flex min-h-dvh w-full bg-background text-foreground">
      <div className="relative hidden w-1/2 overflow-hidden bg-muted md:block">
        <div className="absolute bottom-12 left-12 max-w-md">
          <p className="mb-6 font-heading text-2xl font-semibold tracking-wide text-primary">VTC HUB</p>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Le centre de commande des flottes de chauffeurs privés : véhicules, chauffeurs et clientèle, au même endroit.
          </p>
        </div>
      </div>
      <div className="flex w-full flex-col items-center justify-center px-6 py-8 md:w-1/2 lg:p-12">
        <div className="flex w-full max-w-sm flex-col gap-4">
          <p className="text-center font-heading text-xl font-semibold tracking-wide text-primary md:hidden">VTC HUB</p>
          <div className="space-y-1 text-center md:text-left">
            <h1 className="font-heading text-2xl font-bold tracking-tight">Espace Gestion</h1>
            <p className="text-sm text-muted-foreground">Connectez-vous pour continuer.</p>
          </div>

          {notice ? (
            <p role="alert" className="rounded-xl border border-destructive/40 p-3 text-center text-sm font-bold text-destructive">
              {notice}
            </p>
          ) : null}

          {demo ? (
            <Button variant="secondary" disabled={busy} onClick={() => void submit(demo)}>
              Connexion démo
            </Button>
          ) : null}

          <form id="login-form" onSubmit={(e) => void handleSubmit(submit)(e)} noValidate className="space-y-3">
            <Field label="Adresse email" error={errors.email?.message}>
              <Input type="email" autoComplete="username" placeholder="contact@vtc.fr" {...register("email")} />
            </Field>
            <Field label="Mot de passe" error={errors.password?.message}>
              <Input type={showPassword ? "text" : "password"} autoComplete="current-password" {...register("password")} />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
              Afficher le mot de passe
            </label>
            <Button type="submit" loading={busy} className="w-full">
              Connexion
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Pas encore de compte ? <a href="/signup" className="font-bold text-primary underline underline-offset-2 hover:opacity-90">Créer un compte</a>
          </p>
        </div>
      </div>
    </main>
  );
}

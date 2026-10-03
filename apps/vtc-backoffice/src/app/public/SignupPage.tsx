import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { loadOnboardingState, submitSignup } from "@/features/signup/api";
import { prefill, resumeStep } from "@/features/signup/resume";
import { COMPANY_FORMS, EMPTY_VALUES, stepSchemas, type SignupValues } from "@/features/signup/schemas";
import { Button, Card, Field, Input, Select, Stepper, zodResolver } from "@/ui";

const LABELS = ["Compte", "Profil", "Entreprise"];

export default function SignupPage() {
  const [step, setStep] = useState(0);
  const [session, setSession] = useState<Awaited<ReturnType<typeof loadOnboardingState>>>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stepRef = useRef(0);
  stepRef.current = step;

  // Validation par étape : le résolveur lit l'étape courante ; les valeurs de toutes les étapes restent dans le formulaire.
  const { register, handleSubmit, getValues, reset, watch, formState: { errors } } = useForm<SignupValues>({
    defaultValues: EMPTY_VALUES,
    resolver: (values, ctx, opts) => zodResolver<SignupValues>(stepSchemas[stepRef.current] as never)(values, ctx, opts),
  });

  useEffect(() => {
    void loadOnboardingState().then((s) => {
      setSession(s);
      if (s) {
        reset(prefill(s.email, s.onboarding));
        setStep(resumeStep({ signedIn: true }));
      }
      setReady(true);
    });
  }, [reset]);

  const kind = watch("kind");
  const last = step === stepSchemas.length - 1;
  const first = session ? 1 : 0; // connecté : le compte existe déjà

  const next = async () => {
    if (!last) {
      setStep((s) => s + 1);
      return;
    }
    if (busy) return; // double soumission
    setBusy(true);
    setFailure(null);
    try {
      await submitSignup(getValues(), session);
      window.location.assign("/waiting-approval");
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Inscription impossible, réessayez.");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 text-foreground">
      <Card className="w-full max-w-xl space-y-6 p-6 sm:p-8">
        <Stepper steps={LABELS.map((label, i) => ({ id: String(i), label, done: i < step }))} current={String(step)} />
        <h1 className="font-heading text-2xl font-bold">{["Tes identifiants de connexion", "Identité du titulaire", "Détails juridiques et PRO"][step]}</h1>

        {!ready ? null : (
          <form onSubmit={(e) => void handleSubmit(next)(e)} noValidate className="space-y-3">
            {step === 0 ? (
              <>
                <Field label="Email professionnel" error={errors.email?.message}>
                  <Input type="email" autoComplete="email" placeholder="nom@entreprise.fr" {...register("email")} />
                </Field>
                <Field label="Mot de passe" error={errors.password?.message}>
                  <Input type="password" autoComplete="new-password" {...register("password")} />
                </Field>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Prénom" error={errors.first_name?.message}>
                    <Input autoComplete="given-name" {...register("first_name")} />
                  </Field>
                  <Field label="Nom" error={errors.last_name?.message}>
                    <Input autoComplete="family-name" {...register("last_name")} />
                  </Field>
                </div>
                <Field label="Téléphone" error={errors.phone_number?.message} hint={`Indicatif ${getValues("phone_prefix")}`}>
                  <Input type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="6 12 34 56 78" {...register("phone_number")} />
                </Field>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Field label="Type d'entreprise">
                  <Select {...register("kind")}>
                    <option value="societe">Société</option>
                    <option value="auto_entrepreneur">Auto-entrepreneur</option>
                  </Select>
                </Field>
                {kind === "societe" ? (
                  <Field label="Type de société">
                    <Select {...register("company_form")}>
                      {COMPANY_FORMS.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <Field label="Nom de l'entreprise" error={errors.company_name?.message}>
                  <Input placeholder="Ex : Prestige VTC" {...register("company_name")} />
                </Field>
                <Field label="Domaine web (prestige-vtc)" error={errors.primary_domain?.message}>
                  <Input placeholder="prestige-vtc" {...register("primary_domain")} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="SIRET (14 chiffres)" error={errors.siret?.message}>
                    <Input inputMode="numeric" placeholder="123 456 789 00012" {...register("siret")} />
                  </Field>
                  <Field label="Carte VTC (12 chiffres)" error={errors.vtc_license_number?.message}>
                    <Input inputMode="numeric" placeholder="123 456 789 012" {...register("vtc_license_number")} />
                  </Field>
                </div>
              </>
            ) : null}

            {failure ? (
              <p role="alert" className="text-sm font-bold text-destructive">
                {failure}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              {step > first ? (
                <Button variant="secondary" className="sm:flex-1" onClick={() => setStep((s) => s - 1)}>
                  Retour
                </Button>
              ) : null}
              <Button type="submit" loading={busy} className="sm:flex-1">
                {last ? "Finaliser" : "Suivant"}
              </Button>
            </div>
          </form>
        )}
        {step === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Déjà un compte ? <a href="/login" className="font-bold text-primary underline underline-offset-2 hover:opacity-90">Se connecter</a>
          </p>
        ) : null}
      </Card>
    </main>
  );
}

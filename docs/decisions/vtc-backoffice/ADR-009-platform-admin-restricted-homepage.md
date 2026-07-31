# ADR-009 : Admins plateforme confinés à la page d'accueil du backoffice

- **Date** : 2026-06-30
- **Statut** : Accepté et implémenté (`apps/backoffice/src/middleware.ts`)

## Contexte

Les admins plateforme (`profile.platform_role`) tentaient d'accéder au backoffice (`/app`, `/onboarding`) qui est l'espace SaaS réservé aux tenants (chauffeurs/agences). L'administration de la plateforme (validation des onboardings, gestion des tenants) vit dans une app séparée (`apps/superadmin`), pas dans le backoffice.

## Décision

Dans `middleware.ts`, dès qu'un profil a un `platform_role` non nul :
- Toute route autre que `/` (home) déclenche une redirection vers `/`.
- Aucun accès à `/app/*`, `/admin/*`, `/onboarding/*` même connecté.
- La page d'accueil expose uniquement un bouton de déconnexion pour ce profil — pas de navigation vers le reste du SaaS.

```ts
if (profile?.platform_role) {
  if (!isHomePage) return redirect('/');
  return next();
}
```

Cette vérification est placée en priorité, avant la logique tenant (onboarding pending / actif), pour qu'un admin ne tombe jamais dans un flow tenant par erreur de routage.

## Conséquences

- L'admin plateforme n'a plus aucune action possible côté backoffice — toute opération d'administration doit passer par `apps/superadmin`.
- Si une nouvelle route SaaS est ajoutée, elle doit être incluse dans `isSaaSRoute` du middleware, sinon elle contourne silencieusement cette restriction.

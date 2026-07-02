# ADR-007: Pipeline TVA Complet & UX Settings Entreprise

## Contexte

La V1 ignorait la TVA : tous les montants étaient traités comme bruts. L'ajout d'un onglet Fiscal complet a rendu nécessaire un pipeline TVA cohérent de bout en bout, depuis la création du tenant jusqu'à la déclaration mensuelle.

Par ailleurs, la page `/app/settings` (onglet Entreprise) manquait de hiérarchie visuelle claire et mélangeait identité, navigation et fiscalité sans ordre logique.

## Décisions

### 1. Les prix grille sont traités comme TTC
Les chauffeurs raisonnent en prix affiché client (TTC). La TVA est **extraite** du TTC, jamais ajoutée par-dessus. Formula : `HT = TTC / (1 + taux)`.

Helper centralisé : `computeVat(totalTTC, vatRate)` dans `src/lib/pricing.ts`. Utilisé dans `create-booking.ts` et `stripe_webhook`.

### 2. Forme juridique → statut TVA automatique

| Forme | is_vat_exempt | vat_rate |
|---|---|---|
| `auto_entrepreneur`, `ei` | `true` | `null` |
| `sasu`, `sas`, `eurl`, `sarl`, `other` | `false` | `0.10` (10%) |

Enforced par deux triggers :
- `trg_set_tenant_vat_on_insert` — initialise à la création du tenant
- `trg_sync_tenant_vat` — synchronise à chaque UPDATE de `legal_form`

### 3. Persistance via API server-side

La mise à jour de la forme juridique passe par `/api/tenant/update-settings` (admin client) pour bypasser la RLS côté browser. La RLS Supabase interdit le self-update du tenant depuis le client anon.

### 4. Ordre des sections Settings Entreprise

Ordre retenu : **Identité** (nom + logo) → **Grille Tarifaire** (lien) → **Gestion de Flotte** (lien) → **Fiscalité**. Logique : de l'identité vers la configuration opérationnelle.

Le logo est prévisualisé sur fond en damier (checkered) pour rendre visible la transparence des PNG.

## Statut
Déployé — 2026-05-31

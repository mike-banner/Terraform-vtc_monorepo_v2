# Modèles d'email

Tous les emails passent par `layout.ts` (coquille commune) et `brand.ts` (marque du chauffeur).

## Deux familles

| Dossier | Contenu | Le chauffeur peut changer |
|---|---|---|
| `native/` | Montants, mentions légales, actions requises. Texte et structure fixes. | Rien (la marque seule s'applique quand le client la voit) |
| `site/` | Relation client : confirmation, annulation. | Marque : logo, couleur d'accent, nom et coordonnées (colonnes `tenants`) |

La marque vient de `tenants` : `name`, `logo_url` (https), `primary_color` (#rrggbb), `email`, `phone`. Sans valeur valide : style neutre. Pas de HTML libre : risque de sécurité et de non-conformité.

## Catalogue

| Modèle | Destinataire | Déclencheur | Branché |
|---|---|---|---|
| `site/booking-confirmation` | Client | Course créée par le webhook Stripe | oui (journal `booking_confirmation`) |
| `site/booking-cancelled` | Client | Annulation d'une course | non (à brancher avec le plan 14.1-02, `cancel-booking`) |
| `native/refund-confirmation` | Client | Remboursement lancé | non (idem) |
| `native/payment-without-booking` | Chauffeur | Paiement encaissé, course non créée | oui |
| `native/payment-received-customer` | Client | Idem | oui |
| `native/invoice` | Client | Facture émise | oui |
| `native/credit-note` | Client | Avoir émis | oui (`generate-credit-note`, journal `credit_note`) |
| `native/devis` | Client | Devis | oui |

## Ajouter un modèle

Une fonction `xxxEmail(data): string` qui appelle `emailLayout`, avec `h()` sur toute donnée dynamique. Ajouter un cas au test `email-templates.test.ts` et une ligne au catalogue.

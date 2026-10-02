# Système de Facturation VTC

## 1. Devis vs Facture — Différences Légales

### Devis (Proforma)

Un devis est une **proposition commerciale sans valeur fiscale**. Il peut être annulé librement à tout moment sans écriture comptable.

**Dans ce système :**
- Facture maison en PDF, émise **à la demande** (bouton « Facture PDF ») sur une course terminée, par un owner ou un manager du tenant. Edge Function `generate-invoice`, aucune facture Stripe.
- Le numéro `FAC-AAAA-NNNN` est attribué par la RPC `assign_invoice_number`, dans la même transaction que son enregistrement sur la course (`bookings.invoice_number`) : aucun trou de séquence. Un second appel renvoie la même facture. L'année est celle de Paris.
- L'adresse du vendeur (Réglages) est obligatoire : sans elle l'émission est refusée.
- Les mentions légales (vendeur, client, dates en heure de Paris, « Prestation de services », TVA ou art. 293 B, bloc professionnel pour un client société) sont produites par `_shared/invoice-mentions.ts`, couvert par des tests.
- Le PDF est déposé dans le bucket privé `invoices` (`{tenant}/factures/{course}.pdf`) ; le lien signé de 7 jours est recalculé à chaque appel.
- La conformité des modèles est validée par écrit par le client, après relecture de son expert-comptable, avant la première vraie facture.

**Numérotation séquentielle** : le compteur `next_invoice_number(tenant_id, year)` n'est appelé que par `assign_invoice_number` (service_role seul). Conforme à l'art. L441-3 (voir section 4).

### Avoir (`AV-AAAA-NNNN`)

- Total ou partiel, émis depuis la fiche de la course facturée par l'Edge Function `generate-credit-note` (RPC `issue_credit_note`, owner ou manager).
- Il référence la facture d'origine ; la somme des avoirs ne dépasse jamais le total de la course. Le « reste à créditer » est lu par la RPC `credit_note_remaining` : aucun calcul de montant dans le navigateur.
- Numéro, avoir et mouvement `refund` (`debit`) au grand livre sont écrits dans une seule transaction, par `ledger_insert_refund` (ADR-013). Le mouvement n'a pas de PaymentIntent (le lien est `booking_id` et `created_by_event = credit_note:<id>`).
- Course payée par carte : l'avoir déclenche un remboursement Stripe du même montant (clé d'idempotence `credit-note-<id>`, métadonnée `credit_note_id` : le webhook n'écrit alors rien au grand livre). Si Stripe échoue, l'avoir reste émis ; rappeler la fonction avec `{ credit_note_id }` relance le remboursement sans le doubler.
- Course en espèces : l'argent est rendu hors application, le mouvement est écrit quand même.
- Un avoir ou une facture émis ne se modifie ni ne se supprime (trigger sur `credit_notes`).

### Processus d'annulation selon le cas

#### Cas 1 : Annulation avant paiement (devis ou booking `pending`)
- Passer le booking en `cancelled`
- Aucune écriture dans `financial_movements`
- Si un devis PDF a été généré, il reste en Storage mais n'a aucune valeur

#### Cas 2 : Correction après facture
1. Ne jamais supprimer la facture
2. Émettre un **avoir** `AV-` (total ou partiel) depuis la fiche de la course
3. Le mouvement `refund` (`debit`) est écrit par l'avoir ; l'équilibre du tenant dans `tenant_accounting_ledger` suit

---

---

## 2. Flux de Génération

```
Paiement Stripe (Checkout)
  └─ stripe_webhook → booking (status: paid, payment_mode: stripe)
       └─ trigger DB → financial_movements (automatique)

Création manuelle backoffice
  └─ booking (status: pending / accepted)
       └─ [bouton] generate-devis → PDF proforma (DEV-)

Course terminée (mission_status: completed), carte ou espèces
  ├─ trigger DB → financial_movements (cash : à la fin de la course)
  └─ [bouton] generate-invoice → assign_invoice_number → PDF (FAC-)
       └─ [bouton] generate-credit-note → avoir PDF (AV-) + mouvement refund
            └─ course carte : remboursement Stripe du même montant
```

---

## 3. Export Comptable (Ledger)

### Route API

```
GET /api/tenant/export-csv?month=YYYY-MM        → export mensuel
GET /api/tenant/export-csv?fiscal_year=YYYY     → export exercice fiscal complet
```

### Colonnes du CSV

| Colonne | Source |
|---|---|
| Date | `financial_movements.created_at` |
| N° Facture | `bookings.invoice_number` |
| Client | `customers.company_name` ou `first_name + last_name` |
| Adresse départ | `bookings.pickup_address` |
| Adresse arrivée | `bookings.dropoff_address` |
| Date course | `bookings.pickup_time` |
| Type mouvement | `financial_movements.movement_type` |
| Mode paiement | `bookings.payment_mode` |
| Montant TTC | `financial_movements.gross_amount` |
| TVA | `financial_movements.vat_amount` |
| Montant HT | `financial_movements.net_amount` |
| Réf. Stripe | `financial_movements.stripe_payment_intent_id` |
| Source | `financial_movements.created_by_event` |

### Exercice fiscal décalé

La colonne `tenants.fiscal_year_start_month` (INT 1–12, défaut 1 = janvier) permet de configurer un exercice décalé.

Exemple avec `fiscal_year_start_month = 7` (juillet) :
- Exercice 2026 = **1er juillet 2026 → 30 juin 2027**
- Le CSV `fiscal_year=2026` couvrira automatiquement cette période

**Configuration** : paramètre modifiable dans les réglages du compte tenant (à câbler en frontend).

### Format

- Encodage UTF-8 avec BOM (compatible Excel FR)
- Séparateur `;`
- Champs texte entre guillemets si contiennent des virgules
- Décimales avec virgule (`1234,56`) pour Excel FR

---

## 4. ✅ Numérotation Séquentielle (Implémentée)

La numérotation suit l'art. L441-3 : compteur séquentiel par tenant et par année, sans rupture ni réutilisation.

**Migrations :**
- `20260629000004_invoice_sequences.sql` : table `invoice_sequences` + fonction `next_invoice_number`
- `20260729221600_enable_rls_invoice_sequences.sql` : RLS activé, accès restreint au `service_role`
- `20261002130100_assign_invoice_number.sql` : `assign_invoice_number` (numéro et enregistrement dans la même transaction), `next_invoice_number` retiré aux clients
- `20261002130200_credit_notes.sql` : `credit_notes`, `credit_note_sequences` (même mécanisme, préfixe `AV-`), `issue_credit_note`, `credit_note_remaining`

L'UPSERT `INSERT ... ON CONFLICT (tenant_id, year) DO UPDATE SET last_seq = last_seq + 1` est atomique ; comme il s'exécute dans la transaction qui enregistre le numéro, un échec annule aussi la consommation du numéro.

---

## 5. E-Invoicing (Facturation Électronique Obligatoire)

La réforme française (Ordonnance 2021-1190) impose la transmission des factures B2B via une plateforme agréée DGFiP.

**Calendrier :**
| Date | Obligation |
|---|---|
| Sept. 2026 | Réception e-facture obligatoire pour tous |
| Sept. 2027 | **Émission obligatoire pour TPE/micro-entrepreneurs** (= VTC indépendants) |

**Format requis** : Factur-X (PDF/A-3 + XML embarqué), UBL, ou CII.

**Stripe n'est pas une PDP française agréée.** Un PDF maison est valide commercialement mais non conforme à la transmission fiscale réglementaire.

**Architecture cible 2027 :**
- Conserver `generate-invoice` pour la génération du document (différé : Factur-X en 09/2027)
- Plugger une PDP agréée pour la transmission (ex : Chorus Pro direct via API, Pennylane, ou un intégrateur PDP)
- Adopter le format Factur-X pour les PDFs (PDF/A-3 + XML Factur-X embarqué)
- Aucun changement de modèle de données nécessaire — ajouter une colonne `facturx_transmitted_at` sur `bookings`

# Système de Facturation VTC

## 1. Devis vs Facture — Différences Légales

### Devis (Proforma)

Un devis est une **proposition commerciale sans valeur fiscale**. Il peut être annulé librement à tout moment sans écriture comptable.

**Dans ce système :**
- Généré par l'Edge Function `generate-devis`
- Stocké dans le bucket Storage `invoices/{tenant_id}/devis/{booking_id}.pdf`
- Référencé dans `bookings.invoice_number` avec le préfixe `DEV-`
- Porte la mention légale : *"Ce document est un devis sans valeur fiscale. Il ne constitue pas une facture."*
- Déclenché uniquement pour les **créations manuelles backoffice** et les tunnels sur-mesure — pas pour les paiements Stripe en ligne (qui naissent directement en `paid`)

**Annulation d'un devis :** aucune action comptable requise. La course peut passer en `cancelled` sans impact sur le grand livre.

---

### Facture Officielle

Une facture est un **document fiscal obligatoire** dès que la prestation est réalisée et réglée (art. L441-3 du Code de Commerce).

**Règles légales impératives :**

| Règle | Détail |
|---|---|
| **Numérotation séquentielle** | Obligatoire, sans rupture, sans réutilisation. Format conseillé : `FAC-{ANNÉE}-{SÉQUENCE}` (ex: `FAC-2026-0001`) |
| **Non annulable** | Une facture émise ne peut pas être supprimée. Toute correction passe par un **avoir** (facture de crédit) |
| **Conservation** | 10 ans minimum |
| **Mentions obligatoires** | Date, numéro, SIRET émetteur, identité client, description prestation, montant HT, TVA (ou mention 293 B CGI), montant TTC |

**Dans ce système :**
- Générée par l'Edge Function `generate-invoice`
- Créée sur le compte Stripe Connect du tenant (`stripe_account_id`)
- Accessible via `bookings.invoice_url` (URL hébergée Stripe)
- Référencée dans `bookings.invoice_number` avec le préfixe `FAC-`

**⚠️ Bug connu — numérotation non séquentielle** : le format actuel `FAC-YYYYMMDD-{id_court}` n'est pas conforme. À corriger avec un compteur séquentiel par tenant + année en base de données (voir section 4).

---

### Processus d'annulation selon le cas

#### Cas 1 : Annulation avant paiement (devis ou booking `pending`)
- Passer le booking en `cancelled`
- Aucune écriture dans `financial_movements`
- Si un devis PDF a été généré, il reste en Storage mais n'a aucune valeur

#### Cas 2 : Annulation après paiement (booking `paid` ou `completed`)
1. Ne pas supprimer la facture Stripe — elle doit rester
2. Créer une **facture d'avoir (credit note)** via `stripe.creditNotes.create({ invoice: stripe_invoice_id, amount: totalCents })`
3. Insérer un mouvement de type `refund` dans `financial_movements` (direction `debit`)
4. Mettre à jour `bookings.status` en `cancelled` ou `refunded`
5. Le total net du tenant dans `tenant_accounting_ledger` se rééquilibre automatiquement

---

## 2. Flux de Génération

```
Paiement Stripe (Checkout)
  └─ stripe_webhook → booking (status: paid, payment_mode: stripe)
       ├─ trigger DB → financial_movements (automatique)
       └─ generate-invoice → Facture Stripe → bookings.invoice_url

Création manuelle backoffice
  └─ booking (status: pending / accepted)
       └─ [bouton] generate-devis → PDF proforma → bookings.invoice_url (DEV-)
            └─ Course terminée + paiement encaissé
                 ├─ mission_status: completed → trigger DB → financial_movements (cash)
                 └─ [bouton] generate-invoice (paid_out_of_band) → Facture Stripe → bookings.invoice_url (FAC-)
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

## 4. ⚠️ Numérotation Séquentielle (À implémenter)

La numérotation actuelle `FAC-YYYYMMDD-{id_court}` n'est pas conforme à l'art. L441-3.

**Migration à créer :**
```sql
-- Compteur séquentiel par tenant et par année
CREATE TABLE invoice_sequences (
  tenant_id uuid REFERENCES tenants(id),
  year      int,
  last_seq  int DEFAULT 0,
  PRIMARY KEY (tenant_id, year)
);

-- Fonction thread-safe pour incrémenter
CREATE OR REPLACE FUNCTION next_invoice_number(t_id uuid, y int)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE seq int;
BEGIN
  INSERT INTO invoice_sequences (tenant_id, year, last_seq)
  VALUES (t_id, y, 1)
  ON CONFLICT (tenant_id, year)
  DO UPDATE SET last_seq = invoice_sequences.last_seq + 1
  RETURNING last_seq INTO seq;
  RETURN format('FAC-%s-%s', y, lpad(seq::text, 4, '0'));
END;
$$;
```

Appel dans `generate-invoice` :
```ts
const { data } = await supabase.rpc('next_invoice_number', {
  t_id: booking.current_tenant_id,
  y: new Date().getFullYear(),
});
const invoiceNumber = data; // "FAC-2026-0001"
```

---

## 5. E-Invoicing (Facturation Électronique Obligatoire)

La réforme française (Ordonnance 2021-1190) impose la transmission des factures B2B via une plateforme agréée DGFiP.

**Calendrier :**
| Date | Obligation |
|---|---|
| Sept. 2026 | Réception e-facture obligatoire pour tous |
| Sept. 2027 | **Émission obligatoire pour TPE/micro-entrepreneurs** (= VTC indépendants) |

**Format requis** : Factur-X (PDF/A-3 + XML embarqué), UBL, ou CII.

**Stripe n'est pas une PDP française agréée.** Les factures Stripe sont valides commercialement mais non conformes à la transmission fiscale réglementaire.

**Architecture cible 2027 :**
- Conserver `generate-invoice` pour la génération du document
- Plugger une PDP agréée pour la transmission (ex : Chorus Pro direct via API, Pennylane, ou un intégrateur PDP)
- Adopter le format Factur-X pour les PDFs (PDF/A-3 + XML Factur-X embarqué)
- Aucun changement de modèle de données nécessaire — ajouter une colonne `facturx_transmitted_at` sur `bookings`

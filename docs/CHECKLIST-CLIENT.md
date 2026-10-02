# Checklist : monter l'application d'un client

À suivre dans l'ordre, du premier échange à la mise en service. Chaque case est une action ou un contrôle. Le détail technique est
dans [`INSTANCES.md`](INSTANCES.md) (instances, sites, bucket privé, installation, mises à jour) et [`BILLING.md`](BILLING.md)
(factures, avoirs, export comptable).

Le dépôt est **public** : cette liste ne contient aucun nom de client, aucun secret, aucune valeur. Tout ce qui est propre à un
client vit dans son fichier d'environnement et dans le registre, hors dépôt.

## A. Cadrage, avant tout travail

- [ ] Le client est **une entreprise, une instance** : jamais deux entreprises dans la même base (une marque de plus de la même
      entreprise = un tenant de plus, pas une instance de plus).
- [ ] Périmètre noté : nombre de sites et de domaines, services proposés (transferts à prix fixe, mise à disposition à l'heure,
      longue distance sur devis ; le Business est mis de côté tant que la facture électronique n'existe pas).
- [ ] Contrat de licence et de maintenance signé (abonnement, mise en place, ce qui est inclus).
- [ ] Verrou de facturation (D-24) : **aucune vraie facture** avant la confirmation écrite du client (ou de son expert-comptable)
      que les libellés et mentions des factures et avoirs lui conviennent. Prévoir l'envoi des échantillons.

## B. Comptes du client (accès limité, jamais ses mots de passe)

- [ ] **Supabase** : nouveau projet **à son nom**, région UE. Page « API Keys » ouverte : clés héritées `anon` et `service_role`
      présentes (sinon STOP, voir `INSTANCES.md`).
- [ ] **Cloudflare** : compte du client, et son domaine géré par Cloudflare (DNS) ou accès pour y poser des enregistrements.
- [ ] **Stripe** : compte du client activé. Clé **restreinte** (Checkout Sessions en écriture, PaymentIntents en lecture, Refunds
      en écriture), reçue par un canal chiffré, jamais par e-mail en clair. D'abord le **mode test**.
- [ ] **Resend** (envoi des e-mails) : compte, puis **domaine d'envoi vérifié** (enregistrements DNS demandés par Resend, SPF et
      DKIM, à poser dans la zone DNS du client). Sans domaine vérifié, aucun e-mail ne part en production.
- [ ] **Terraform Cloud** : workspace du client en exécution **Local**. Jamais de superadmin chez un client
      (`enable_superadmin = false`).

## C. Informations à recueillir auprès du client

- [ ] Identité légale : raison sociale, forme juridique, SIRET, RCS, TVA (ou franchise), capital, **adresse du siège**, exercice
      fiscal (mois de début).
- [ ] Contact : téléphone et e-mail publics, **e-mail du propriétaire** (un compte = un tenant : une autre adresse par marque).
- [ ] Marque : nom affiché, logo (https), couleur d'accent, textes de la landing, images.
- [ ] Services et prix : **zones** (villes, aéroports, parcs ; codes postaux des villes), **trajets à prix fixe** entre zones et
      leur prix, tarifs de départ (base, km, heure, minimum), véhicules et chauffeurs.
- [ ] **Politique d'annulation** (délais et taux de remboursement) : valeurs par défaut, modifiables par le client.
- [ ] Mentions légales, conditions générales et **politique de confidentialité**. Elle doit citer l'envoi des adresses saisies au
      service public `api-adresse.data.gouv.fr` pour contrôler la zone (finalité : vérifier la zone du trajet ; aucune conservation
      par nous).

## D. Préparation sur ta machine

- [ ] `<code>.instance.env` créé **hors dépôt**, droits `600`, jamais dans R2, jamais dans GitHub. Liste des variables dans
      `INSTANCES.md`. Ne pas oublier **`EMAIL_FROM`** (adresse du domaine vérifié chez Resend) et `RESEND_API_KEY` : sans
      `EMAIL_FROM`, la fonction d'envoi ne démarre plus. **L'adresse de test du développeur ne doit jamais rester** : `EMAIL_FROM`
      est celle du domaine du client, et aucune adresse personnelle n'est écrite dans le code.
- [ ] Fichier R2 chargé (`~/.config/<dossier privé>/r2.env`), accès au bucket privé vérifié.
- [ ] Code d'instance **neutre** (jamais le nom du client) et préfixe de projet choisis.
- [ ] Site du client créé : copie de `sites/_modele`, `config.ts` renseigné, `tsc --noEmit`, archive envoyée dans R2.

## E. Répétition sur un projet de test

- [ ] Projet Supabase de test et site d'essai copié de `_modele`, archivé dans R2.
- [ ] `scripts/install-instance.sh <fichier> --check` : préflight sans aucune écriture.
- [ ] Installation complète sur le projet de test, puis contrôle des trois parcours (paiement, annulation avec remboursement,
      facture). À refaire à chaque nouvelle livraison majeure.

## F. Installation chez le client

- [ ] Tag de livraison posé (`livraison-AAAA-MM-JJ`, jamais un nom de client), `git checkout <tag>`.
- [ ] `scripts/install-instance.sh <fichier>` : une confirmation avant chaque écriture, dans l'ordre :
  - [ ] plan Terraform relu (aucune destruction), puis application ;
  - [ ] migrations : `db push --dry-run` (liste exactement attendue), puis `db push` ;
  - [ ] secrets des fonctions : clés Stripe, `RESEND_API_KEY`, **`EMAIL_FROM`** (vérifier avec `supabase secrets list`) ;
  - [ ] fonctions déployées (et suppression de celles qui sont retirées) ;
  - [ ] tenant et propriétaire créés (`seed-instance.mjs` : le propriétaire reçoit une invitation par e-mail, aucun mot de passe
        n'est choisi par toi) ;
  - [ ] sites récupérés depuis R2, compilés avec `PUBLIC_SITE` et `SITE_MAP`, déployés depuis ta machine.
- [ ] **Domaine** rattaché au projet Pages du site, redirection `www` vers le domaine.
- [ ] **Stripe** : endpoint webhook `https://<ref>.supabase.co/functions/v1/stripe_webhook` avec `checkout.session.completed`,
      `refund.updated`, `refund.failed` ; son secret enregistré. Le client ne touche pas à « Connecter Stripe ».
- [ ] **E-mail** : un e-mail de test envoyé depuis l'instance (confirmation de réservation par exemple), reçu, expéditeur correct,
      pas classé en courrier indésirable.

## G. Premier démarrage avec le client

- [ ] Le propriétaire accepte l'invitation et termine l'assistant de démarrage (véhicule, tarifs de départ).
- [ ] Il renseigne l'**adresse de l'entreprise** dans Réglages (obligatoire pour émettre une facture) et vérifie ses mentions.
- [ ] Il crée ses **zones** (une par ville ou point, avec leurs codes postaux ; pas de recouvrement entre deux zones), puis ses
      **trajets** à prix fixe entre deux zones existantes.
- [ ] Il règle sa **politique d'annulation**.
- [ ] Parcours en **mode test Stripe** (carte `4242 4242 4242 4242`) : réservation d'un transfert, adresse hors zone refusée dans
      le tunnel, course visible au backoffice, instructions du client, annulation avec remboursement, ligne au grand livre,
      demande de devis sur une mise à disposition, validation avec alerte de conflit, facture et avoir.
- [ ] Un chauffeur de test (rôle `driver`) ne voit que ses courses et ne modifie pas les zones.

## H. Mise en service

- [ ] Passage en **mode live** : clé Stripe live du client (restreinte), nouvel endpoint webhook live, secrets mis à jour,
      `terraform plan` vide.
- [ ] Un **vrai paiement de faible montant** remboursé aussitôt, de bout en bout, avec le client.
- [ ] Verrou de facturation (D-24) levé **par écrit** par le client ou son expert-comptable, ou consigné comme toujours actif.
- [ ] Politique de confidentialité et mentions légales en ligne sur son site.

## I. Après la mise en service

- [ ] **Registre** (`registre/instances.md` dans R2) mis à jour : code neutre, client, ref Supabase, comptes et projets Cloudflare,
      workspace, domaines et `SITE_MAP`, mode Stripe, tag livré et son commit, dernière migration, date, emplacement du fichier
      d'environnement, contact, date de la confirmation de conformité. **Aucun secret.**
- [ ] Sauvegardes : accès au projet Supabase du client, sauvegardes activées, procédure de restauration connue.
- [ ] Le client sait à qui s'adresser (support, délai de réponse).
- [ ] Mises à jour : une instance à la fois, depuis un tag, migrations puis fonctions puis front (voir `INSTANCES.md`).

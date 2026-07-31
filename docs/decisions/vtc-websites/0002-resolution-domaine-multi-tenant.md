# ADR 0002 : Résolution de Domaine Multi-Tenant Dynamique à Grande Échelle

- **Date** : 2026-05-23
- **Statut** : Proposé
- **Auteur** : Mike & Antigravity

## Contexte
Le projet vitrine VTC est un dépôt unique (Monorepo/Single Codebase) conçu pour héberger et servir potentiellement des milliers de locataires (tenants) et sites différents. 
Configurer des variables d'environnement individuelles (comme `PUBLIC_TENANT_ID` ou `PUBLIC_SITE`) dans Cloudflare Pages pour chaque nouveau client est irréalisable à grande échelle (limite de projets, complexité de maintenance, lenteur opérationnelle).
De plus, en phase de développement ou de preview (branches de pré-production), le domaine d'accès (ex: `localhost`, `*.pages.dev`) ne correspond pas aux domaines de production finaux (ex: `elite-lyon.fr`), risquant de provoquer des erreurs de routage (404/page blanche).

## Décision
Pour supporter plus de 10 000 sites sans surcharge de configuration, la résolution du locataire (tenant) s'effectue dynamiquement en base de données à partir de l'hôte HTTP de la requête entrante.

1. **Mapping par base de données** :
   - Ajout d'une table `tenants` dans Supabase contenant le mapping `primary_domain` ↔ `tenant_id` ↔ `site_code`.
   - Le middleware intercepte la requête, extrait le domaine (`Host` HTTP) et effectue une requête unique Supabase pour récupérer le tenant et le code du site.
2. **Configuration Cloudflare unique** :
   - Seules les variables de connexion de base (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`) sont requises au niveau global de l'infrastructure Cloudflare Pages.
3. **Stratégie d'accès sans domaine (Dev/Preview)** :
   - **En local** : Utilisation de la variable de débogage `PUBLIC_SITE` dans le `.env` pour forcer le site à tester.
   - **En pré-production (Pages de preview)** : Utilisation d'un mapping d'alias de test dans le routeur (ex: `localhost:4321` mappe sur le template `elite-lyon`) ou extraction du sous-domaine de preview (ex: `elite-lyon.vtc-drivers.pages.dev` résout le site `elite-lyon`).
4. **Proxy d'initialisation Supabase** :
   - Implémentation d'un Proxy JavaScript pour l'initialisation du client Supabase afin d'éviter le plantage complet du serveur au démarrage si les clés d'API sont absentes sur l'environnement de déploiement.

## Conséquences
- **Scalabilité infinie** : L'ajout d'un nouveau client se fait sans modification de code ni de configuration Cloudflare (simple ajout d'une ligne en base et pointage CNAME).
- **Maintenance simplifiée** : Une seule configuration Cloudflare Pages à gérer pour tout le parc de sites.
- **Latence réseau minime** : La requête de résolution du tenant par le middleware est effectuée à chaque requête SSR (mise en cache des résultats via Cloudflare KV ou Cloudflare Cache recommandée par la suite pour optimiser les performances).

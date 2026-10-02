# Architecture Multi-Tenancy & Sites Vitrines (`apps/vtc-websites`)

Ce document explique le fonctionnement du moteur multi-tenant de sites vitrines hébergés dans `apps/vtc-websites`.

---

## 💡 Concept Produit : Sites Vitrines Multi-Chauffeurs & Groupements

L'application `apps/vtc-websites` permet à la plateforme de déployer et personnaliser instantanément un site vitrine haut de gamme pour :
- **Chauffeurs VTC Indépendants** : Site vitrine propre avec leur logo, tarifs et téléphone direct.
- **Groupements & Agences VTC Connectés** : Gestion multi-chauffeurs sous une même enseigne de marque.

---

## 🛠️ Mécanisme Technique

### 1. Résolution Dynamique du Tenant (`resolveTenant`)
Sites d'une instance (ADR 0003) : le domaine choisit le site dans `SITE_MAP`, fournie à la compilation (un domaine par site, un tenant par site) ; seuls les sites listés sont compilés ; les tunnels sont communs.

Lorsqu'un client visite un domaine (ex: `exemple.invalid`), le middleware Astro identifie le domaine dans la table `tenants` de Supabase :

```ts
// src/core/tenant.ts
export async function resolveTenant(host: string) {
  const { data } = await supabase
    .from("tenants")
    .select("*")
    .eq("primary_domain", host)
    .single();
  return data;
}
```

### 2. Branding Sur-Mesure
* **Logo Agence/Chauffeur** : Récupéré dynamiquement depuis le bucket Supabase Storage via `tenant.logo_url`.
* **Nom de Société** : Affiché à droite du logo avec typographie de prestige (`text-2xl font-black uppercase`).
* **Thème Visuel & Tarifs** : Chargés à la volée depuis la configuration du tenant en base.

### 3. Connexion aux 4 Tunnels de Réservation
Le widget de réservation du Hero permet d'orienter le client vers les tunnels spécialisés :
1. **Transfert A ➔ B** (`/tunnels/transfert`) : Estimation kilométrique fixe.
2. **Mise à Disposition** (`/tunnels/availability`) : À l'heure, période début-fin, sur devis (demande enregistrée, prix fixé par le chauffeur).
3. **Longue Distance** (`/tunnels/long-distance`) : Interurbain et trajets régionaux, sur devis.
4. **Business & VIP** : mis de côté (D-35), non exposé.

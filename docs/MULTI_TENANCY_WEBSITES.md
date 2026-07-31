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
Lorsqu'un client visite un domaine (ex: `elite-lyon.fr` ou `mon-vtc-paris.fr`), le middleware Astro identifie le domaine dans la table `tenants` de Supabase :

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
Le widget de réservation du Hero permet d'orienter le client vers 4 tunnels spécialisés :
1. **Transfert A ➔ B** (`/tunnels/transfert`) : Estimation kilométrique fixe.
2. **Mise à Disposition** (`/tunnels/availability`) : Réservation forfaitaire par heures (2h, 4h, 8h, 12h).
3. **Longue Distance** (`/tunnels/long-distance`) : Interurbain et trajets régionaux.
4. **Business & VIP** (`/tunnels/business`) : Demandes d'événements et séminaires.

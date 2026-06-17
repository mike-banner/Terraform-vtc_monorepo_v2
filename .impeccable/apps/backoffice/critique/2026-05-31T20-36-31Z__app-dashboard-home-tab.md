---
target: app/dashboard home tab
total_score: 24
p0_count: 0
p1_count: 1
timestamp: 2026-05-31T20-36-31Z
slug: app-dashboard-home-tab
---
## Design Health Score — Home (Dashboard)

| # | Heuristic | Score | Issue |
|---|-----------|-------|-------|
| 1 | Visibility of System Status | 3 | Stripe, mission en cours, retard bien signalés. Gap: pas d'état global si la page charge lentement |
| 2 | Match System / Real World | 3 | "Balance" peut prêter à confusion (revenu mensuel vs solde). Reste bon |
| 3 | User Control and Freedom | 2 | Alerte retard non dismissable. Mission dock ne peut pas se fermer/réduire |
| 4 | Consistency and Standards | 3 | Design system cohérent sur le set dark/indigo. Quelques écarts de spacing |
| 5 | Error Prevention | 3 | H-15 guard bien implémenté. Accept booking a une confirmation |
| 6 | Recognition Rather Than Recall | 3 | Nav labels présents. Le dock missions manque d'un affordance "tap = détails" |
| 7 | Flexibility and Efficiency | 2 | Aucune action rapide accessible directement depuis Home. Tout passe par modale ou autre onglet |
| 8 | Aesthetic and Minimalist Design | 2 | La carte véhicule + dock + nav crée une surcharge visuelle. Urgences enterrées sous info statique |
| 9 | Error Recovery | 2 | alert() natif pour les erreurs réseau. Stripe error state est bien, les autres ne le sont pas |
| 10 | Help and Documentation | 1 | Zéro aide contextuelle. Onboarding Stripe : bouton seul, aucune explication |
| **Total** | | **24/40** | **Acceptable — améliorations structurelles nécessaires** |

## Anti-Patterns Verdict

**LLM assessment**: Palette indigo omniprésent sur fond #050505 = "dark SaaS AI default 2025". Concept correct, exécution identifiable.

**Deterministic scan (5 findings)**:
- 3x gray-on-color: text-slate-500 sur bg-indigo-600/emerald-600/rose-600 (lignes 562, 566, 570)
- 2x ai-color-palette: indigo-400/indigo-500 sur heading
- 1x overused-font: Inter
- 1x single-font: tout Inter, pas de hiérarchie typographique par famille
- 1x flat-type-hierarchy: sizes trop proches dans AppLayout

## Overall Impression

Architecture générale sensée mais ordre de priorité inversé: les urgences arrivent sous le statique. Un chauffeur avec une mission en retard doit scroller pour voir l'alerte rouge. Problème opérationnel réel.

## Ce Qui Fonctionne

1. Le dock "Prochaines Missions" est une excellente idée — 3 missions toujours visibles, horizontal scroll compact.
2. Les alertes conditionnelles (retard rouge, en cours vert) sont bien conçues — sémantique couleur, pulse animation, action directe.
3. La StripeConnectionCard avec KPIs inline (Balance / Missions / Note) est propre — 3 métriques, pas dix.

## Priority Issues

**[P1] L'ordre de priorité est inversé — urgences arrivent après le statique**
- Ce qui compte: La home doit être un command center opérationnel. Mission en retard doit être première.
- Fix: Réordonner: 1. Mission en cours, 2. Alerte retard, 3. Actions Requises, 4. KPI Stripe, 5. Prochaines missions en contenu.
- Commande: /impeccable layout dashboard.astro

**[P2] La carte Véhicule n'a pas sa place sur la Home en mobile-first**
- Ce qui compte: Le véhicule ne change pas au quotidien. Chaque pixel compte sur mobile avec 160px+ de chrome fixe.
- Fix: Supprimer la carte de Home. Un indicateur ultra-compact dans la StripeCard si nécessaire. Gestion complète dans Entreprise.
- Commande: /impeccable distill dashboard.astro

**[P2] Double-chrome mobile: Header + Dock + Nav = 160px+ perdus**
- Ce qui compte: ~37% de l'écran en chrome sur iPhone SE. Fenêtre de contenu très étroite.
- Fix: Évaluer la fusion dock + nav. Option: "peek" mini (40px) au-dessus de la nav avec la prochaine mission.
- Commande: /impeccable layout AppLayout.astro + dashboard.astro

**[P2] text-slate-500 sur boutons colorés dans le cockpit terrain (lignes 562, 566, 570)**
- Ce qui compte: Contraste insuffisant en plein soleil (contexte d'usage principal).
- Fix: Remplacer text-slate-500 par text-white/60 sur boutons inactifs colorés.
- Commande: /impeccable audit dashboard.astro

**[P3] alert() natif pour les erreurs réseau dans le cockpit terrain**
- Ce qui compte: Rupture visuelle totale. Sur iOS, le alert() bloque et est anxiogène.
- Fix: Toast inline ou état d'erreur dans le cockpit.
- Commande: /impeccable harden dashboard.astro

## Persona Red Flags

**Casey (Mobile Distracted)**: Tap zone dock floue. État non persisté si appel entrant coupe le flux. Disabled:opacity-30 quasi invisible en extérieur.

**Chauffeur Professionnel Expérimenté**: Ouvre l'app 20 fois/jour, traverse Stripe+Véhicule avant de voir les missions. Information noise permanent.

## Minor Observations

- Label "Home" en anglais alors que les autres onglets sont en français
- grid-cols-1 md:grid-cols-2 avec un seul enfant = code mort prévu pour un second card absent
- text-[10px] en masse (32+ occurrences): trop petit pour usage mobile en mouvement
- bg-brand-dark vs bg-[#050505]: deux tokens potentiellement différents pour la même couleur

## Questions à Considérer

- Si tu retirais la carte véhicule et remontais les alertes en top de page, quelle serait la première chose que le chauffeur voit en ouvrant l'app?
- Le dock "Prochaines Missions" et l'onglet "Courses" se recoupent. Est-ce que le dock justifie 120px de chrome permanent?
- La palette indigo n'est pas mauvaise, mais est-ce qu'elle est distinctement "toi"? Un chauffeur VTC premium, c'est plus cuivre/anthracite que SaaS violet.

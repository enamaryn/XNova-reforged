# Équilibrage et réglages du serveur

Dernière vérification : 10 octobre 2026 (SCOPE-02). Les valeurs ci-dessous sont celles du code ; les réglages du serveur en cours d'exécution sont ceux de la **console d'administration** (onglet Général, `PUT /admin/config`), conservés en base et prioritaires sur le fichier `.env`.

## Profil de vitesse retenu : ×50

Décision du propriétaire (10 octobre 2026) : **×50**, formules, coûts et stocks de départ d'origine. Le profil est défini une seule fois dans `packages/game-config/src/speed-profiles.ts` (`SPEED_PROFILES`) et appliqué par :

- le bouton **« Appliquer le profil de référence ×50 »** de l'onglet Général de l'administration et de l'étape *Réglages* de l'assistant d'installation (remplit le formulaire ; il reste à sauvegarder) ;
- `.env.example` (valeurs initiales d'un nouveau serveur) ;
- le test `first-cycle-progression`, qui lit la même constante.

| Profil | `gameSpeed` / `fleetSpeed` | Autres réglages | Usage |
|---|---:|---|---|
| `classic` | 1 | multiplicateurs 1 | rythme d'origine, très lent (laboratoire ≈ 18 h) |
| `minimum` | 20 | multiplicateurs 1 | plancher accepté (laboratoire ≈ 55 min, estimation) |
| **`reference`** | **50** | multiplicateurs 1 | **profil mesuré et recommandé** |

Jalons mesurés à ×50 (API réelle, joueur sans ajout de ressources, [résultats](audits/first-cycle-progression-2026-10-10.json)) : laboratoire 22 min, première recherche 57 min, hangar 64 min, premier vaisseau 112 min, premier rapport 112 min. Détail : [PROGRESSION.md](PROGRESSION.md).

## Réglages du serveur (`ServerConfigValues`)

| Clé | Rôle | Valeur par défaut du code (si ni base ni `.env`) | Profil ×50 |
|---|---|---:|---:|
| `gameSpeed` | divise les durées (bâtiments, recherches, chantier) **et** multiplie la production, revenu de base compris | 1 (`GAME_SPEED`) | 50 |
| `fleetSpeed` | divise les durées de vol | 1 (`FLEET_SPEED`) | 50 |
| `resourceMultiplier` | multiplie la production (en plus de `gameSpeed`) | 1 | 1 |
| `buildingCostMultiplier` | coûts des bâtiments | 1 | 1 |
| `researchCostMultiplier` | coûts des recherches | 1 | 1 |
| `shipCostMultiplier` | coûts du chantier spatial et des défenses | 1 | 1 |
| `planetSize` | champs d'une planète (50 à 500) | 163 | 163 |
| `maxBuildingLevel`, `maxTechnologyLevel` | plafonds | 100 | 100 |
| `baseMetal`, `baseCrystal`, `baseDeuterium` | revenu de base par heure, sans mine | 20 / 10 / 0 | 20 / 10 / 0 |

> Une valeur modifiée dans l'administration est historisée dans `AdminAuditLog`. Le serveur doit relire sa configuration (le cache expire ou est invalidé à la sauvegarde).

## Formules

- **Coûts bâtiments / recherches** : `coût de base × facteur^niveau × multiplicateur de coût` (`packages/game-config`).
- **Durée d'un bâtiment** (s) : `30 × (métal + cristal) / (75 × (1 + usine de robots) × 2^nanites)`, divisée par `gameSpeed`, arrondie à l'inférieur, minimum 1 s.
- **Durée d'une recherche** (s) : `30 × (métal + cristal) / (200 × (1 + laboratoire))`, divisée par `gameSpeed`.
- **Durée d'une unité au chantier** (vaisseaux et défenses) : `(métal + cristal) / (2 500 × (1 + hangar) × 2^nanites)` **heures** (facteur 3600), divisées par `gameSpeed`, avec un **plancher** `(métal + cristal) / 660` s à ×50 (ramené à la vitesse du serveur : `× 50 / gameSpeed`). Chasseur léger à ×50 : 47,5 s sans technologie, 5 s au plancher ; Étoile de la Mort : au plus bas 3 h 47. La durée d'un lot est `max(1, floor(unité × quantité))` ; l'API renvoie `unitTime` (secondes par unité, sans arrondi) pour que l'interface annonce exactement la durée de la file. Implémentation : `packages/game-config/src/shipyard-time.ts`.
- **Production par heure** : mine `base × niveau × 1,1^niveau` × rendement énergétique × `gameSpeed` × `resourceMultiplier`, plus le revenu de base × mêmes multiplicateurs (`packages/game-engine/src/resources.ts`). Bases des mines : métal 30, cristal 20, deutérium 10.
- **Énergie** : consommation des mines (métal 10, cristal 10, deutérium 20 × `niveau × 1,1^niveau`) contre production solaire (20 × `niveau × 1,1^niveau`) et fusion ; rendement = disponible / consommé, plafonné à 100 %.
- **Stockage** : capacité = **1 000 000 × 1,5^niveau du hangar** par ressource ; la production s'arrête à 110 % de la capacité (`storageOverflow`).
- **Combat** : 6 rounds, débris 30 %, défenses réparées à 70 %, butin jusqu'à 50 % limité à la place restante des vaisseaux survivants.

## Revenu de base et stocks de départ

Départ : 500 métal, 500 cristal, 0 deutérium, tous bâtiments au niveau 0 (`auth.service`). Le deutérium à zéro est le principal frein du premier cycle : laboratoire 200, Technologie Énergie 400, Réacteur à combustion 690, hangar 100.

## Prix des extensions (officiers, commandants de flotte)

Les prix sont des constantes (`OFFICER_COST_DEUTERIUM` = 500 000, `FLEET_COMMANDER_COST_DEUTERIUM` = 250 000 dans `packages/game-config/src/`), **indépendantes de la vitesse du serveur**, comme les coûts des bâtiments : c'est la production qui change d'échelle. Mesure à ×50 avec `node scripts/balance/extensions-prices.mjs 50` (rejouer après toute modification) :

| Mine de deutérium (une planète) | Production/h à ×50 | Un officier | Un commandant |
|---|---:|---:|---:|
| niveau 5 | 4 026 | 5,2 j | 2,6 j |
| niveau 10 | 12 969 | 38,6 h | 19,3 h |
| niveau 15 | 31 329 | 16,0 h | 8,0 h |
| niveau 20 | 67 275 | 7,4 h | 3,7 h |
| niveau 25 | 135 434 | 3,7 h | 1,8 h |

- **Lecture** : à ×50, un officier se paie vers la mine de deutérium 10 à 15, donc **après le premier cycle** (le deutérium est le frein du début) : il reste un objectif de milieu de partie, pas un achat immédiat. À ×1 il faudrait de 8 jours (mine 25) à plusieurs mois, comme le reste du jeu : le profil ×50 reste la référence (voir plus haut).
- **Géologue** (+10 % des mines) : remboursé en 5,4 j avec trois mines niveau 10 sur une planète, 2,2 j au niveau 15, 25 h au niveau 20 ; plus vite avec plusieurs planètes. Les autres officiers n'ont pas de gain chiffrable en ressources ; leur prix identique est un choix de simplicité.
- **Expérience des commandants** (100 XP + 1 par 1 000 de métal et cristal détruits, `1000 × 1,5^(niveau − 1)` XP par palier) : niveau 5 ≈ 8 100 XP, niveau 10 ≈ 75 000 XP (8 combats détruisant 10 M), niveau 15 ≈ 580 000 XP, niveau 20 ≈ 4,4 M XP (439 combats de ce type). Les niveaux 15 et 20 sont volontairement des objectifs de très long terme ; si l'on veut les rapprocher, baisser le facteur 1,5 de `experienceToLevel` ou relever le plafond de 20 000 XP par combat.
- **Décision (18 octobre 2026)** : prix et rythme conservés tels quels ; aucune donnée de jeu réel ne justifie de les changer. À revoir avec les statistiques d'embauche (`Officer`, `FleetCommander`) après quelques semaines d'alpha.

## Vérifier un changement

1. Modifier les valeurs dans l'administration (ou appliquer le profil).
2. Rejouer `npm run test:integration --workspace=@xnova/api -- first-cycle` (jalons du premier cycle).
3. Consulter `/statistics` et `/admin/overview` pour la distribution des joueurs.

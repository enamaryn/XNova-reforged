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
- **Durée d'un lot au chantier** (s) : `(métal + cristal) / (2 500 × (1 + hangar) × 2^nanites)`.
- **Production par heure** : mine `base × niveau × 1,1^niveau` × rendement énergétique × `gameSpeed` × `resourceMultiplier`, plus le revenu de base × mêmes multiplicateurs (`packages/game-engine/src/resources.ts`). Bases des mines : métal 30, cristal 20, deutérium 10.
- **Énergie** : consommation des mines (métal 10, cristal 10, deutérium 20 × `niveau × 1,1^niveau`) contre production solaire (20 × `niveau × 1,1^niveau`) et fusion ; rendement = disponible / consommé, plafonné à 100 %.
- **Stockage** : capacité = **1 000 000 × 1,5^niveau du hangar** par ressource ; la production s'arrête à 110 % de la capacité (`storageOverflow`).
- **Combat** : 6 rounds, débris 30 %, défenses réparées à 70 %, butin jusqu'à 50 % limité à la place restante des vaisseaux survivants.

## Revenu de base et stocks de départ

Départ : 500 métal, 500 cristal, 0 deutérium, tous bâtiments au niveau 0 (`auth.service`). Le deutérium à zéro est le principal frein du premier cycle : laboratoire 200, Technologie Énergie 400, Réacteur à combustion 690, hangar 100.

## Vérifier un changement

1. Modifier les valeurs dans l'administration (ou appliquer le profil).
2. Rejouer `npm run test:integration --workspace=@xnova/api -- first-cycle` (jalons du premier cycle).
3. Consulter `/statistics` et `/admin/overview` pour la distribution des joueurs.

# Vérification de la première heure de jeu — 9 octobre 2026

Sept comptes neufs ont chacun parcouru une heure simulée sur le code de `main` après la PR #31 (`0ee283b`), puis avec la correction de finalisation des bâtiments décrite ci-dessous. Aucun accès au serveur du propriétaire, aucune modification de son compte et aucun ajout de ressources dans ces parcours.

## Protocole reproductible

- PostgreSQL réel, migrations versionnées et schéma isolé créé puis supprimé par la suite de tests.
- Inscription HTTP réelle : 500 métal, 500 cristal, 0 deutérium ; tous les bâtiments au niveau 0.
- Vitesse du jeu et multiplicateurs de production/coût à 1. Revenu de base : 20 métal/h, 10 cristal/h, 0 deutérium/h.
- Horloge `Date` avancée par pas de 10 secondes ; réseau, Prisma et délais d’exécution restent réels. Les tâches planifiées automatiques sont arrêtées, leurs services réels sont appelés explicitement : bâtiments/recherches toutes les 10 secondes, ressources chaque minute.
- Achats HTTP selon un ordre fixé, un bâtiment à la fois, dès que les conditions affichées et le stock permettent l’achat. Les durées renvoyées sont comparées aux durées annoncées ; les soldes sont intégrés indépendamment entre les changements de niveau et les dépenses.
- Renouvellement réel des jetons après 55 minutes. À 60 minutes, une recherche sans laboratoire et les achats encore impossibles sont refusés sans débit ni création de file.
- L’heure simulée est celle d’un serveur disponible. Un niveau devient effectif quand le service de finalisation le résout ; le passage toutes les 10 secondes explique un écart de 0 à 9 secondes avec l’heure de fin annoncée.

Les parcours testent des ordres plausibles, sans chercher une stratégie optimale. Ils ne mesurent ni la charge, ni une heure d’utilisation réelle du navigateur, ni les paramètres particuliers du serveur du propriétaire. Les recherches et vaisseaux ne sont pas débloqués dans ces parcours ; leurs résolutions ne sont donc pas validées par cette simulation.

Les [résultats JSON](audits/first-hour-progression-2026-10-09.json) contiennent les stocks non tronqués, revenus, dépenses, niveaux, événements et relevés à 0/15/30/45/60 minutes. Ils ne contiennent ni identité de compte ni jeton.

## Résultats à 60 minutes après correction

Stocks arrondis à deux décimales pour la lecture ; « constructions » compte les niveaux effectivement terminés, pas seulement les types de bâtiments.

| Parcours | Constructions | Métal | Cristal | Deutérium | Niveaux métal / cristal / deutérium / solaire | Prochaine limite |
|---|---:|---:|---:|---:|---|---|
| Sans action, lecture toutes les 10 s | 0 | 520,00 | 510,00 | 0,00 | 0 / 0 / 0 / 0 | Revenu de base conservé |
| Mines et énergie, lecture toutes les 10 s | 5 | 24,06 | 336,86 | 7,56 | 1 / 1 / 1 / 2 | Mine métal 2 : manque 65,94 métal |
| Même ordre, lecture chaque minute | 5 | 23,93 | 336,77 | 7,52 | 1 / 1 / 1 / 2 | Mine métal 2 : manque 66,08 métal |
| Objectif laboratoire après les mines | 5 | 24,06 | 336,86 | 7,56 | 1 / 1 / 1 / 2 | Laboratoire : manque 175,94 métal, 63,14 cristal, 192,44 deutérium |
| Métal seul sans énergie | 3 | 235,00 | 440,00 | 0,00 | 3 / 0 / 0 / 0 | Les mines restent à 0 % ; seul le revenu de base fonctionne |
| Priorité métal, deutérium différé | 7 | 15,48 | 321,80 | 0,00 | 3 / 2 / 0 / 2 | Solaire 3 : manque 152,52 métal |
| Priorité deutérium et énergie | 5 | 30,53 | 333,47 | 10,48 | 1 / 1 / 1 / 2 | Synthétiseur 2 : manque 306,48 métal |

Le scénario orienté métal atteint sept constructions, contre cinq pour celui qui développe les trois mines dès le départ. Aucune de ces stratégies n’atteint le laboratoire dans l’heure. Le deutérium démarre à zéro et le laboratoire exige 200 unités : la stratégie orientée deutérium n’en produit que 10,48 dans cette première heure. Il s’agit d’un constat de rythme, sans décision de modification des stocks initiaux, coûts ou multiplicateurs.

### Chronologie du parcours mines et énergie

| Événement | Lancement | Durée annoncée | Finalisation |
|---|---|---:|---|
| Solaire 1 | 00:00 | 42 s | 00:50 |
| Métal 1 | 00:50 | 30 s | 01:20 |
| Cristal 1 | 01:20 | 28 s | 01:50 |
| Deutérium 1 | 01:50 | 120 s | 03:50 |
| Solaire 2 | 32:30 | 62 s | 33:40 |

Après le synthétiseur, les trois mines demandent 44 énergie mais Solaire 1 n’en fournit que 22 : rendement de 50 %. Les revenus sont alors 36,5 métal/h, 21 cristal/h et 5,5 deutérium/h. Solaire 2 fournit 48 énergie, rétablit 100 % et porte les revenus à 53 métal/h, 32 cristal/h et 11 deutérium/h. L’attente entre 03:50 et 32:30 sert à réunir le métal de la centrale ; la construction elle-même dure environ une minute.

La lecture chaque minute achète Solaire 2 à 33:00, donc 30 secondes plus tard. Les petites différences de stocks correspondent à ces 30 secondes de rendement réduit, pas à une perte de fractions due au rafraîchissement.

## Défaut reproduit et correction technique

Avant correction, `completeConstruction` changeait le niveau sans solder la production à l’ancien rendement. Le rafraîchissement suivant appliquait le nouveau rendement depuis `lastUpdate`, donc aussi à une période antérieure à la finalisation. Une nouvelle mine pouvait recevoir des revenus rétroactifs ; un nouveau déficit pouvait réduire des revenus déjà gagnés.

Sur les cinq premiers parcours, trois échouaient à la comparaison avec le bilan indépendant. Dans le parcours à lectures de 10 secondes, l’écart final était de +0,09167 métal, +0,06111 cristal et +0,03056 deutérium. Dans celui à lectures d’une minute, il était de +0,18333 cristal et +0,09167 deutérium. Le faible écart net ne garantit pas que les erreurs intermédiaires se compensent sur d’autres niveaux ou multiplicateurs.

La finalisation verrouille désormais la planète avant la file, solde la production avec les anciens niveaux, puis applique le niveau et publie le nouveau rendement au même instant, dans une transaction. Les finalisations répétées restent sans effet et celles qui concernent une même planète sont sérialisées. Aucun rattrapage des anciens soldes ni changement d’équilibrage n’est appliqué.

Les sept simulations corrigées concordent avec le bilan à moins de 0,000001 ressource. Quatre tests ciblés couvrent mine, centrale, apparition d’un déficit et finalisations simultanées. La suite API complète a également passé avec la première matrice de cinq parcours : 68 tests unitaires et 265 tests d’intégration ; les deux parcours supplémentaires passent dans la matrice finale de 11 tests ciblés.

## Points à suivre

- Choisir le rythme souhaité pour un nouveau joueur : première heure limitée aux mines, ou accès au laboratoire dans cette heure. La mesure ne tranche pas ce choix.
- L’API tronque les stocks `Float`. À un instant exactement entier, `519,9999999999956` peut être affiché comme 519 au lieu de 520. Le solde interne et ses fractions sont conservés ; ce détail d’affichage reste à traiter.
- Compléter ultérieurement le parcours recherche → chantier → flotte → rapport avec des comptes qui atteignent naturellement ces étapes. Les tests de charge restent à exécuter séparément.

## Rejouer

Configurer `DATABASE_URL` vers une base de tests dédiée, puis lancer depuis la racine. Ces deux suites appliquent les migrations dans des schémas temporaires ; ne pas utiliser la base des joueurs.

```bash
NODE_ENV=test REDIS_URL='' EMAIL_VERIFICATION_REQUIRED=false \
XNOVA_FIRST_HOUR_REPORT=/tmp/xnova-first-hour.json \
npm run test:integration --workspace=@xnova/api -- --runInBand \
  first-hour-progression.integration.spec.ts \
  building-production-transition.integration.spec.ts
```

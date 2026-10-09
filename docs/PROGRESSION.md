# Commandant, puissance et production

Le niveau du commandant et la puissance sont calculés depuis les possessions actuelles, sans dépendre des anciens champs `User.points` et `User.rank`. Les comptes existants sont immédiatement pris en compte ; aucune remise à zéro ni migration de données n'est nécessaire. Le classement des joueurs et des alliances utilise désormais la puissance calculée, dans un instantané transactionnel cohérent.

## Affichage et classement

Le bandeau fixe du jeu affiche le **niveau du commandant /100** et la **puissance actuelle** dès l’ouverture de la vue d’ensemble, sur ordinateur et mobile, puis sur les autres pages du jeu. Ces valeurs proviennent de `/progression` et sont actualisées toutes les 10 secondes via le cache partagé avec les écrans de développement. Une valeur indisponible est affichée « — », jamais comme un niveau ou une puissance de zéro.

Le **rang** désigne la position dans le classement des joueurs par puissance (1 = premier), pas le niveau. Les anciens champs `User.rank` et `User.points` ne sont plus présentés dans le menu utilisateur ni dans la fiche de la vue d’ensemble : ils peuvent être à zéro sur un compte pourtant classé. Le rang affiché dans la vue d’ensemble, sa fiche et le menu utilisateur provient de `/statistics`, partagé en cache et actualisé toutes les 60 secondes sur la vue d’ensemble ou lorsque le menu est ouvert. Le compte technique `__abandoned__`, propriétaire des planètes abandonnées, est exclu du classement. Un seul compte joueur a donc le rang **1**, même si son ancien champ `User.rank` vaut zéro. Le rang est aussi un lien vers le classement complet ; en cas d’indisponibilité, « — » remplace le chiffre.

## Développement et niveau

Le développement correspond à l'investissement cumulé théorique dans les niveaux de bâtiments de toutes les planètes et dans les recherches du joueur (comptées une seule fois), divisé par 1 000 et arrondi à l'entier inférieur par catégorie. Les coûts de référence sont ceux de la configuration du jeu, sans multiplicateurs de prix du serveur : changer un tarif ne modifie pas rétroactivement le développement. Pour Graviton, l'exigence énergétique compte comme investissement de référence afin que cette recherche contribue également au développement.

Pour atteindre le niveau N, il faut `10 × (N − 1)³` points de développement. Niveau initial 1, maximum 100. Niveau 50 : 1 176 490 points ; niveau 100 : 9 702 990 points. Ces valeurs sont un premier équilibrage explicite, défini dans `packages/game-config/src/progression.ts`. Le niveau est recalculé sur le développement actuel : une perte de bâtiments/recherches le fait baisser ; reconstruire ne génère pas de points supplémentaires. Vaisseaux, défenses, colonies et stocks ne contribuent jamais au commandant.

## Puissance actuelle

Somme des contributions de bâtiments, recherches, vaisseaux et défenses (coûts de référence divisés par 1 000), plus 1 000 points par colonie au-delà de la première planète. Les lunes ne donnent pas de bonus de colonisation. Les catégories et types d'unités sont pondérés par leurs coûts propres. Les ressources stockées, les cargaisons et les unités non produites ne comptent pas.

Les unités en vol restent comptabilisées tant que la flotte est active ; les historiques de flottes terminées sont exclus. Les pertes militaires et les pertes de colonies réduisent la puissance, sans modifier le commandant à moins que des bâtiments/recherches soient perdus. Une transaction de lecture cohérente évite le double comptage au moment d'un déploiement ou d'un retour de flotte.

## Capacités par planète

| Condition                                     | Bâtiments simultanés | Types en production |
| --------------------------------------------- | -------------------: | ------------------: |
| Sans la recherche correspondante              |                    1 |                   1 |
| Recherche niveau 1 ou supérieur               |                    2 |                   2 |
| Recherche + commandant niveau 50 ou supérieur |                    3 |                   3 |

Gestion des chantiers (125) débloque les bâtiments ; Production parallèle (126) débloque le chantier spatial. Les niveaux suivants de ces recherches n'augmentent pas les capacités. Les défenses partagent les lignes de production avec les vaisseaux. Deux lots d'un même type sont toujours successifs. La quantité d'un lot n'occupe pas de places supplémentaires.

Quand la capacité de bâtiments est atteinte, un nouveau lancement est refusé sans débit. Les contrôles sont appliqués sous verrou de la planète, y compris pour deux requêtes concurrentes. Les anciennes constructions au-delà de la limite terminent normalement ; aucune nouvelle place n'est disponible tant que le nombre d'actives n'est pas redescendu sous la limite.

## Commandes de production

Les ressources sont débitées dès la commande. Chaque lot dispose d'une date de début et d'une date de fin, conservées en base. Les commandes en attente sont affectées dans l'ordre de création à la première ligne compatible disponible. Les lots démarrés conservent leur échéance. Le serveur réévalue les places débloquées toutes les 10 secondes, même sans navigateur ouvert ; les lectures de file et les nouvelles commandes actualisent aussi le planning.

Une commande en attente peut être retirée avec confirmation : remboursement de 90 % de chaque ressource réellement payée, arrondi à l'entier inférieur. Les 10 % restants sont perdus. Le coût enregistré est utilisé même après changement des tarifs. Pour les très anciennes entrées qui n'ont pas de coût enregistré, le coût de référence est utilisé en repli et affiché avant confirmation. Une commande déjà démarrée ne peut pas être retirée ; le lot est livré en entier à sa fin.

Retrait, remboursement et recalcul de la file sont atomiques sous le même verrou que les nouvelles commandes et la finalisation. Une seconde demande d'annulation ne rembourse jamais une seconde fois. L'interface distingue « En production » et « En attente » et affiche les dates estimées et le remboursement exact.

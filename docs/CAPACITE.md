# Plan de capacité du serveur

Mise à jour : 3 novembre 2026. Critère V1 **9.3**. Décision du propriétaire : « oui, par défaut » (3 novembre 2026). Les **mesures** sont celles de [LOAD_TEST.md](LOAD_TEST.md) ; tout le reste est une **estimation**, signalée comme telle, à confirmer par les relevés de la semaine de test (tableau en fin de document).

## Machine actuelle

Conteneur LXC 116 « xnova » (Proxmox) : **1 cœur, 4 Gio de mémoire, 512 Mio d'échange, disque racine de 20 Go** (relevé du propriétaire).

Mesures disponibles, faites sur une **autre machine** (4 cœurs, 16 Go, générateur de charge sur la même machine) : 200 joueurs simulés à ×50 pendant 10 minutes, ≈ 75 requêtes par seconde, lectures p95 46 ms, écritures p95 35 ms, aucune erreur, 200 connexions WebSocket tenues, mémoire de l'API au plus 257 Mo, base de 11 Mo après l'essai. **Aucune mesure n'existe encore sur un seul cœur** : c'est la principale inconnue de ce plan.

## Budget estimé par ressource

| Ressource | Besoin estimé (≈ 200 joueurs actifs) | Capacité | Marge | Remarque |
|---|---|---|---|---|
| Mémoire | système 0,2 Go, PostgreSQL 0,3 à 0,6 Go, Redis ≤ 0,05 Go, API ≈ 0,26 Go (mesuré), serveur web 0,2 à 0,4 Go : **1,0 à 1,6 Go** | 4 Go | confortable | Le cache disque de Linux utilise le reste. La compilation de la mise à jour s'exécute services arrêtés (le script d'`update` les arrête avant), donc ne s'ajoute pas. |
| Processeur | non mesuré sur 1 cœur | 1 cœur | **inconnue** | Point faible : le hachage des mots de passe (Argon2, ≈ 120 ms par connexion ou inscription sur la machine de test) occupe le cœur ; 50 connexions simultanées au lancement = plusieurs secondes d'attente. La limitation de débit (10 connexions et 5 inscriptions par minute et par IP) protège un peu. La compilation de la mise à jour sur 1 cœur dure plusieurs minutes de coupure : à chronométrer. |
| Disque | système, Node, dépôt et dépendances ≈ 5 Go (estimé) ; base ≈ quelques dizaines de Mo au début ; sauvegardes quotidiennes compressées, gardées 7 jours | 20 Go | ≈ 14 Go | La croissance de la base dépend des rapports (combat, espionnage, expéditions), des messages et du journal d'audit ; elle n'est **pas mesurée** sur la durée. |
| Réseau | ≈ 75 requêtes par seconde de quelques Ko, plus un événement de ressources par joueur et par minute : de l'ordre de 1 Mbit/s | lien du conteneur | large | Estimation ; la page d'accueil est allégée (Lighthouse mobile ≥ 90). |

## Objectifs par palier

| Palier | Joueurs | Verdict sur la machine actuelle |
|---|---|---|
| Bêta fermée | jusqu'à ≈ 30 comptes, 10 à 15 simultanés | **Suffisant** (estimation, très probable). |
| Ouverture publique modeste | ≈ 50 joueurs simultanés | **À valider** par un essai de charge sur cette machine (voir ci-dessous) avant d'annoncer. |
| Ouverture publique large | 200 joueurs simultanés | **Non validé** sur 1 cœur ; la configuration validée est 4 cœurs, 16 Go. Prévoir l'évolution. |

## Surveillance (déjà disponible)

La console admin, onglet **Supervision**, affiche la mémoire, la charge, le disque (passe à « dégradé » sous 10 % d'espace libre, « critique » sous 3 %), l'état de PostgreSQL, Redis, des tâches planifiées et de la dernière sauvegarde, et les disponibilités sur 90 jours. Règle de lecture :

| Signal | Seuil d'attention | Action |
|---|---|---|
| Mémoire utilisée (hors cache) | > 3 Gio durablement, ou échange > 100 Mio | passer la mémoire à 6 ou 8 Gio |
| Charge processeur | charge moyenne > 1,0 sur 15 minutes, ou latence de lecture p95 > 500 ms | passer à 2 puis 4 cœurs |
| Disque | moins de 30 % libre (6 Go) | nettoyer ou agrandir ; au plus tard avant « dégradé » (10 %) |
| Base de données | croissance supérieure à 1 Go par semaine | examiner les tables les plus grosses (commande ci-dessous), réduire la rétention des rapports |
| Sauvegardes | archive absente depuis plus de 24 heures | corriger avant toute autre chose (critère 5.2) |
| Mise à jour | coupure de plus de 10 minutes | passer à 2 cœurs ou annoncer une fenêtre de maintenance |

## Évolutions, dans l'ordre

1. **2 cœurs, 4 Gio** : première évolution, la moins chère, quand la charge ou les mises à jour deviennent lentes. Proxmox : onglet Ressources du conteneur, « Cœurs » (à chaud en général).
2. **2 à 4 cœurs, 8 Gio** : au-delà de ≈ 100 joueurs simultanés, ou si l'échange est utilisé.
3. **Disque** : `pct resize 116 rootfs +10G` depuis le nœud Proxmox (ou onglet Ressources → Disque racine → Redimensionner), puis vérifier `df -h` dans le conteneur.
4. **4 cœurs, 16 Go** : configuration mesurée dans LOAD_TEST.md pour 200 joueurs simultanés.
5. Au-delà (plusieurs instances de l'API) : non prévu, les compteurs de limitation de débit étant en mémoire par processus (voir le registre du double audit).

## Mesures à faire pendant la semaine de test

À faire par le propriétaire, sur le serveur réel.

1. **Essai de charge sur copie.** Le script crée des comptes : ne jamais le lancer sur la base de production. Suivre [LOAD_TEST.md](LOAD_TEST.md) (limites de débit relevées, base dédiée) avec `PLAYERS=50`, puis `100`, puis `200`, `OUT=docs/audits/load-test-1coeur-AAAA-MM-JJ.json npm run load`, en notant la charge et la mémoire (`top`, `free -m`) pendant le palier. Le verdict est celui des seuils de LOAD_TEST.md.
2. **Durée de la mise à jour** : chronométrer `sudo bash scripts/update.sh` (coupure = de l'arrêt des services à leur redémarrage).
3. **Relevé hebdomadaire** :

   ```bash
   df -h /                                  # espace disque
   free -m                                  # mémoire et échange
   uptime                                   # charge moyenne
   ls -lh backups/ | tail -n 3              # taille des sauvegardes
   sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('<nom_de_la_base>'));"
   sudo -u postgres psql <nom_de_la_base> -c "SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 8;"
   ```

   | Date | Comptes | Simultanés (pic) | Mémoire utilisée | Charge 15 min | Disque libre | Base | Sauvegarde | Remarque |
   |---|---:|---:|---:|---:|---:|---:|---:|---|
   | | | | | | | | | |

4. Reporter les constats dans ce document : un palier n'est « validé » qu'après un essai ou une semaine de relevés conformes aux seuils.

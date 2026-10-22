# Checklist de validation V1

Mise à jour : 19 octobre 2026. Document à cocher par le propriétaire au fil des vérifications. Il distingue trois statuts :

- **Fait (Claude)** : exécuté et rapporté par Claude dans le dépôt ou la CI ; à ne pas confondre avec une validation indépendante.
- **Fait (propriétaire)** : constaté par le propriétaire sur son serveur (capture, journal, mail reçu).
- **À faire** : pas encore démontré.

Deux niveaux de décision sont possibles :

- **V1 bêta fermée** (joueurs invités, données jetables ou sauvegardées) : les critères **B** (bloquants) suffisent.
- **V1 publique** : les critères **B** et **R** (recommandés) doivent être réunis, plus la partie « hors dépôt » (section 9).

Rappel de méthode ([CLAUDE.md](../CLAUDE.md)) : une déclaration de complétion ne clôt pas un constat. Chaque case ci-dessous a une preuve attendue.

---

## 1. Fonctions de base

| # | Critère | Niveau | Preuve attendue | État |
|---|---|---|---|---|
| 1.1 | Compte : inscription, connexion, déconnexion, session révocable, mot de passe | B | tests d'intégration `auth`, `sec03-sessions` ; parcours E2E `auth` | Fait (Claude) |
| 1.2 | Bâtiments, recherches, chantier spatial : coûts, files, annulation avec remboursement exact | B | tests `eco03`, `eco05`, E2E `buildings`, `research`, `shipyard` | Fait (Claude) |
| 1.3 | Production de ressources, énergie, stockage, satellites solaires | B | tests `resources-*`, `solar-satellites`, `progression-production` | Fait (Claude) |
| 1.4 | Flottes : attaque, transport, déploiement, colonisation, espionnage, recyclage, expédition, maintien de position | B | tests `fleet`, `game01` à `game03`, `recycling`, `expeditions`, `hold-position` ; E2E | Fait (Claude) |
| 1.5 | Combat : règles, tir rapide, butin conservé, rapports | B | tests `game03-combat-cargo`, `combat` ; E2E `combat` | Fait (Claude) |
| 1.6 | Galaxie, alliances, messagerie, classements | B | tests `galaxy`, `alliances`, `messages`, `statistics` | Fait (Claude) |
| 1.7 | Console admin : joueurs, rôles, bannissement, réglages, audit | B | tests `admin-*`, `ops03-access-control` ; E2E `admin*` | Fait (Claude) |
| 1.8 | Extensions : missiles, lunes, officiers, commandants, attaques groupées, marché, quêtes, succès, événements du monde | R | tests d'intégration et E2E par fonction | Fait (Claude) ; **jamais jouées par des joueurs réels** |
| 1.9 | Langues fr, en, es, de, it : parité des textes et rendu mobile (390 px, 320 px, PC) | B | `npm run test:i18n` ; `tests/mobile-ui` | Fait (Claude) |
| 1.10 | Parcours d'un nouveau joueur sans aide extérieure (objectifs, aide contextuelle, FAQ) | R | 3 testeurs qui n'ont jamais vu le jeu arrivent à une première flotte en moins d'une heure, sans question | À faire |

## 2. Sécurité et accès

| # | Critère | Niveau | Preuve attendue | État |
|---|---|---|---|---|
| 2.1 | Dépendances de production : 0 alerte haute ou critique | B | job CI « Audit des dépendances de production » vert | Fait (Claude) |
| 2.2 | Autorisations : un joueur n'accède à aucune donnée d'un autre ; WebSocket vérifié | B | tests `ws-planet-subscription`, `ops03-access-control` (refus interjoueur) | Fait (Claude) |
| 2.3 | Limitation des tentatives de connexion et d'inscription | B | test `sec04-hardening` | Fait (Claude) |
| 2.4 | Secrets de production changés (`JWT_SECRET`, `JWT_REFRESH_SECRET`, mots de passe base et Redis) | B | contrôle sur le serveur : aucune valeur de `.env.example` | Fait (propriétaire) le 19 octobre 2026 |
| 2.5 | Site servi en HTTPS, `NEXT_PUBLIC_API_URL` et CORS réglés sur l'adresse publique | B | navigateur : cadenas, aucune erreur CORS en console | Fait (propriétaire) le 19 octobre 2026 |
| 2.6 | Revue de sécurité indépendante des fonctions ajoutées depuis le 12 octobre (missiles, lunes, officiers, commandants, attaques groupées, marché, quêtes, événements) : doubles dépenses, concurrence, droits | R | rapport Codex ou équivalent, constats clos | **À faire** |
| 2.7 | Compte de test et comptes d'essai supprimés ou sans rôle admin | B | liste des comptes dans la console admin | À faire (propriétaire) |

## 3. Intégrité de l'économie

| # | Critère | Niveau | Preuve attendue | État |
|---|---|---|---|---|
| 3.1 | Aucune ressource créée ou perdue par accident (concurrence, files, annulations) | B | tests `eco01-polling`, `eco03` à `eco05`, `resources-concurrency` | Fait (Claude) |
| 3.2 | Marché : séquestre, taxe détruite, conservation exacte des stocks | B | tests `market.integration` (14) | Fait (Claude) |
| 3.3 | Événements du monde : production réglée avant chaque changement, pas de bonus sur du temps non réglé | B | tests `world-events.integration` (11) | Fait (Claude) |
| 3.4 | Transfert entre comptes d'un même joueur (marché, comptes alternatifs) : politique décidée (autorisé, surveillé ou interdit dans les règles) | R | règle écrite dans les CGU ou la FAQ | À faire (propriétaire) |

## 4. Qualité et CI

| # | Critère | Niveau | Preuve attendue | État |
|---|---|---|---|---|
| 4.1 | CI verte sur `main` : build, lint, tests unitaires et d'intégration, E2E, migrations, installation web | B | page Actions : dernier run de `main` | Fait (Claude) pour #74 et #75 ; **à relire sur le `main` actuel** |
| 4.2 | Couverture de l'API sous seuil de CI (lignes ≥ 85 %, fonctions ≥ 80 %, branches ≥ 70 %) | B | job « Build, lint et tests » | Fait (Claude) : 92,7 % / 90,1 % / 79,7 % mesurés le 18 octobre |
| 4.3 | Aucun test instable connu en attente | R | 5 exécutions consécutives de la suite d'intégration sans échec | **En cours** : un interblocage réel (annulation de construction contre finalisation) a été trouvé dans la CI de `main` le 13 octobre et corrigé le 19 octobre (test déterministe `build-queue-lock-order`) ; l'échec de la CI de `main` après la fusion de #75 n'a pas pu être attribué à un test précis ; un `ECONNRESET` transitoire a été vu sur un test de concurrence du marché. À reconfirmer par cinq runs verts consécutifs de `main` |
| 4.4 | Dette d'outillage (Jest 30, Tailwind 4, eslint-config-next 16) | R | `ROADMAP_MVP.md` | Fait |

## 5. Exploitation

| # | Critère | Niveau | Preuve attendue | État |
|---|---|---|---|---|
| 5.1 | Déploiement par `sudo bash scripts/update.sh` : migrations appliquées, service redémarré, vérification d'installation | B | sortie du script ; `scripts/verify-install.sh` | Fait (propriétaire) : les tables des quêtes et des événements du monde (`QuestClaim`, `WorldEventSetting`) figurent dans la sauvegarde du 19 octobre, donc les migrations `20261021100000` et `20261022100000` sont appliquées. Reste à confirmer que le correctif d'interblocage (PR #77) est déployé |
| 5.2 | Sauvegarde quotidienne planifiée qui produit une archive valide | B | archive récente ; `scripts/backup-db.sh` ; `docs/OPERATIONS.md` | À faire (propriétaire) : confirmer la planification **sur le serveur de production** |
| 5.3 | **Restauration d'une vraie sauvegarde dans une base, données comparées** | B | `scripts/restore-db.sh <archive>`, puis comparaison des lignes de chaque table avec l'archive | **Fait (propriétaire) le 19 octobre 2026, sur le serveur de test** (archive `xnova_backup_20261019_131154`, restauration en place avec `--yes`, services redémarrés `active`). Comparaison table par table : toutes les tables métier identiques (`User` 2, `Planet` 201, `Fleet` 0, `Message` 0…) ; seuls trois écarts attendus, dus à l'activité après la restauration (`HealthSample` +5, `AdminAuditLog` +5 et `WorldEventSetting` +5 : cases « Automatique » cochées dans l'onglet Événements). **Réserve** : serveur de test (2 comptes, 201 planètes), pas des données de joueurs réels ; à refaire sur la production le jour de l'ouverture |
| 5.4 | Supervision en service : état « Sain », cron attendus actifs, incidents ouverts examinés | B | console admin → Supervision | Fait (propriétaire) pour l'état ; incidents à relire |
| 5.5 | Sauvegardes protégées (accès restreint, chiffrement si elles quittent le serveur) | R | emplacement et droits des archives | À faire (propriétaire) |
| 5.6 | Procédure de retour arrière documentée et essayée (version précédente + base restaurée) | R | essai sur une copie du serveur | À faire |

## 6. Disponibilité et performance

| # | Critère | Niveau | Preuve attendue | État |
|---|---|---|---|---|
| 6.1 | Disponibilité > 99 % sur **7 jours pleins** | B | console admin → Supervision, carte « 7 jours » avec fenêtre pleine | **Fait (propriétaire) le 19 octobre 2026** : **99,84 %** sur 7 jours (16 min d'indisponibilité, 5 pannes), **99,82 %** sur 30 jours (19 min, 6 pannes), 100 % sur 24 h ; mesure depuis le 12 octobre 07:19 (capture du propriétaire) |
| 6.2 | Mesure de charge **sur le serveur du propriétaire** à ×50 | R | rapport du script de charge (`docs/LOAD_TEST.md`), exécuté depuis une autre machine | **À faire** : mesure faite le 10 octobre sur la machine de test, avec 200 joueurs simulés et 0 erreur |
| 6.3 | Scénario de charge élargi : attaque, dépôt, colonisation, marché | R | rapport de charge avec ces actions | **À faire** (absents du scénario actuel) |
| 6.4 | Lighthouse > 90 sur le site déployé (accueil mobile) | R | rapport Lighthouse sur l'adresse publique | À faire : 96 mesuré sur la machine de développement |

## 7. Email

| # | Critère | Niveau | Preuve attendue | État |
|---|---|---|---|---|
| 7.1 | SMTP réel : envoi du message de test depuis la console admin | B | message reçu dans la boîte du propriétaire | Fait (propriétaire) le 19 octobre 2026 |
| 7.2 | Inscription avec confirmation d'adresse : le mail arrive (hors spam) et le lien fonctionne | B | inscription d'un compte réel de bout en bout | Fait (propriétaire) le 19 octobre 2026 |
| 7.3 | Réinitialisation de mot de passe et changement d'adresse par mail | R | parcours réel | À faire |

## 8. Équilibrage et jeu réel

| # | Critère | Niveau | Preuve attendue | État |
|---|---|---|---|---|
| 8.1 | Une semaine de jeu avec 5 à 10 testeurs réels, retours recueillis | R | liste des retours et décisions | **À faire** |
| 8.2 | Prix et récompenses (officiers, commandants, quêtes, marché, événements) confrontés aux statistiques réelles | R | statistiques de la semaine de test, `docs/BALANCE.md` mis à jour | À faire (valeurs actuelles posées sur simulation, à ×50) |
| 8.3 | Limites connues acceptées par le propriétaire (voir liste ci-dessous) | B | décision écrite | À faire (propriétaire) |

Limites connues documentées, à accepter ou à corriger avant la V1 :

- **Officiers** : +1 emplacement de file et non +2 ; pas de bonus de champs ni d'expérience.
- **Commandants** : l'attaque (gagnée ou perdue) et la défense réussie en maintien de position donnent de l'expérience (décision du propriétaire du 19 octobre 2026, faite) ; un commandant non assigné n'a aucun bonus ; les bonus de compétence ne s'appliquent pas en défense.
- **Attaques groupées** : pas de coordination en temps réel ; défenseur à technologie unique.
- **Marché** : échange instantané, ressources seulement ; transfert entre comptes possible ; pas de contrats ni de commerce PNJ.
- **Quêtes** : une quête terminée mais non réclamée n'est plus perdue à la remise à zéro : elle reste réclamable 30 jours (journalières) ou 12 semaines (hebdomadaires), puis expire (décision du propriétaire du 19 octobre 2026, faite) ; 34 succès, pas d'historique ni de classements ; récompenses en ressources seulement.
- **Événements** : production et taxe du marché seulement ; les quêtes n'en profitent pas encore.
- **Absents** : boss galactiques, invasions, saisons compétitives.

## 9. Hors dépôt (propriétaire)

Ces points ne sont pas visibles depuis le code ; je ne peux ni les vérifier ni les juger.

| # | Critère | Niveau | Preuve attendue | État |
|---|---|---|---|---|
| 9.1 | Conditions d'utilisation et politique de confidentialité publiées, cohérentes avec les données collectées (adresse email, adresse IP, mot de passe haché) | R (public) | pages publiées | À faire (propriétaire) |
| 9.2 | Procédure de suppression de compte et de réponse aux demandes de données personnelles | R (public) | procédure écrite | À faire (propriétaire) |
| 9.3 | Capacité d'hébergement et plan de montée en charge (CPU, mémoire, disque, bande passante) | R (public) | relevés pendant la semaine de test | À faire (propriétaire) |
| 9.4 | Canal de support et de signalement de bugs (adresse, Discord, formulaire) | R | canal annoncé aux joueurs | À faire (propriétaire) |
| 9.5 | Politique de remise à zéro : l'univers sera-t-il réinitialisé avant l'ouverture ? | R | décision annoncée | À faire (propriétaire) |

## 10. Décision

À remplir par le propriétaire.

- [ ] **V1 bêta fermée** validée : tous les critères **B** cochés, limites de la section 8.3 acceptées.
- [ ] **V1 publique** validée : critères **B** et **R** cochés, section 9 traitée.
- Date : ____ ; version taguée : ____ ; commit : ____ .

### Ordre de vérification conseillé

1. Déployer les migrations en attente et le correctif d'interblocage (5.1), puis relever l'état « Sain » (5.4).
2. ~~Email réel~~ et ~~restauration d'une sauvegarde~~ (faits le 19 octobre, sur le serveur de test) ; restent l'acceptation écrite des limites connues (8.3) et les critères recommandés.
3. Lancer la revue indépendante des fonctions récentes (2.6) pendant la semaine d'uptime.
4. Lancer la semaine de test avec des joueurs réels (8.1), en parallèle de la mesure d'uptime (6.1).
5. Mesure de charge sur le serveur (6.2, 6.3) puis Lighthouse sur l'adresse publique (6.4).
6. Remplir la section 10.

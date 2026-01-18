# 🎮 Guide joueur — XNova Reforge

Bienvenue dans la version moderne d’XNova. Ce guide condensé reprend les mécaniques essentielles (resources, buildings, fleets, combat et social) pour te lancer rapidement.

## 🚀 Démarrage rapide
- **Inscription / planète de départ** : tu gagnes automatiquement une planète, quelques minerais (métal/cristal) et un niveau 1 de Mine de Métal + Centrale Solaire. Le module auth gère JWT + refresh, les pages `/login` et `/register` sont prêtes.
- **Interface principale** : l’overview affiche les ressources, la production, l’énergie et les actions rapides (bâtiments, recherches, flottes, galaxie, messages).
- **Objectif early game** : stabiliser les ressources (métal/cristal/déuterium) et éviter le déficit énergétique avant d’ouvrir d’autres bâtiments.

## 🧱 Économie & ressources
- **Production** : chaque mine produit selon une progression exponentielle (factoriels 1.5–1.8, voir `packages/game-config/src/buildings.ts`). Les bonus officiers/research accelerants s’appliquent directement aux formules documentées dans `GAME_FORMULAS.md`.
- **Stockage** : les hangars (métal/cristal) et réservoir Deutérium augmentent les limites selon un facteur 2.0, mais active aussi le module `StorageOverflow` (1.1×).
- **Énergie** : en déficit, les mines ralentissent ; la centrale solaire + centrale fusion couvrent la consommation. Hacker les boosts via la technologie Énergie (factor 10%/niveau + bonus).
- **Multiplicateurs** : `ServerConfigService` pilote `resourceMultiplier`, `buildingCostMultiplier` et `gameSpeed`. Tu peux vérifier/mettre à jour les valeurs via l’interface admin.

## 🏗️ Construction & bâtiments
- **Catégories** : mines (métal/cristal/deutérium), production énergie, stockage, modules spéciaux (usine robots/nanites, labo, terraformeur, silo missiles) et bâtiments lune (phalanx, base lunaire).
- **Formules** : coûts exponentiels (`baseCost × factor^niveau`), temps (basé sur `roboticsFactory`, `naniteFactory`, et `gameSpeed`), champs disponibles (sauf hangars). Un seul bâtiment peut être construit simultanément par planète (build queue).
- **Fichier `buildings.ts`** : contient les définitions, les prérequis et les aides `getBuildingCost`, `checkBuildingRequirements`.
- **Conseil** : avance la recherche (`ResearchLab`) avant d’essayer de débloquer usine nanites / base lunaire afin de réduire durations et respecter les prérequis (niveau 10, 14, etc.).

## 🧠 Technologies et recherches
- **Laboratoire** : plus son niveau est élevé, plus la recherche est rapide et coûte moins cher. `ResearchService` gère la file d’attente, l’application du multiplicateur et les validations.
- **Arbre tech** : espionnage, propulsion, énergie, laser/ion/plasma, graviton, ainsi que des bonus (combat, bouclier). Chaque tech a des prérequis (bâtiments, niveau).
- **Gestion** : une seule recherche à la fois, annulation partielle possible (remboursement complet). Utilise la page `/research` pour consulter les états `available`, `locked`, `in progress`.

## 🚀 Flottes & combats
- **Shipyard** : construit via `ShipyardService`, avec file d’attente, coûts et temps. Chaque vaisseau a vitesse, cargo, puissance (cf. `packages/game-config/src/ships.ts`).
- **Envoi de flottes** : sélection, mission (attaque, transport, espionnage), calcul de durée basé sur vaisseau le plus lent + mult `fleetSpeed`. Consommation de deutérium calculée dynamiquement.
- **Combat engine** : moteur tour par tour (max 6 rounds). Chaque round applique armes/boucliers/armure, génère loot + débris (30% des coûts). Les rapports sont disponibles dans `/reports`.
- **Conseil tactique** : envoyez un recyclage après combat pour ramasser débris (~30% des pertes métalliques + cristallines). Les flottes survivantes retournent automatiquement à la planète d’origine.

## 🌌 Galaxie & colonisation
- **Univers** : 9 galaxies, 499 systèmes par galaxie, 15 positions par système. Le backend génère planètes joueurs + planètes abandonnées / neutres.
- **Colonisation** : utilise un vaisseau colon. Limite de lunes (max 1 par planète). Colonisation exige champs libres et ressources.
- **Phalanx & JumpGate** : bâtiments lune qui détectent flottes et téléportent. Les jumps ont cooldown 1 h et coût en deutérium.

## 👥 Social & alliances
- **Messagerie** : inbox + page `/messages` pour écrire, lire, supprimer. Les messages non lus ressortent en gras.
- **Alliances** : créer/join (role-based), invits, page `/alliance` avec membres, description et invites. Sponsoriser via trésor: taxes 0–20%.
- **Système social** : classements `StatisticsModule`, chat admin, modération, événements in-game.

## ⚙️ Administration & serveur
- **Configuration live** : `ServerConfigModule` gère `gameSpeed`, `buildingCostMultiplier`, `baseMetal/Crystal/Deut`. Les admins peuvent appliquer des audits (`AdminAuditLog`). Tous les changements sont versionnés.
- **Environnement** : `docker-compose.yml` orchestre Postgres 16 + Redis 7 + API + web. Utilise `npm run test:integration` pour valider, en veillant à monter les services via Docker avant.

## 🧾 Aides & références
- **Formules** : `GAME_FORMULAS.md` compile toutes les équations de production, coût, combat, espionnage.
- **Roadmap** : `ROADMAP_MVP.md` décrit les phases terminées/à venir ; `ROADMAP_COMPLET.md` liste les avancées post-MVP (Combat v2, économie, events, etc.).
- **Besoin d’aide ?** Consulte `GETTING_STARTED.md` pour l’installation, `README.md` pour l’architecture monorepo, et `CLAUDE_SESSION.md` pour l’historique des décisions.

Bon jeu ! 🚀

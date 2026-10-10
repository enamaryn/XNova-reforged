# Guide du joueur — XNova Reforged

> Version `v0.2.0` (alpha privée). Ce guide décrit ce que le jeu fait réellement aujourd'hui. Langues disponibles : [Français](GUIDE_JOUEUR.md) · [English](PLAYER_GUIDE_EN.md) · [Español](PLAYER_GUIDE_ES.md) · [Deutsch](PLAYER_GUIDE_DE.md) · [Italiano](PLAYER_GUIDE_IT.md).

## 1. Démarrer

1. **Créez votre compte.** L'adresse email doit être confirmée : cliquez sur le lien reçu par email (valable 24 h, renvoi possible depuis la page de connexion).
2. Vous recevez une **planète de départ** (« Planète Mère ») avec 500 métal, 500 cristal et aucun bâtiment.
3. Suivez le **guide des premiers pas** de la vue d'ensemble : 11 objectifs calculés d'après votre situation réelle, chacun avec un lien vers l'action à faire. Vous pouvez le masquer une fois terminé.
4. Choisissez votre **langue** (français, anglais, espagnol, allemand, italien) avec le sélecteur de l'en-tête ou dans *Options*. Elle suit l'adresse de la page (`/fr/…`, `/de/…`).

## 2. Le rythme du serveur

Les coûts et les formules sont ceux du jeu d'origine ; **la vitesse du serveur** accélère les durées et la production (réglage de l'administrateur). Le profil de référence est **×50** :

| Jalon d'un joueur raisonnable | Durée à ×50 |
|---|---:|
| Laboratoire de recherche terminé | ≈ 22 min |
| Première recherche lancée | ≈ 1 h |
| Hangar terminé | ≈ 1 h 05 |
| Premier vaisseau | ≈ 1 h 50 |

Ces durées sont mesurées sur le serveur avec un joueur qui ne dépense que ce qu'il produit. Sur un serveur à vitesse ×1, tout est environ 50 fois plus lent : planifiez de longues attentes.

## 3. Ressources et énergie

- **Métal** : bâtiments, vaisseaux, défenses. **Cristal** : laboratoire, recherches, vaisseaux. **Deutérium** : carburant des flottes, laboratoire et la plupart des recherches (vous n'en avez pas au départ : le synthétiseur de deutérium est votre priorité).
- **Énergie** : les mines consomment l'énergie des centrales solaires. Si la consommation dépasse la production, **toutes** les mines ralentissent proportionnellement. Gardez la production à 100 %.
- Chaque planète dispose d'un petit revenu de base, indépendant des mines.
- Le **stockage** est limité (capacité de base d'un million par ressource, qui croît avec les hangars) ; au-delà, la production est perdue.

## 4. Construire, rechercher, produire

- **Bâtiments** : le coût est débité au lancement et croît à chaque niveau. Le nombre de constructions simultanées par planète est limité : 1 au départ, 2 avec la recherche *Gestion des chantiers*, 3 avec en plus un commandant de niveau 50.
- **Recherche** : une seule à la fois par joueur, payée au lancement. Elle demande un niveau de laboratoire et parfois d'autres technologies (les prérequis manquants sont affichés). Commencez par *Énergie*.
- **Chantier spatial et défense** : les commandes sont payées tout de suite et construites par lots. Une commande **en attente** peut être retirée : 90 % des ressources payées sont remboursées. Un lot déjà démarré termine normalement. *Production parallèle* ajoute des lignes de production.
- Les prérequis (niveau de hangar, technologies) sont indiqués sur chaque carte.

## 5. Flottes et missions

Page *Flotte* : choisissez des vaisseaux, des coordonnées `[galaxie:système:position]`, une mission et la vitesse. Le carburant (deutérium) est débité au départ.

| Mission | Effet |
|---|---|
| **Transport** | livre la cargaison sur la planète visée, puis la flotte rentre |
| **Déploiement** | installe vaisseaux et cargaison sur **votre** planète de destination, sans retour |
| **Attaque** | combat ; butin possible |
| **Espionnage** | rapport sur la cible (plus de sondes ou une meilleure technologie *Espionnage* = plus de détails) |
| **Colonisation** | fonde une colonie sur une position libre avec un vaisseau de colonisation (21 planètes maximum) |

Une flotte en vol peut être **rappelée** depuis *Mouvements*. Les résultats arrivent dans *Rapports*.

## 6. Combat

- 6 rounds au maximum ; certains vaisseaux ont un **tir rapide** contre d'autres types.
- 30 % du coût des vaisseaux détruits devient des **débris**.
- Chaque **défense** détruite est réparée avec 70 % de chances après le combat.
- **Butin** : jusqu'à 50 % des ressources de la cible, **limité à la place restante dans les vaisseaux survivants** du vainqueur ; le reste n'est pas emporté.
- Conseils : espionnez avant d'attaquer, vérifiez la capacité de cargo, ne laissez pas vos ressources s'accumuler.

## 7. Galaxie

- 9 galaxies × 499 systèmes × 15 positions. La page *Galaxie* s'ouvre sur le système de votre planète active ; votre planète est surlignée.
- Position occupée : espionner, attaquer, transporter. Position libre : coloniser.

## 8. Commandant, puissance, classement

- Votre **niveau de commandant** (1 à 100) dépend uniquement de vos bâtiments et recherches ; votre **puissance** inclut aussi vaisseaux, défenses et colonies. Les stocks ne comptent pas.
- Le **classement** est établi sur la puissance ; votre rang apparaît dans l'en-tête et la vue d'ensemble.

## 9. Social

- **Messages** entre joueurs (par nom d'utilisateur).
- **Alliances** : créez-en une (tag de 2 à 8 caractères) ou rejoignez-en une par invitation ; le fondateur ne peut pas quitter sans dissoudre.

## 10. Compte et sécurité

- Mot de passe : 8 caractères minimum avec une minuscule, une majuscule et un chiffre. Vous pouvez le changer, ainsi que votre adresse email (confirmation par lien), dans *Options*.
- « Mot de passe oublié » envoie un lien valable une heure. Changer ou réinitialiser le mot de passe déconnecte vos autres appareils.
- Trop de tentatives de connexion échouées bloquent temporairement l'accès.

## 11. Limites connues de l'alpha

Pas d'officiers, de marché ni d'événements ; les noms et descriptions du jeu et certains messages d'erreur restent en français quelle que soit la langue choisie ; les emails sont envoyés en français.

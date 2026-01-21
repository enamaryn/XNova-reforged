# Guide du Joueur - XNova Reforged

## Bienvenue

XNova Reforged est un jeu de strategie spatial ou vous developpez un empire interstellaire.
Le but est de faire grandir votre economie, votre technologie et votre flotte.

## Objectifs du jeu

1. Developper votre economie (mines et stockage).
2. Rechercher des technologies pour debloquer de nouvelles options.
3. Construire une flotte pour explorer, attaquer et coloniser.
4. Former des alliances et cooperer.
5. Atteindre le haut du classement.

## Ressources

### Types de ressources

- **Metal**
  - Utilisation: batiments, vaisseaux, defenses.
  - Production: Mine de metal.
  - Stockage: Hangar de metal.

- **Cristal**
  - Utilisation: technologies avancees, vaisseaux.
  - Production: Mine de cristal.
  - Stockage: Hangar de cristal.

- **Deuterium**
  - Utilisation: carburant des flottes, technologies avancees.
  - Production: Syntheseur de deuterium.
  - Stockage: Reservoir de deuterium.

- **Energie**
  - Production: Centrale solaire, reacteur de fusion, satellites.
  - Utilisation: alimentation des mines.

- **Matiere noire**
  - Utilisation: avantages premium (non implemente dans le MVP).

### Gestion de l energie

Si votre energie est negative, la production baisse.

Exemple:
- Production energie: 500
- Consommation energie: 700
- Bilan: -200
- Production effective: 500 / 700 = 71%

Solution: augmenter la production d energie (centrale solaire ou reacteur).

## Batiments

### Batiments de ressources

- **Mine de metal** (priorite debut de partie)
- **Mine de cristal**
- **Syntheseur de deuterium**
- **Centrale solaire**
- **Reacteur de fusion** (energie avancee)

### Batiments de stockage

- **Hangar de metal / cristal**
- **Reservoir de deuterium**

### Batiments de developpement

- **Usine de robots**: reduit le temps de construction.
- **Hangar spatial**: debloque la construction de vaisseaux.
- **Laboratoire**: debloque la recherche.
- **Usine de nanites**: reduction massive des temps (late game).

## Technologies

### Technologies essentielles

- **Energie**: booste le reacteur, prerequis de nombreuses techs.
- **Informatique**: augmente les slots de flotte.
- **Espionnage**: rapports de meilleure qualite.
- **Combustion / Impulsion / Hyperespace**: vitesse des vaisseaux.

### Technologies de combat

- **Militaire**: bonus attaque.
- **Bouclier**: bonus bouclier.
- **Blindage**: bonus coque.

## Vaisseaux

### Transport

- **Petit transporteur**: rapide, faible capacite.
- **Grand transporteur**: lent, grosse capacite.
- **Recycleur**: collecte des debris.

### Combat

- **Chasseur leger**: base early game.
- **Chasseur lourd**: polyvalent mid game.
- **Croiseur**: fort contre chasseurs.
- **Vaisseau de bataille**: puissance brute.
- **Bombardier**: anti defenses.

### Speciaux

- **Sonde**: espionnage.
- **Colonisateur**: fonde une nouvelle colonie.
- **Satellite solaire**: energie facile, mais fragile.

## Combat

- 6 tours max.
- Rapid fire: certains vaisseaux tirent plusieurs fois.
- Explosion: 70% de chance si coque < 30%.
- Debris: 30% des couts detruits deviennent des debris.

Formule simplifiee:
```
Degats = Puissance Arme * (1 - Bouclier / 100)
```

Pillage:
- Maximum 50% des ressources ennemies.
- Limite par la capacite de cargo.

Conseils:
- Toujours espionner avant d attaquer.
- Verifier la capacite cargo.
- Favoriser les vaisseaux avec rapid fire.

## Galaxie

- 5 galaxies x 499 systemes x 15 positions.
- Coordonnees: [G:S:P]

Types de positions:
- Planete occupee: interaction possible.
- Planete inactive: cible facile.
- Position vide: colonisation possible.

Colonisation:
1. Construire un colonisateur.
2. Avoir la techno Astrophysique.
3. Lancer la mission sur une position vide.

## Alliances

- Creer ou rejoindre via invitation.
- Tag 3-8 caracteres.
- Avantages: coordination, protection, classement.

## Statistiques

Types de points:
- Economie
- Recherche
- Militaire
- Militaire detruit
- Militaire perdu

Classement mis a jour regulierement.

## Strategies

### Debut de jeu (J1-J3)
- Monter Mine metal et cristal.
- Centrale solaire stable.
- Lancer les premieres recherches.

### Mid game (S1-S2)
- Mines niveau 15-20.
- Developper propulsion.
- Construire flotte polyvalente.

### Late game (S3+)
- Technologies niveau 20+.
- Flotte lourde et guerres.
- Colonies optimisees.

## Astuces pro

1. Stockage adapte a la nuit.
2. Fleet save avant sommeil.
3. Espionner avec une sonde unique.
4. Recyclage des debris.
5. Lancer recherches longues avant de se deconnecter.

## Aide

- Wiki: https://xnova.wiki (fictif)
- Discord: https://discord.gg/xnova (fictif)
- Forum: https://forum.xnova.com (fictif)

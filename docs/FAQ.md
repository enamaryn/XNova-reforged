# FAQ du jeu — XNova Reforged

> Version `v0.2.0` (alpha privée). Cette FAQ décrit ce que le jeu fait **réellement** aujourd'hui, d'après le code et des essais sur un serveur de test ; quand une fonction affichée dans l'interface ne fait pas ce que son texte annonce, c'est dit clairement (⚠️). Langues : [Français](FAQ.md) · [English](FAQ_EN.md) · [Español](FAQ_ES.md) · [Deutsch](FAQ_DE.md) · [Italiano](FAQ_IT.md). Pour le déroulé d'une partie, voir le [guide du joueur](GUIDE_JOUEUR.md).

**Sommaire** : [1. Bases](#1-bases) · [2. Bâtiments](#2-bâtiments) · [3. Énergie et satellites solaires](#3-énergie-et-satellites-solaires) · [4. Recherches](#4-recherches) · [5. Vaisseaux](#5-vaisseaux) · [6. Flottes et missions](#6-flottes-et-missions) · [7. Combat](#7-combat) · [8. Défense](#8-défense) · [9. Puissance, commandant et classement](#9-puissance-commandant-et-classement) · [10. « Pourquoi je ne peux pas… ? »](#10--pourquoi-je-ne-peux-pas--) · [11. Ce qui n'existe pas encore](#11-ce-qui-nexiste-pas-encore)

---

## 1. Bases

**Quelles sont les trois ressources ?**
Le **métal** (bâtiments, vaisseaux, défenses), le **cristal** (laboratoire, recherches, vaisseaux, électronique) et le **deutérium** (carburant des flottes, laboratoire, la plupart des recherches). Vous démarrez avec 500 métal, 500 cristal et 0 deutérium : le synthétiseur de deutérium est donc une priorité.

**Pourquoi tout va-t-il si vite (ou si lentement) ?**
Les coûts sont ceux du jeu d'origine ; c'est la **vitesse du serveur** qui change les durées et la production. Le profil de référence est **×50** : la production est multipliée par 50 et toutes les durées (bâtiments, recherches, vaisseaux, vols) sont divisées par 50. Sur un serveur à ×1, tout est environ 50 fois plus lent. Les coûts, eux, ne changent pas.

**Combien de temps pour le premier vaisseau à ×50 ?**
Environ 1 h 50 pour un joueur qui ne dépense que ce qu'il produit (laboratoire ≈ 22 min, première recherche ≈ 1 h, hangar ≈ 1 h 05).

**Mes ressources continuent-elles de monter hors connexion ?**
Oui : la production est calculée sur le temps écoulé, que vous soyez connecté ou non. Elle s'arrête quand le stockage est plein.

**Qu'est-ce que le stockage et que se passe-t-il quand il est plein ?**
La capacité de base est de **1 000 000 par ressource** ; chaque niveau de hangar de stockage la multiplie par 1,5 (niveau 1 : 1 500 000 ; niveau 5 : ≈ 7,6 millions). Un stock peut dépasser la capacité de 10 % au plus ; au-delà, **la production est perdue**. Dépensez avant d'être plein.

**Y a-t-il un revenu sans mines ?**
Oui, un petit revenu de base par planète (20 métal et 10 cristal par heure avant multiplication par la vitesse). Il aide au tout début.

**Dans quelle langue est le jeu ?**
Français, anglais, espagnol, allemand, italien (sélecteur de l'en-tête). Limite connue : les **noms et descriptions** des bâtiments, vaisseaux et technologies, ainsi que certains messages d'erreur, restent en français.

---

## 2. Bâtiments

**À quoi sert chaque bâtiment ?**

| Bâtiment | Utilité réelle aujourd'hui |
|---|---|
| **Mine de métal / de cristal** | produisent du métal / du cristal (consomment de l'énergie) |
| **Synthétiseur de deutérium** | produit du deutérium (consomme le plus d'énergie) |
| **Centrale solaire** | fournit de l'énergie aux mines |
| **Centrale à fusion** | fournit plus d'énergie en brûlant du deutérium ; exige synthétiseur niveau 5 et *Technologie Énergie* niveau 3 ; son rendement monte avec la technologie Énergie |
| **Usine de robots** | divise la durée des constructions de bâtiments (durée ÷ (1 + niveau)) |
| **Usine de nanites** | divise encore la durée (÷ 2 par niveau) ; exige robots 10 et *Ordinateur* 10 ; très chère |
| **Hangar** (le chantier spatial) | permet de construire vaisseaux et défenses et accélère leur construction ; son niveau conditionne presque tous les prérequis |
| **Hangar de métal / cristal, réservoir de deutérium** | augmentent la capacité de stockage |
| **Laboratoire de recherche** | permet les recherches et les accélère |
| **Terraformeur** | ajoute 5 cases par niveau et n'occupe aucune case ; exige *Technologie Énergie* 12 |

**Combien coûte un bâtiment et comment le coût évolue-t-il ?**
Le coût du niveau suivant vaut `coût de base × facteur^niveau actuel`. Exemple, la mine de métal (base 60 métal / 15 cristal, facteur 1,5) : niveau 1 → 60 / 15 ; niveau 10 → 2 306 / 576. Le coût est **débité au lancement**.

**Combien de temps dure une construction ?**
`30 × (métal + cristal) / (75 × (1 + robots) × 2^nanites)` secondes, puis divisé par la vitesse du serveur. Les robots et les nanites sont donc l'investissement qui rend tout le reste plus rapide.

**Combien de bâtiments puis-je construire en même temps ?**
Un par planète au départ ; **deux** après la recherche *Gestion des chantiers* ; **trois** avec en plus un commandant de niveau 50.

**Puis-je annuler une construction ?**
Oui, depuis la file : le montant débité est **remboursé exactement**. Il n'existe pas de démolition d'un niveau déjà construit.

**Qu'est-ce que les « cases » d'une planète ?**
Chaque planète de départ a **163 cases**. Chaque niveau construit d'un bâtiment (hors hangars de stockage et terraformeur) en consomme **une** : vous ne pourrez donc pas tout monter au maximum. Choisissez vos niveaux ; le **terraformeur** ajoute 5 cases par niveau.

**Quelle est la différence entre « Hangar » et « chantier spatial » ?**
C'est le même bâtiment (identifiant 21) : le « Hangar » des listes est le chantier où l'on construit vaisseaux et défenses. Ne le confondez pas avec les hangars de **stockage**.

**Le terraformeur sert-il à quelque chose ?**
Oui : chaque niveau ajoute **5 cases** à la planète et le terraformeur **n'occupe aucune case** lui-même (il exige *Technologie Énergie* 12, ce qui le réserve à la fin de partie).

**Comment fonctionnent le maintien de position et le dépôt d'alliance ?**
La mission **Maintien de position** envoie une flotte chez un **membre de votre alliance** (planète ou lune ; boutons « Maintien de position » de la Galaxie) pour 1 à 32 heures. Le carburant de maintien (un dixième de la consommation de la flotte par heure) est payé d'avance. Pendant le maintien la flotte reste en orbite et **défend l'hôte** : en cas d'attaque elle combat avec lui (avec les technologies de l'hôte) et les pertes sont réparties au prorata des vaisseaux. Le **dépôt d'alliance** de l'hôte (bâtiment de planète) rembourse ce carburant à la flotte, dans la limite de 10 000 deutérium par niveau et par heure de maintien et du deutérium dont l'hôte dispose. À la fin, ou si vous rappelez la flotte (page Mouvements), elle rentre.

**Que font la phalange de capteur et la porte de saut ?**
La **phalange** (lune, base lunaire 1) montre les mouvements de flotte qui partent de, ou arrivent vers, une planète d'un autre joueur de la même galaxie, jusqu'à (niveau² − 1) systèmes de la lune ; chaque balayage coûte 5 000 deutérium de la lune. La **porte de saut** (lune, base lunaire 1 et Hyperespace 7) déplace instantanément des vaisseaux d'une de vos lunes à une autre lune équipée d'une porte (pas de ressources, pas de satellites solaires) ; ensuite les deux portes se rechargent 1 h (divisée par la vitesse du serveur). Les deux se trouvent sur la page **Lune**.

**Comment obtenir une lune, et à quoi sert-elle ?**
Un combat contre une *planète* peut laisser une lune aux mêmes coordonnées : la chance est de 1 % par 100 000 unités de débris (métal + cristal) produites, plafonnée à 20 %. La lune appartient au propriétaire de la planète attaquée ; un combat contre une lune n'en crée pas. Elle apparaît dans la Galaxie (🌙) et dans le sélecteur de planète. Une lune **ne produit rien**, pas même le revenu de base : il faut y envoyer des ressources par transport. Elle naît avec 1 case ; la **Base lunaire** (qui ne se construit que sur une lune) ajoute 3 cases par niveau et en occupe une. On y construit aussi la robotique et le chantier spatial, pour y stationner vaisseaux et défenses. Les flottes peuvent partir d'une lune et la viser (case « Cibler la lune » de la page Flotte, boutons 🌙 de la Galaxie) pour transporter, déployer, espionner ou attaquer ; les missiles ne visent que les planètes.

---

## 3. Énergie et satellites solaires

**Comment fonctionne l'énergie ?**
Les mines consomment de l'énergie ; les centrales en produisent. Tant que la production couvre la consommation, les mines tournent à 100 %. Sinon, **toutes les mines ralentissent proportionnellement** (production 50 % de l'énergie nécessaire = 50 % de métal, de cristal et de deutérium). Le niveau de production et le bilan d'énergie sont affichés sur la vue d'ensemble.

**Combien d'énergie produit et consomme chaque bâtiment ?**
Par niveau `n` : centrale solaire `20 × n × 1,1^n` ; centrale à fusion `30 × n × (1,05 + 0,01 × Énergie)^n` ; consommation de la mine de métal et de cristal `10 × n × 1,1^n`, du synthétiseur de deutérium `20 × n × 1,1^n`. Exemples : centrale solaire niveau 10 → 518 ; fusion niveau 10 → 488 (Énergie 0) ou 647 (Énergie 3) ; mine de métal niveau 10 → consomme 260.

**Quelle centrale choisir ?**
La centrale solaire : peu chère, sans prérequis. La **fusion** exige synthétiseur niveau 5 et *Technologie Énergie* 3, **brûle du deutérium** (`10 × n × 1,1^n` par heure, multiplié par la vitesse du serveur) mais produit davantage dès que la technologie Énergie monte : avec *Énergie* 3, une fusion niveau 10 donne 647 d'énergie contre 518 pour une solaire de même niveau, au prix d'environ 259 deutérium par heure ; avec *Énergie* 0 elle ne donne que 488. Elle devient rentable quand vos cases sont comptées et que la technologie Énergie est avancée ; la solaire reste meilleure au début.

**Les satellites solaires donnent-ils de l'énergie ?**
**Oui.** Dès qu'il est construit, un satellite solaire (212 : 2 000 cristal et 500 deutérium, constructible dès le hangar niveau 1) est **directement en orbite de la planète** et lui fournit **50 d'énergie** en permanence, en plus des centrales. L'énergie compte à partir de la livraison : la production du temps déjà écoulé n'est pas modifiée. Exemple : 3 satellites = 150 d'énergie. La valeur est fixe (le jeu n'a pas de température de planète).

**Quand choisir des satellites plutôt qu'une centrale ?**
Un satellite ne consomme **aucune case** et n'a aucun prérequis, mais il coûte plus cher qu'une centrale solaire au début (40 cristal et 10 deutérium par point d'énergie, contre quelques unités de métal et de cristal pour les premiers niveaux de centrale). Les centrales sont donc meilleures au départ ; les satellites deviennent intéressants quand les cases manquent ou quand les niveaux de centrale coûtent plus cher.

**Peut-on envoyer un satellite sur une autre planète ?**
**Non.** Il reste en orbite de la planète où il a été construit : il n'apparaît pas dans la page *Flotte* et le jeu refuse toute mission qui en contient un. Il ne peut pas non plus être déplacé par déploiement.

**Un satellite peut-il être détruit ?**
Oui. S'il est sur une planète attaquée, il combat avec la défense (coque 2 000, bouclier 1, arme 1) et absorbe des tirs ; **un satellite détruit n'est pas reconstruit** (seules les défenses le sont) et l'énergie baisse à partir de ce moment. Protégez-le avec de la défense.

**Que faire si mon énergie est insuffisante ?**
Montez une centrale solaire avant la mine suivante. Si le niveau de production est à 80 %, vos mines produisent 20 % de moins que prévu.

---

## 4. Recherches

**Comment fonctionne la recherche ?**
Une seule recherche à la fois par joueur, payée au lancement, qui exige un niveau de laboratoire et parfois d'autres technologies (affichés sur la carte). Le coût croît à chaque niveau. Une recherche en attente peut être annulée.

**Quelles recherches ont un effet direct ?**

| Recherche | Effet réel aujourd'hui |
|---|---|
| **Technologie Militaire** (109) | +10 % de puissance d'arme **par niveau** pour tous vos vaisseaux et défenses |
| **Technologie Défense** (110) | +10 % de coque par niveau |
| **Technologie Bouclier** (111) | +10 % de bouclier par niveau |
| **Réacteur à Combustion** (115) | +10 % de vitesse par niveau pour petit transporteur, chasseur léger, sonde |
| **Réacteur à Impulsion** (117) | +20 % de vitesse par niveau pour grand transporteur, chasseur lourd, colonisateur, recycleur, bombardier |
| **Propulsion Hyperespace** (118) | +30 % de vitesse par niveau pour croiseur, vaisseau de bataille, destructeur, étoile de la mort, traqueur ; +5 %/niveau de capacité de cargaison pour le butin d'une attaque |
| **Technologie Espionnage** (106) | détermine le détail des rapports d'espionnage (comparée à celle de la cible, voir §5) |
| **Technologie Énergie** (113) | relève le rendement des centrales à fusion (+0,01 sur la base de 1,05 par niveau) |
| **Technologie Ordinateur** (108) | **1 flotte en vol de base, +1 par niveau** (voir §6) |
| **Gestion des chantiers** (125) | 2e construction simultanée de bâtiments |
| **Production parallèle** (126) | lignes de production supplémentaires au chantier |

**Et les autres ?**
Hyperespace (114), Laser (120), Ions (121), Plasma (122) et Graviton (199) sont de purs **prérequis** pour débloquer des bâtiments, vaisseaux et défenses (leurs descriptions l'indiquent : « aucun effet direct »). *Énergie* relève aussi le rendement de la fusion (voir §3). Le **réseau de recherche intergalactique** (123) relie vos laboratoires : une recherche lancée sur une planète compte comme un laboratoire de niveau *local + les N meilleurs laboratoires de vos autres planètes* (N = niveau du réseau ; les lunes ne comptent pas), ce qui raccourcit le temps de recherche (la page Recherche affiche le laboratoire effectif). Il ne change ni les coûts ni les prérequis.

**Quelle est la première recherche conseillée ?**
*Énergie* (prérequis de la fusion et de plusieurs défenses), puis le réacteur à combustion pour des transporteurs plus rapides, puis *Militaire/Défense/Bouclier* selon votre projet de combat.

---

## 5. Vaisseaux

**Où construit-on les vaisseaux et comment ?**
Au **Hangar** (page Chantier spatial). La commande est payée tout de suite et construite par lots ; une commande **en attente** peut être retirée (90 % remboursés), un lot déjà démarré termine normalement. La durée dépend du coût et du niveau de hangar : `(métal + cristal) / (2 500 × (1 + hangar) × 2^nanites)` **heures** pour une unité, divisées par la vitesse du serveur, avec un **plancher** de `(métal + cristal) / 660` secondes à ×50 (5 s pour un chasseur léger, environ 3 h 47 pour une Étoile de la Mort) : hangar et nanites ne descendent jamais en dessous. À ×50, un chasseur léger demande environ 48 s sans technologie, puis 5 s une fois tout développé.

**Quels sont les vaisseaux et à quoi servent-ils ?**

| Vaisseau | Coût (métal / cristal / deutérium) | Cargo | Vitesse de base | Arme / bouclier / coque | Usage |
|---|---|---:|---:|---|---|
| **Petit transporteur** (202) | 2 000 / 2 000 / 0 | 6 000 | 5 000 | 5 / 10 / 4 000 | transport des débuts |
| **Grand transporteur** (203) | 6 000 / 6 000 / 0 | 25 000 | 7 500 | 5 / 25 / 12 000 | gros transports |
| **Chasseur léger** (204) | 2 500 / 800 / 0 | 50 | 12 500 | 60 / 10 / 4 000 | combat de masse bon marché |
| **Chasseur lourd** (205) | 6 000 / 4 000 / 0 | 100 | 10 000 | 150 / 25 / 10 000 | combat polyvalent |
| **Croiseur** (206) | 18 000 / 6 000 / 2 000 | 800 | 15 000 | 400 / 50 / 27 000 | combat rapide |
| **Vaisseau de bataille** (207) | 45 000 / 15 000 / 0 | 1 500 | 10 000 | 1 000 / 200 / 60 000 | cœur de flotte |
| **Vaisseau de colonisation** (208) | 10 000 / 20 000 / 10 000 | 7 500 | 2 500 | 50 / 100 / 30 000 | fonder une colonie (consommé) |
| **Recycleur** (209) | 10 000 / 6 000 / 2 000 | 20 000 | 2 000 | 1 / 10 / 16 000 | voir plus bas |
| **Sonde d'espionnage** (210) | 0 / 1 000 / 0 | 0 | 50 000 | 0 / 0 / 1 000 | espionnage |
| **Bombardier** (211) | 50 000 / 25 000 / 15 000 | 500 | 4 000 | 1 000 / 500 / 75 000 | prévu contre les défenses |
| **Satellite solaire** (212) | 0 / 2 000 / 500 | 0 | 0 | 1 / 1 / 2 000 | énergie, reste en orbite (§3) |
| **Destructeur** (213) | 60 000 / 50 000 / 15 000 | 2 000 | 5 000 | 2 000 / 500 / 110 000 | combat lourd |
| **Traqueur** (215) | 30 000 / 40 000 / 15 000 | 10 000 | 10 000 | 700 / 400 / 70 000 | combat rapide |
| **Étoile de la mort** (214) | 5 000 000 / 4 000 000 / 1 000 000 | 1 000 000 | 100 | 200 000 / 50 000 / 9 000 000 | ultime ; exige hangar 12 et *Graviton* |

Les prérequis (niveau de hangar et technologies) sont affichés sur chaque carte.

**Quel vaisseau choisir pour transporter ?**
Le petit transporteur au début (peu cher, accessible tôt), puis le grand transporteur (4× la capacité pour 3× le prix, plus rapide). Le cargo se calcule en additionnant celui de tous les vaisseaux envoyés.

**Comment espionner ?**
Avec des **sondes d'espionnage** : la mission d'espionnage n'accepte que des sondes. Une sonde coûte 1 000 cristal et vole très vite ; les sondes **rentrent toujours** (elles ne sont pas détruites) et la cible **n'est pas prévenue**. Le détail du rapport dépend d'un score : `score = (votre Espionnage − celui de la cible) + (nombre de sondes − 1)`. Les **ressources** sont toujours visibles ; à partir de **1** s'ajoute la **flotte**, à partir de **3** les **défenses et bâtiments**, à partir de **5** les **technologies**. Exemple : à niveau égal, 6 sondes suffisent pour tout voir.

**À quoi sert le recycleur ?**
Il récolte les **champs de débris**. Après chaque combat, 30 % du métal et du cristal des **vaisseaux** détruits (des deux camps, pas des défenses) restent en orbite aux coordonnées de la cible ; ils s'additionnent d'un combat à l'autre et apparaissent dans la Galaxie (bouton « Recycler »). Envoyez des recycleurs seuls avec la mission **Recyclage** : à l'arrivée, ils collectent jusqu'à 20 000 unités chacun (métal et cristal au prorata), puis rentrent avec la récolte. Sans cargaison embarquée ; le reste du champ demeure disponible.

**Les vaisseaux ont-ils un « tir rapide » ?**
Oui. Quand un vaisseau touche une cible d'un type contre lequel il a un tir rapide de valeur `n`, il **tire de nouveau avec la probabilité (n − 1) / n**, et ainsi de suite : en moyenne `n` tirs contre ce type. Les autres cibles ne donnent aucun tir supplémentaire. Cela vaut aussi pour la flotte stationnée qui défend.

| Vaisseau | Tir rapide contre (valeur) |
|---|---|
| Chasseur léger | Sonde ×5, Lanceur de missiles ×10 |
| Chasseur lourd | Chasseur léger ×3, Sonde ×5, Lanceur de missiles ×10 |
| Croiseur | Chasseur léger ×6, Sonde ×5, Lanceur de missiles ×10, Artillerie laser légère ×10 |
| Bombardier | Lanceur de missiles ×20, Artillerie laser légère ×20, Artillerie laser lourde ×10 |
| Traqueur | Croiseur ×3 |

Les autres vaisseaux (dont l'Étoile de la mort, pour l'instant) n'ont pas de tir rapide.

**Comment colonise-t-on ?**
Mission *Colonisation* avec un vaisseau de colonisation vers une **position libre** : la colonie est fondée et le vaisseau consommé. Maximum **21 planètes** par joueur.

---

## 6. Flottes et missions

**Quelles missions existent ?**
**Transport** (livre la cargaison puis la flotte rentre), **Déploiement** (installe flotte et cargaison sur *votre* autre planète, sans retour), **Attaque**, **Espionnage**, **Colonisation**, **Recyclage** (recycleurs seuls, vers un champ de débris). L'**Expédition** et le **Maintien de position** ont leur propre rubrique ; attaque groupée et destruction sont refusées par le jeu sans rien débiter.

**Comment fonctionnent les expéditions ?**
Il faut la technologie **Expédition** (laboratoire 3, Hyperespace 1, Propulsion hyperespace 5). Envoyez une flotte (cargaison possible) vers la **position 16** de n'importe quel système, depuis la page Flotte ou le lien « Expédition » de la Galaxie. À l'arrivée, une issue est tirée au sort : rien (30 %), ressources trouvées (30 %, une part de la capacité de la flotte), vaisseaux trouvés (9 %), retard du retour (10 %), retour plus rapide (5 %), pirates (15 %, 10 % à 30 % de chaque type de vaisseau perdu) ou trou noir (1 %, flotte et cargaison perdues). Le rapport est dans la page Rapports. Expéditions simultanées : racine entière du niveau de la technologie (niveau 4 : 2).

**Comment sont calculés la durée et le carburant d'un vol ?**
Distance : `√(Δgalaxie² × 20 000 + Δsystème² × 95 + Δposition² × 5)`. Vitesse de la flotte : celle de son **vaisseau le plus lent** (avec les bonus de réacteurs). Durée : `(35 000 / % de vitesse) × √(distance × 10 / vitesse) + 10` secondes, divisée par la vitesse de flotte du serveur. Carburant (deutérium, débité au **départ**) : `Σ nombre × consommation × (distance / 35 000) × (vitesse / 1 000 + 1)²`. Exemple avec 10 petits transporteurs : même système (4 positions) 0 deutérium ; 10 systèmes plus loin 10 ; autre galaxie 14. Le choix d'une vitesse plus basse allonge le vol (de 10 % à 100 %).

**Puis-je envoyer plusieurs flottes en même temps ?**
Dans la limite de vos emplacements : **1 flotte en vol de base, plus 1 par niveau de la technologie *Ordinateur***. Les flottes qui rentrent comptent encore. Le compteur « Flottes en vol : x/y » est affiché sur la page *Flotte*, et le jeu refuse l'envoi suivant quand tous les emplacements sont pris.

**Comment rappeler une flotte ?**
Depuis *Mouvements*, tant qu'elle est en vol aller et pas arrivée : elle fait demi-tour et le retour dure aussi longtemps que le trajet déjà parcouru. Une flotte arrivée ou déjà au retour ne peut plus être rappelée.

**Où voir le résultat ?**
Dans *Rapports* (combat) et *Messages* (espionnage, etc.).

**Que transporte la mission d'attaque ?**
Elle peut aussi emporter de la cargaison, mais le butin n'occupe que la **place libre** restante dans les vaisseaux survivants.

**Comment fonctionne l'attaque groupée ?**
Mission **Attaque groupée**, réservée aux membres d'une **même alliance** (cible : un joueur hors de l'alliance). Le premier envoi **crée un groupe** et fixe l'heure d'arrivée ; les autres membres le **rejoignent** depuis la page Flotte (liste « Groupe » pour les mêmes coordonnées) et arrivent **tous ensemble**. Le groupe **attend la flotte la plus lente** : si votre flotte met plus de temps que prévu, l'arrivée de tout le groupe est repoussée (les flottes déjà parties sont décalées d'autant), à condition que le retard total ne dépasse pas **30 % de la durée prévue à la création** du groupe (sinon « Flotte trop lente »). Un groupe compte **5 flottes au maximum**. À l'arrivée, un **seul combat** réunit toutes les flottes arrivées, chacune avec **ses technologies et son commandant** ; les pertes sont comptées par flotte. Le butin (comme pour une attaque simple, la moitié des stocks au plus) est **partagé au prorata de la place libre de chaque flotte**. Chaque participant reçoit son rapport, avec la liste des participants. Une flotte rappelée quitte le groupe.

---

## 7. Combat

**Comment se déroule un combat ?**
Jusqu'à **6 rounds**. À chaque round, chaque unité de l'attaquant puis chaque unité du défenseur tire sur une unité adverse **choisie au hasard** (et rejoue selon son **tir rapide**, voir §5). Les dégâts retirent d'abord le bouclier puis la coque ; une unité à coque nulle est détruite. À la fin de chaque round, **les boucliers se régénèrent de 70 %** de leur maximum. Le combat s'arrête quand un camp est détruit ou après 6 rounds (égalité).

**Quels bonus de technologie s'appliquent ?**
*Militaire* (+10 % d'arme par niveau), *Défense* (+10 % de coque), *Bouclier* (+10 % de bouclier), appliqués à toutes vos unités, vaisseaux **et** défenses. Les deux camps utilisent leurs propres niveaux.

**Qui défend une planète attaquée ?**
Les **défenses** et la **flotte stationnée** sur la planète combattent ensemble (y compris les satellites solaires, très fragiles).

**Que perd-on et que récupère-t-on ?**
- Les vaisseaux détruits sont perdus.
- Les **défenses** détruites sont reconstruites avec **70 % de chances** chacune après le combat.
- Un « champ de débris » est créé (30 % du coût en métal et cristal des vaisseaux perdus), affiché dans le rapport et dans la Galaxie, et peut être récolté par des recycleurs (§5).
- **Butin** (si l'attaquant gagne) : jusqu'à **50 %** de chaque ressource de la cible, limité à la capacité libre des vaisseaux survivants.

**Comment gagner un combat ?**
Espionnez d'abord pour connaître flotte et défenses, vérifiez que votre cargo suffit pour le butin et envoyez une flotte nettement supérieure (le hasard joue). Le bouclier d'une unité absorbe les tirs jusqu'à épuisement, puis se régénère de 70 % à chaque round : des unités à gros bouclier encaissent donc beaucoup de tirs d'un round à l'autre.

**Puis-je attaquer ma propre planète ?**
Non. Le déploiement exige l'une de **vos** planètes, l'attaque exclut les vôtres.

---

## 8. Défense

**Quelles défenses puis-je construire ?**

| Défense | Coût (métal / cristal / deutérium) | Arme / bouclier / coque | Prérequis principaux |
|---|---|---|---|
| **Lanceur de missiles** (401) | 2 000 / 0 / 0 | 80 / 20 / 200 | hangar 1 |
| **Artillerie laser légère** (402) | 1 500 / 500 / 0 | 100 / 25 / 2 000 | hangar 2, Énergie 2, Laser 3 |
| **Artillerie laser lourde** (403) | 6 000 / 2 000 / 0 | 250 / 100 / 8 000 | hangar 4, Énergie 3, Laser 6 |
| **Canon de Gauss** (404) | 20 000 / 15 000 / 2 000 | 1 100 / 200 / 35 000 | hangar 6, Énergie 6, Militaire 3, Bouclier 1 |
| **Artillerie à ions** (405) | 2 000 / 6 000 / 0 | 150 / 500 / 8 000 | hangar 4, Ions 4 |
| **Canon à plasma** (406) | 50 000 / 50 000 / 30 000 | 3 000 / 300 / 100 000 | hangar 8, Plasma 7 |
| **Petit bouclier** (407) | 10 000 / 10 000 / 0 | 1 / 2 000 / 20 000 | hangar 6, Bouclier 2 |
| **Grand bouclier** (408) | 50 000 / 50 000 / 0 | 1 / 10 000 / 100 000 | hangar 8, Bouclier 6 |

**Missiles.** Le silo de missiles (hangar 1) range 10 missiles par niveau. Le *missile d'interception* (silo 1) abat un missile ennemi à son arrivée ; le *missile interplanétaire* (silo 4, Réacteur à impulsion 1) se lance depuis la page Défense contre une planète de la même galaxie, jusqu'à 5 × niveau d'impulsion − 1 systèmes. Chaque missile qui passe inflige 12 000 dégâts (+10 % par niveau d'Armes) aux défenses de la cible, la défense choisie d'abord, puis lanceur, lasers, Gauss, ions, plasma et boucliers. Les missiles ne touchent ni la flotte ni les ressources, et les dégâts qui ne suffisent pas à détruire une unité sont perdus.

**Les boucliers planétaires sont-ils particuliers ?**
Oui : **un seul exemplaire par planète** de chaque (petit, grand). Ils ont un énorme bouclier et une coque épaisse pour une arme quasi nulle : ils servent à **absorber** des tirs.

**Quelle défense est la plus rentable ?**
Par coût, le lanceur de missiles et les artilleries laser sont les plus efficaces au début ; les boucliers absorbent beaucoup de tirs ; le canon à plasma est la défense la plus puissante mais très chère. Combinez-les : les tirs sont répartis au hasard entre **toutes** les unités, donc des boucliers et des lanceurs bon marché protègent vos défenses coûteuses.

**Les défenses détruites reviennent-elles ?**
Chaque défense détruite est reconstruite avec **70 % de chances** après le combat, sans coût ; les vaisseaux perdus ne reviennent pas.

**Ma défense protège-t-elle mes ressources ?**
Pas directement : si l'attaquant gagne, il peut piller jusqu'à 50 % de votre stock. Une défense forte rend la victoire de l'attaquant difficile ; dépenser vos ressources avant de vous déconnecter est la meilleure protection.

**Mes vaisseaux participent-ils à la défense ?**
Oui, ceux qui sont **stationnés** sur la planète (pas ceux en vol) combattent avec la défense.

**Les technologies améliorent-elles ma défense ?**
Oui : *Défense* (coque), *Bouclier* et *Militaire* (arme) de +10 % par niveau s'appliquent aussi aux défenses.

---

## 9. Puissance, commandant et classement

**Qu'est-ce que la puissance ?**
Un nombre de points qui mesure votre développement : **bâtiments + recherches + vaisseaux + défenses + colonies**. Pour chaque catégorie, on additionne les coûts investis (métal + cristal + deutérium) et on divise par 1 000. Chaque colonie (au-delà de la première planète) vaut 1 000 points. Les **stocks de ressources ne comptent pas**.

**Qu'est-ce que le niveau de commandant ?**
Un niveau de 1 à 100 calculé **uniquement** à partir des points de bâtiments et de recherches (pas des vaisseaux). Le seuil du niveau `n` est `10 × (n − 1)³` : niveau 2 à 10 points, niveau 10 à 7 290, niveau 50 à 1 176 490. Au niveau 50, vous obtenez la 3e construction simultanée (avec *Gestion des chantiers*) et la 3e ligne de production (avec *Production parallèle*).

**Comment fonctionne le classement ?**
Il est établi sur la **puissance** ; votre rang apparaît dans l'en-tête et la vue d'ensemble. Perdre des vaisseaux fait baisser votre puissance ; construire des défenses l'augmente.

**Que font les officiers ?**
Cinq personnages **embauchés une seule fois** (500 000 deutérium, prélevés sur la planète choisie, page Officiers) dont les bonus valent pour tout votre compte : **Intendant** (+10 % d'énergie, +1 place de construction par planète), **Amiral** (+10 % de vitesse des flottes, +2 expéditions simultanées), **Ingénieur** (−10 % de durée de construction), **Géologue** (+10 % de production des mines et de capacité de stockage), **Technocrate** (−10 % de durée de recherche, +2 niveaux d'espionnage). Ne pas confondre avec le *niveau de commandant* ci-dessus, qui mesure votre développement. Les bonus de production ne s'appliquent qu'à partir de l'embauche.

**Que sont les commandants de flotte ?**
Jusqu'à **3 personnages** recrutés (250 000 deutérium, page Commandants) et assignés à **une flotte au moment de l'envoi** (liste « Commandant » de la page Flotte). Tant que la flotte n'est pas terminée, le commandant est en mission. Il gagne de l'**expérience à chaque combat d'attaque** (100 + 1 par 1 000 de métal et cristal détruits chez l'adversaire) ; le niveau suit `1000 × 1,5^(niveau − 1)` XP par palier (niveau 20 maximum) et chaque niveau donne **1 point de compétence** à placer dans *Attaque* (dégâts), *Défense* (bouclier et coque), *Vitesse* ou *Cargaison* : +1 % par niveau de compétence, 10 niveaux au plus. Si **toute la flotte est détruite**, il meurt avec 10 % de chances. Les bonus valent pour les flottes qu'il accompagne (vitesse et capacité dès l'envoi, combat en attaque) ; ils ne s'appliquent pas à une flotte en maintien qui défend un allié. En revanche, le commandant d'une flotte en maintien gagne de l'**expérience quand la défense réussit** (l'attaquant ne l'emporte pas), selon la valeur des vaisseaux que l'attaquant a perdus ; il ne risque pas la mort en défense.

**Comment fonctionne le marché ?**
Page **Marché** : vous proposez une quantité d'une ressource contre une autre (« 1 000 deutérium contre du métal, au taux 3 »). Votre ressource est mise **en séquestre** (retirée de la planète choisie) jusqu'à la vente, au retrait ou à l'**expiration** de l'offre (24 h, le séquestre vous est alors rendu). Un acheteur peut en prendre tout ou une partie (achat minimal que vous fixez) ; il paie dans la ressource demandée et reçoit l'autre **immédiatement** ; vous recevez le paiement sur la planète d'origine de l'offre, **moins 5 % de taxe détruite**. Le taux doit rester entre la **moitié et le double** du taux de référence (valeurs de référence : métal 1, cristal 1,5, deutérium 3). **10 offres actives** au plus par joueur. Vous ne pouvez pas acheter votre propre offre. L'historique donne le dernier taux et le taux moyen récent de chaque paire. Les **doubles comptes sont interdits** (échanger entre deux comptes d'une même personne est une infraction) ; pour déplacer des ressources entre **vos propres planètes**, envoyez une flotte de transport.

**Comment fonctionne le commerce avec le marchand ?**
Page **Commerce** : un marchand PNJ échange vos ressources **tout de suite** et vous vend des **vaisseaux** (livraison immédiate, sans condition de recherche ni de bâtiment). Il garde une **marge** (15 % par défaut) : un aller-retour fait toujours perdre. Ses **taux changent chaque jour** (± 10 % par défaut, identique pour tous les joueurs) et **selon la saison** (hiver, printemps, été, automne : valeur des ressources, marge réduite, remise sur les vaisseaux). La marge est aussi réduite pendant un événement du monde qui baisse la taxe du marché. Les vaisseaux coûtent par défaut **1,5 fois** le prix du chantier spatial, selon le jour et la saison. Chaque joueur a un **plafond quotidien** (valeur équivalent métal, remis à zéro à minuit UTC) pour les échanges et un autre pour les achats de vaisseaux. Tous ces réglages, et la liste des vaisseaux proposés (petit et grand transporteur, chasseur léger, recycleur, sonde par défaut), sont modifiables par les administrateurs.

**Comment fonctionnent les quêtes ?**
Page **Quêtes** : **trois quêtes par jour** et **deux par semaine**, tirées dans un catalogue (les mêmes pour tous les joueurs). Elles se remettent à zéro à **minuit UTC** (le lundi pour la semaine). La progression est calculée d'après votre **activité réelle** depuis le début de la période : constructions et recherches terminées, unités fabriquées au chantier, flottes envoyées, combats d'attaque gagnés, espionnages, expéditions. Une fois la cible atteinte, **Réclamer** crédite la récompense (métal, cristal ou deutérium) sur la **planète sélectionnée**, **une seule fois par période**. La récompense est multipliée par votre **niveau de commandant** (+10 % par niveau, jusqu'à ×6). Ce qui n'est pas réclamé avant la remise à zéro est perdu.

**Que sont les succès ?**
Page **Succès** : 34 paliers répartis en six catégories (progression, construction, combat, exploration, social, économie) : niveau de commandant, nombre de planètes, constructions et recherches terminées, victoires, espionnages, expéditions, lunes, alliance, officiers, échanges au marché… Un succès se débloque dès que le palier est atteint et **reste acquis** même si l'activité qui l'a produit disparaît. Il n'apporte pas de ressources ; la page affiche votre pourcentage de complétion.

**Que sont les événements du monde ?**
Des périodes de bonus temporaires pour **tous** les joueurs, lancées par un administrateur depuis la console (onglet *Événements*). Une bannière en haut des pages du jeu indique l'événement en cours, sa fin et ses effets : **production +X %** (mines et revenu de base, sur toutes les planètes) et/ou **taxe du marché réduite**. Plusieurs événements s'additionnent, dans la limite de **+100 % de production**. Le temps écoulé avant le début ou après la fin d'un événement n'est jamais recalculé avec le bonus : la production de toutes les planètes est réglée avant chaque changement. Rien ne démarre seul, sauf si l'administrateur coche **« Automatique »** sur un modèle saisonnier (fête du printemps, solstice d'été, lune des moissons, nébuleuse sombre, fête de l'hiver) : il est alors lancé au début de sa période, une fois par an. Les boss, invasions et saisons compétitives n'existent pas encore.

---

## 10. « Pourquoi je ne peux pas… ? »

| Message | Cause et solution |
|---|---|
| « Ressources insuffisantes » | Il manque du métal, du cristal ou du deutérium (le carburant s'ajoute à la cargaison de deutérium pour un vol). |
| « Prérequis manquants : … » | Le détail liste les niveaux de bâtiment ou de technologie à atteindre. |
| « Capacité de construction atteinte » | La file de la planète est pleine : attendez ou débloquez *Gestion des chantiers* (2 files). |
| « Nombre maximal de flottes en vol atteint » | Tous vos emplacements de flotte sont pris : attendez le retour d'une flotte ou montez la technologie *Ordinateur* (§6). |
| « Plus de champs disponibles » | La planète n'a plus de cases (163) : consacrez les dernières cases aux bâtiments utiles, ou colonisez. |
| « Aucune planète à cette position » | Attaque ou espionnage ne visent qu'une planète existante ; pour coloniser, la position doit être **libre**. |
| « Une mission d'espionnage n'accepte que des sondes d'espionnage » | Envoyez uniquement des sondes (210). |
| « Capacité de cargaison insuffisante » | Ajoutez des transporteurs ou réduisez la cargaison. |
| « Un bouclier planétaire ne se construit qu'en un seul exemplaire » | Un seul petit et un seul grand bouclier par planète. |
| « La flotte est déjà arrivée » | Le rappel n'est possible qu'en vol aller. |
| « Mission non disponible » | La mission n'existe pas encore (§6). |

---

## 11. Ce qui n'existe pas encore

Boss galactiques, invasions et saisons compétitives. La feuille de route du projet ([ROADMAP_MVP.md](../ROADMAP_MVP.md)) suit ces écarts.

*Cette FAQ a été vérifiée contre le code (`packages/game-config`, `packages/game-engine`, API) et, pour les satellites solaires, par un test automatisé d'intégration (`solar-satellites.integration.spec.ts`).*

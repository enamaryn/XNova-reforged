# Game FAQ — XNova Reforged

> Version `v0.2.0` (private alpha). This FAQ describes what the game **actually** does today, based on the code and tests on a test server; when something shown in the interface does not do what its text says, it is stated plainly (⚠️). Languages: [Français](FAQ.md) · [English](FAQ_EN.md) · [Español](FAQ_ES.md) · [Deutsch](FAQ_DE.md) · [Italiano](FAQ_IT.md). For the flow of a game, see the [player guide](PLAYER_GUIDE_EN.md).
>
> **Names in the game.** Names and descriptions of buildings, ships and technologies are still displayed **in French** whatever language you pick. This FAQ gives the English meaning followed by the name you will see in the game, in *italics*.

**Contents**: [1. Basics](#1-basics) · [2. Buildings](#2-buildings) · [3. Energy and solar satellites](#3-energy-and-solar-satellites) · [4. Research](#4-research) · [5. Ships](#5-ships) · [6. Fleets and missions](#6-fleets-and-missions) · [7. Combat](#7-combat) · [8. Defense](#8-defense) · [9. Power, commander and ranking](#9-power-commander-and-ranking) · [10. "Why can't I…?"](#10-why-cant-i) · [11. What does not exist yet](#11-what-does-not-exist-yet)

---

## 1. Basics

**What are the three resources?**
**Metal** (buildings, ships, defenses), **crystal** (laboratory, research, ships, electronics) and **deuterium** (fleet fuel, laboratory, most research). You start with 500 metal, 500 crystal and 0 deuterium, so the deuterium synthesizer is a priority.

**Why is everything so fast (or so slow)?**
Costs are those of the original game; the **server speed** changes durations and production. The reference profile is **×50**: production is multiplied by 50 and all durations (buildings, research, ships, flights) are divided by 50. On a ×1 server everything is about 50 times slower. Costs never change.

**How long until the first ship at ×50?**
About 1 h 50 min for a player who only spends what they produce (laboratory ≈ 22 min, first research ≈ 1 h, shipyard ≈ 1 h 05).

**Do my resources keep growing while I am offline?**
Yes: production is computed from elapsed time, connected or not. It stops when storage is full.

**What is storage and what happens when it is full?**
The base capacity is **1,000,000 per resource**; each storage level multiplies it by 1.5 (level 1: 1,500,000; level 5: ≈ 7.6 million). A stock may exceed capacity by at most 10 %; beyond that **production is lost**. Spend before you are full.

**Is there income without mines?**
Yes, a small base income per planet (20 metal and 10 crystal per hour before the speed multiplier). It helps at the very start.

**Which languages does the game have?**
French, English, Spanish, German, Italian (header selector). Known limit: the **names and descriptions** of buildings, ships and technologies, and some error messages, stay in French.

---

## 2. Buildings

**What does each building do?**

| Building (name in game) | What it really does today |
|---|---|
| **Metal mine / Crystal mine** (*Mine de Métal / de Cristal*) | produce metal / crystal (they consume energy) |
| **Deuterium synthesizer** (*Synthétiseur de Deutérium*) | produces deuterium (consumes the most energy) |
| **Solar power plant** (*Centrale Électrique Solaire*) | supplies energy to the mines |
| **Fusion power plant** (*Centrale Électrique de Fusion*) | supplies more energy; requires synthesizer level 5 and *Energy technology* level 3 |
| **Robotics factory** (*Usine de Robots*) | divides building construction time (time ÷ (1 + level)) |
| **Nanite factory** (*Usine de Nanites*) | divides it again (÷ 2 per level); requires robotics 10 and *Computer* 10; very expensive |
| **Shipyard** (*Hangar*) | allows building ships and defenses and speeds them up; its level gates almost every requirement |
| **Metal storage / Crystal storage / Deuterium tank** (*Hangar de Métal / de Cristal, Réservoir de Deutérium*) | increase storage capacity |
| **Research lab** (*Laboratoire de Recherche*) | allows research and speeds it up |

**How much does a building cost and how does the cost grow?**
The next level costs `base cost × factor^current level`. Example, the metal mine (base 60 metal / 15 crystal, factor 1.5): level 1 → 60 / 15; level 10 → 2,306 / 576. The cost is **charged at launch**.

**How long does a construction take?**
`30 × (metal + crystal) / (75 × (1 + robotics) × 2^nanites)` seconds, then divided by the server speed. Robotics and nanites are therefore the investment that makes everything else faster.

**How many buildings can I build at once?**
One per planet at the start; **two** after the *Gestion des chantiers* research (construction management); **three** with, in addition, a commander of level 50.

**Can I cancel a construction?**
Yes, from the queue: the amount charged is **refunded exactly**. There is no demolition of an already built level.

**What are a planet's "fields"?**
Each starter planet has **163 fields**. Each built level of a building (except storage buildings) uses **one**, so you cannot max everything. Choose your levels.

**What is the difference between "Hangar" and the "shipyard"?**
They are the same building (id 21): the "Hangar" in the lists is the yard where ships and defenses are built. Do not confuse it with **storage** hangars.

**⚠️ Some buildings can be built but have no effect today.**
The **terraformer** (requires *Energy technology* 12) does not increase the number of fields; the **alliance depot**, the **missile silo** (no missile is available) and the **moon** buildings (moon base, sensor phalanx, jump gate: the game does not create moons) change nothing in the game for now. Do not invest in them.

---

## 3. Energy and solar satellites

**How does energy work?**
Mines consume energy; power plants produce it. As long as production covers consumption, mines run at 100 %. Otherwise **all mines slow down proportionally** (production at 50 % of the needed energy = 50 % of metal, crystal and deuterium). The production level and energy balance are shown on the overview.

**How much energy does each building produce and consume?**
Per level `n`: solar plant `20 × n × 1.1^n`; fusion plant `30 × n × 1.05^n`; metal and crystal mine consumption `10 × n × 1.1^n`, deuterium synthesizer `20 × n × 1.1^n`. Examples: solar plant level 10 → 518; fusion level 10 → 488; metal mine level 10 → consumes 260.

**Which power plant should I choose?**
The solar plant: cheap, no requirements. At equal level the fusion plant produces **less** than a solar plant in the current engine (level 10: 488 versus 518) and has costly requirements: it is not worthwhile today. ⚠️ The fusion plant **does not consume deuterium** (despite its description) and *Energy technology* does not increase its output: it is a requirement, not a bonus.

**⚠️ Do solar satellites give energy?**
**No, not today.** The solar satellite (212: 2,000 crystal and 500 deuterium, buildable from shipyard level 1) exists, can be built and stays stationed on the planet, and its description says "supplies energy for free" — but the production calculation **ignores it**. Checked on a test server: 10 satellites built, energy balance strictly unchanged (79 available before and after). **Do not build them for energy**: you would lose crystal and deuterium. Use power plants. The expected behavior (50 energy per satellite according to the code constants) is a known gap, reported in the project register.

**Can a satellite be attacked or sent on a mission?**
It has no speed: it cannot travel. If stationed on an attacked planet it counts among the defending units (hull 2,000, shield 1, weapon 1): it absorbs shots, that is all.

**What if my energy is insufficient?**
Raise a solar plant before the next mine. If the production level is 80 %, your mines produce 20 % less than planned.

---

## 4. Research

**How does research work?**
One research at a time per player, paid at launch, requiring a laboratory level and sometimes other technologies (shown on the card). The cost grows with each level. A waiting research can be cancelled.

**Which researches have a direct effect?**

| Research (name in game) | Real effect today |
|---|---|
| **Military technology** (*Technologie Militaire*, 109) | +10 % weapon power **per level** for all your ships and defenses |
| **Defense technology** (*Technologie Défense*, 110) | +10 % hull per level |
| **Shield technology** (*Technologie Bouclier*, 111) | +10 % shield per level |
| **Combustion drive** (*Réacteur à Combustion*, 115) | +10 % speed per level for small cargo, light fighter, probe |
| **Impulse drive** (*Réacteur à Impulsion*, 117) | +20 % speed per level for large cargo, heavy fighter, colony ship, recycler, bomber |
| **Hyperspace propulsion** (*Propulsion Hyperespace*, 118) | +30 % speed per level for cruiser, battleship, destroyer, death star, battlecruiser; +5 %/level cargo capacity for attack loot |
| **Espionage technology** (*Technologie Espionnage*, 106) | sets the detail of espionage reports (compared with the target's, see §5) |
| **Construction management** (*Gestion des chantiers*, 125) | 2nd simultaneous building construction |
| **Parallel production** (*Production parallèle*, 126) | extra production lines at the shipyard |

**And the others?**
Energy (113), Computer (108), Hyperspace (114), Laser (120), Ion (121), Plasma (122), Intergalactic research network (123), Expedition (124), Graviton (199) mainly serve as **requirements** to unlock buildings, ships and defenses. ⚠️ Despite their descriptions, *Computer* does not limit the number of fleets (there is no limit), *Laser/Ion/Plasma* do not improve weapons, and *Expedition* has no associated mission. Each card shows its exact requirements.

**Which research first?**
*Energy* (requirement for fusion and several defenses), then the combustion drive for faster transports, then *Military/Defense/Shield* depending on your combat plans.

---

## 5. Ships

**Where and how are ships built?**
At the **shipyard** (Shipyard page). The order is paid immediately and built in batches; a **waiting** order can be removed (90 % refunded), a batch already started finishes normally. Duration depends on cost and shipyard level: `(metal + crystal) / (2,500 × (1 + shipyard) × 2^nanites)` seconds for one unit, then divided by the server speed.

**Which ships exist and what are they for?**

| Ship (name in game) | Cost (metal / crystal / deuterium) | Cargo | Base speed | Weapon / shield / hull | Use |
|---|---|---:|---:|---|---|
| **Small cargo** (*Petit Transporteur*, 202) | 2,000 / 2,000 / 0 | 6,000 | 5,000 | 5 / 10 / 4,000 | early transport |
| **Large cargo** (*Grand Transporteur*, 203) | 6,000 / 6,000 / 0 | 25,000 | 7,500 | 5 / 25 / 12,000 | big transports |
| **Light fighter** (*Chasseur Léger*, 204) | 2,500 / 800 / 0 | 50 | 12,500 | 60 / 10 / 4,000 | cheap mass combat |
| **Heavy fighter** (*Chasseur Lourd*, 205) | 6,000 / 4,000 / 0 | 100 | 10,000 | 150 / 25 / 10,000 | all-round combat |
| **Cruiser** (*Croiseur*, 206) | 18,000 / 6,000 / 2,000 | 800 | 15,000 | 400 / 50 / 27,000 | fast combat |
| **Battleship** (*Vaisseau de Bataille*, 207) | 45,000 / 15,000 / 0 | 1,500 | 10,000 | 1,000 / 200 / 60,000 | fleet core |
| **Colony ship** (*Vaisseau de Colonisation*, 208) | 10,000 / 20,000 / 10,000 | 7,500 | 2,500 | 50 / 100 / 30,000 | found a colony (consumed) |
| **Recycler** (*Recycleur*, 209) | 10,000 / 6,000 / 2,000 | 20,000 | 2,000 | 1 / 10 / 16,000 | ⚠️ see below |
| **Espionage probe** (*Sonde d'Espionnage*, 210) | 0 / 1,000 / 0 | 0 | 50,000 | 0 / 0 / 1,000 | espionage |
| **Bomber** (*Bombardier*, 211) | 50,000 / 25,000 / 15,000 | 500 | 4,000 | 1,000 / 500 / 75,000 | meant against defenses |
| **Solar satellite** (*Satellite Solaire*, 212) | 0 / 2,000 / 500 | 0 | 0 | 1 / 1 / 2,000 | ⚠️ no energy effect (§3) |
| **Destroyer** (*Destructeur*, 213) | 60,000 / 50,000 / 15,000 | 2,000 | 5,000 | 2,000 / 500 / 110,000 | heavy combat |
| **Battlecruiser** (*Traqueur*, 215) | 30,000 / 40,000 / 15,000 | 10,000 | 10,000 | 700 / 400 / 70,000 | fast combat |
| **Death star** (*Étoile de la Mort*, 214) | 5,000,000 / 4,000,000 / 1,000,000 | 1,000,000 | 100 | 200,000 / 50,000 / 9,000,000 | ultimate; requires shipyard 12 and *Graviton* |

Requirements (shipyard level and technologies) are shown on each card.

**Which ship for transport?**
The small cargo early on (cheap, available early), then the large cargo (4× the capacity for 3× the price, faster). Cargo is the sum over all ships sent.

**How do I spy?**
With **espionage probes**: the espionage mission accepts only probes. A probe costs 1,000 crystal and flies very fast; probes **always come back** (they are not destroyed) and the target **is not warned**. The report detail depends on a score: `score = (your Espionage − the target's) + (number of probes − 1)`. **Resources** are always visible; from **1** the **fleet** is added, from **3** the **defenses and buildings**, from **5** the **technologies**. Example: at equal level, 6 probes are enough to see everything.

**⚠️ What is the recycler for?**
Nothing today: combat computes debris (30 % of the metal and crystal of destroyed **ships**) but there is no debris field and no recycling mission. Do not build recyclers for now.

**Do ships have "rapid fire"?**
⚠️ Rapid-fire values exist in the configuration, but the combat engine **does not apply them** yet: every ship fires once per round at a randomly chosen target.

**How do I colonize?**
*Colonization* mission with a colony ship to a **free position**: the colony is founded and the ship consumed. Maximum **21 planets** per player.

---

## 6. Fleets and missions

**Which missions exist?**
**Transport** (delivers cargo, then the fleet returns), **Deploy** (settles fleet and cargo on *your* other planet, no return), **Attack**, **Espionage**, **Colonization**. Recycling, expedition, group attack, hold position and destroy are refused by the game without charging anything.

**How are flight time and fuel computed?**
Distance: `√(Δgalaxy² × 20,000 + Δsystem² × 95 + Δposition² × 5)`. Fleet speed: that of its **slowest ship** (with drive bonuses). Duration: `(35,000 / speed %) × √(distance × 10 / speed) + 10` seconds, divided by the server fleet speed. Fuel (deuterium, charged at **departure**): `Σ count × consumption × (distance / 35,000) × (speed / 1,000 + 1)²`. Example with 10 small cargos: same system (4 positions) 0 deuterium; 10 systems away 10; another galaxy 14. A lower speed lengthens the flight (10 % to 100 %).

**Can I send several fleets at once?**
Yes, with no limit on the number today (the *Computer* technology does not limit it).

**How do I recall a fleet?**
From *Movements*, while it is on its outbound flight and has not arrived: it turns around and the return takes as long as the distance already travelled. A fleet that has arrived or is already returning cannot be recalled.

**Where do I see the result?**
In *Reports*.

**What does an attack mission carry?**
It can also carry cargo, but loot only uses the **free space** left in the surviving ships.

---

## 7. Combat

**How does a fight go?**
Up to **6 rounds**. Each round, every attacker unit and then every defender unit fires once at an enemy unit **chosen at random**. Damage removes shield first, then hull; a unit with no hull is destroyed. At the end of each round, **shields regenerate by 70 %** of their maximum. Combat stops when one side is destroyed or after 6 rounds (draw).

**Which technology bonuses apply?**
*Military* (+10 % weapon per level), *Defense* (+10 % hull), *Shield* (+10 % shield), applied to all your units, ships **and** defenses. Each side uses its own levels.

**Who defends an attacked planet?**
The planet's **defenses** and **stationed fleet** fight together (including solar satellites, which are only targets).

**What is lost and what is recovered?**
- Destroyed ships are lost.
- Destroyed **defenses** are rebuilt with a **70 % chance** each after the fight.
- A "debris field" is computed (30 % of the metal and crystal cost of lost ships) and shown in the report, but cannot be collected (§5).
- **Loot** (if the attacker wins): up to **50 %** of each of the target's resources, limited to the free capacity of the surviving ships.

**How do I win a fight?**
Spy first to learn fleet and defenses, check that your cargo is enough for the loot, and send a clearly superior fleet (chance plays a role). A unit's shield absorbs shots until depleted, then regenerates by 70 % each round, so units with big shields soak many shots from one round to the next.

**Can I attack my own planet?**
No. Deploy requires one of **your** planets, attack excludes yours.

---

## 8. Defense

**Which defenses can I build?**

| Defense (name in game) | Cost (metal / crystal / deuterium) | Weapon / shield / hull | Main requirements |
|---|---|---|---|
| **Rocket launcher** (*Lanceur de Missiles*, 401) | 2,000 / 0 / 0 | 80 / 20 / 200 | shipyard 1 |
| **Light laser** (*Artillerie Laser Légère*, 402) | 1,500 / 500 / 0 | 100 / 25 / 2,000 | shipyard 2, Energy 2, Laser 3 |
| **Heavy laser** (*Artillerie Laser Lourde*, 403) | 6,000 / 2,000 / 0 | 250 / 100 / 8,000 | shipyard 4, Energy 3, Laser 6 |
| **Gauss cannon** (*Canon de Gauss*, 404) | 20,000 / 15,000 / 2,000 | 1,100 / 200 / 35,000 | shipyard 6, Energy 6, Military 3, Shield 1 |
| **Ion cannon** (*Artillerie à Ions*, 405) | 2,000 / 6,000 / 0 | 150 / 500 / 8,000 | shipyard 4, Ion 4 |
| **Plasma cannon** (*Canon à Plasma*, 406) | 50,000 / 50,000 / 30,000 | 3,000 / 300 / 100,000 | shipyard 8, Plasma 7 |
| **Small shield dome** (*Petit Bouclier*, 407) | 10,000 / 10,000 / 0 | 1 / 2,000 / 20,000 | shipyard 6, Shield 2 |
| **Large shield dome** (*Grand Bouclier*, 408) | 50,000 / 50,000 / 0 | 1 / 10,000 / 100,000 | shipyard 8, Shield 6 |

Missiles (interceptor and interplanetary) are **not available**: the missile silo is therefore useless for now.

**Are planetary shields special?**
Yes: **one of each per planet** (small, large). They have a huge shield and thick hull for almost no weapon: they are there to **absorb** shots.

**Which defense is the best value?**
By cost, the rocket launcher and light lasers are the most efficient early on; shield domes soak many shots; the plasma cannon is the most powerful defense but very expensive. Combine them: shots are spread at random across **all** units, so cheap shields and launchers protect your costly defenses.

**Do destroyed defenses come back?**
Each destroyed defense is rebuilt with a **70 % chance** after the fight at no cost; lost ships do not come back.

**Does my defense protect my resources?**
Not directly: if the attacker wins, they can loot up to 50 % of your stock. A strong defense makes the attacker's victory hard; spending your resources before logging off is the best protection.

**Do my ships take part in the defense?**
Yes, those **stationed** on the planet (not those in flight) fight alongside the defense.

**Does technology improve my defense?**
Yes: *Defense* (hull), *Shield* and *Military* (weapon) at +10 % per level also apply to defenses.

---

## 9. Power, commander and ranking

**What is power?**
A number of points measuring your development: **buildings + research + ships + defenses + colonies**. For each category the invested costs (metal + crystal + deuterium) are added and divided by 1,000. Each colony (beyond the first planet) is worth 1,000 points. **Resource stocks do not count.**

**What is the commander level?**
A level from 1 to 100 computed **only** from building and research points (not ships). The threshold for level `n` is `10 × (n − 1)³`: level 2 at 10 points, level 10 at 7,290, level 50 at 1,176,490. At level 50 you get the 3rd simultaneous construction (with *Gestion des chantiers*) and the 3rd production line (with *Production parallèle*).

**How does the ranking work?**
It is based on **power**; your rank appears in the header and the overview. Losing ships lowers your power; building defenses raises it.

---

## 10. "Why can't I…?"

| Message (in French in the game) | Cause and fix |
|---|---|
| "Ressources insuffisantes" | You lack metal, crystal or deuterium (fuel is added to the deuterium cargo for a flight). |
| "Prérequis manquants : …" | The detail lists the building or technology levels to reach. |
| "Capacité de construction atteinte" | The planet's queue is full: wait or unlock *Gestion des chantiers* (2 queues). |
| "Plus de champs disponibles" | The planet has no fields left (163): spend the last fields on useful buildings, or colonize. |
| "Aucune planète à cette position" | Attack and espionage only target an existing planet; to colonize, the position must be **free**. |
| "Une mission d'espionnage n'accepte que des sondes d'espionnage" | Send only probes (210). |
| "Capacité de cargaison insuffisante" | Add cargo ships or reduce the cargo. |
| "Un bouclier planétaire ne se construit qu'en un seul exemplaire" | One small and one large shield dome per planet. |
| "La flotte est déjà arrivée" | Recall is only possible on the outbound flight. |
| "Mission non disponible" | The mission does not exist yet (§6). |

---

## 11. What does not exist yet

Officers, market, events, moons, missiles, recycling and debris fields, expeditions, group attacks, a fleet limit from *Computer*, terraformer effect, rapid fire, solar-satellite energy. The matching items (buildings, ships, technologies) sometimes appear in lists and can be bought **with no effect**: read the ⚠️ above before investing. The project roadmap ([ROADMAP_MVP.md](../ROADMAP_MVP.md)) tracks these gaps.

*This FAQ was checked against the code (`packages/game-config`, `packages/game-engine`, API) and, for solar satellites, by a test on a test server on 11 October 2026.*

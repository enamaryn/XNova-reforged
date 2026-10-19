# Spiel-FAQ — XNova Reforged

> Version `v0.2.0` (private Alpha). Diese FAQ beschreibt, was das Spiel heute **tatsächlich** tut, nach dem Code und Tests auf einem Testserver; wenn etwas, das die Oberfläche anzeigt, nicht das tut, was sein Text sagt, wird das klar benannt (⚠️). Sprachen: [Français](FAQ.md) · [English](FAQ_EN.md) · [Español](FAQ_ES.md) · [Deutsch](FAQ_DE.md) · [Italiano](FAQ_IT.md). Den Ablauf einer Partie finden Sie im [Spielerhandbuch](PLAYER_GUIDE_DE.md).
>
> **Namen im Spiel.** Namen und Beschreibungen von Gebäuden, Schiffen und Technologien werden noch **auf Französisch** angezeigt, unabhängig von der gewählten Sprache. Diese FAQ gibt die deutsche Bedeutung an, gefolgt vom Namen im Spiel in *Kursivschrift*.

**Inhalt**: [1. Grundlagen](#1-grundlagen) · [2. Gebäude](#2-gebäude) · [3. Energie und Solarsatelliten](#3-energie-und-solarsatelliten) · [4. Forschung](#4-forschung) · [5. Schiffe](#5-schiffe) · [6. Flotten und Missionen](#6-flotten-und-missionen) · [7. Kampf](#7-kampf) · [8. Verteidigung](#8-verteidigung) · [9. Macht, Kommandant und Rangliste](#9-macht-kommandant-und-rangliste) · [10. „Warum kann ich nicht …?“](#10-warum-kann-ich-nicht-) · [11. Was es noch nicht gibt](#11-was-es-noch-nicht-gibt)

---

## 1. Grundlagen

**Welche drei Rohstoffe gibt es?**
**Metall** (Gebäude, Schiffe, Verteidigung), **Kristall** (Labor, Forschung, Schiffe, Elektronik) und **Deuterium** (Treibstoff der Flotten, Labor, die meiste Forschung). Sie starten mit 500 Metall, 500 Kristall und 0 Deuterium: Der Deuterium-Synthetisierer hat daher Vorrang.

**Warum geht alles so schnell (oder so langsam)?**
Die Kosten sind die des Originalspiels; die **Servergeschwindigkeit** ändert Dauer und Produktion. Das Referenzprofil ist **×50**: Die Produktion wird mit 50 multipliziert, alle Dauern (Gebäude, Forschung, Schiffe, Flüge) werden durch 50 geteilt. Auf einem ×1-Server ist alles etwa 50-mal langsamer. Die Kosten ändern sich nie.

**Wie lange dauert das erste Schiff bei ×50?**
Etwa 1 h 50 min für einen Spieler, der nur ausgibt, was er produziert (Labor ≈ 22 min, erste Forschung ≈ 1 h, Werft ≈ 1 h 05).

**Wachsen meine Rohstoffe auch offline?**
Ja: Die Produktion wird aus der verstrichenen Zeit berechnet, ob Sie verbunden sind oder nicht. Sie stoppt, wenn das Lager voll ist.

**Was ist die Lagerkapazität und was passiert, wenn sie voll ist?**
Die Grundkapazität beträgt **1 000 000 pro Rohstoff**; jede Lagerstufe multipliziert sie mit 1,5 (Stufe 1: 1 500 000; Stufe 5: ≈ 7,6 Millionen). Ein Bestand darf die Kapazität höchstens um 10 % überschreiten; darüber hinaus **geht die Produktion verloren**. Geben Sie aus, bevor das Lager voll ist.

**Gibt es Einkommen ohne Minen?**
Ja, ein kleines Grundeinkommen pro Planet (20 Metall und 10 Kristall pro Stunde vor der Geschwindigkeitsmultiplikation). Es hilft ganz am Anfang.

**In welchen Sprachen gibt es das Spiel?**
Französisch, Englisch, Spanisch, Deutsch, Italienisch (Auswahl in der Kopfzeile). Bekannte Einschränkung: Die **Namen und Beschreibungen** von Gebäuden, Schiffen und Technologien sowie einige Fehlermeldungen bleiben auf Französisch.

---

## 2. Gebäude

**Wozu dient jedes Gebäude?**

| Gebäude (Name im Spiel) | Tatsächlicher Nutzen heute |
|---|---|
| **Metallmine / Kristallmine** (*Mine de Métal / de Cristal*) | produzieren Metall / Kristall (verbrauchen Energie) |
| **Deuterium-Synthetisierer** (*Synthétiseur de Deutérium*) | produziert Deuterium (verbraucht am meisten Energie) |
| **Solarkraftwerk** (*Centrale Électrique Solaire*) | liefert den Minen Energie |
| **Fusionskraftwerk** (*Centrale Électrique de Fusion*) | liefert mehr Energie und verbrennt dabei Deuterium; erfordert Synthetisierer Stufe 5 und *Energietechnik* Stufe 3; sein Ertrag steigt mit der Energietechnik |
| **Roboterfabrik** (*Usine de Robots*) | teilt die Bauzeit von Gebäuden (Zeit ÷ (1 + Stufe)) |
| **Nanitenfabrik** (*Usine de Nanites*) | teilt sie erneut (÷ 2 pro Stufe); erfordert Roboter 10 und *Computertechnik* 10; sehr teuer |
| **Werft** (*Hangar*) | erlaubt den Bau von Schiffen und Verteidigung und beschleunigt ihn; ihre Stufe bestimmt fast alle Voraussetzungen |
| **Metall-/Kristallspeicher, Deuteriumtank** (*Hangar de Métal / de Cristal, Réservoir de Deutérium*) | erhöhen die Lagerkapazität |
| **Forschungslabor** (*Laboratoire de Recherche*) | erlaubt Forschung und beschleunigt sie |
| **Terraformer** (*Terraformeur*) | fügt 5 Felder pro Stufe hinzu und belegt kein Feld; erfordert *Energietechnik* 12 |

**Was kostet ein Gebäude und wie wächst der Preis?**
Die nächste Stufe kostet `Grundkosten × Faktor^aktuelle Stufe`. Beispiel Metallmine (Basis 60 Metall / 15 Kristall, Faktor 1,5): Stufe 1 → 60 / 15; Stufe 10 → 2 306 / 576. Die Kosten werden **beim Start abgebucht**.

**Wie lange dauert ein Bau?**
`30 × (Metall + Kristall) / (75 × (1 + Roboter) × 2^Naniten)` Sekunden, danach geteilt durch die Servergeschwindigkeit. Roboter und Naniten sind also die Investition, die alles andere beschleunigt.

**Wie viele Gebäude kann ich gleichzeitig bauen?**
Anfangs eines pro Planet; **zwei** nach der Forschung *Gestion des chantiers* (Bauverwaltung); **drei**, wenn zusätzlich ein Kommandant Stufe 50 vorhanden ist.

**Kann ich einen Bau abbrechen?**
Ja, aus der Warteschlange: Der abgebuchte Betrag wird **genau erstattet**. Einen bereits gebauten Stufenabriss gibt es nicht.

**Was sind die „Felder“ eines Planeten?**
Jeder Startplanet hat **163 Felder**. Jede gebaute Stufe eines Gebäudes (außer Lagergebäuden und Terraformer) verbraucht **eines**: Sie können also nicht alles auf das Maximum bringen. Wählen Sie Ihre Stufen; der **Terraformer** fügt 5 Felder pro Stufe hinzu.

**Was ist der Unterschied zwischen „Hangar“ und Werft?**
Es ist dasselbe Gebäude (ID 21): Der „Hangar“ in den Listen ist die Werft, in der Schiffe und Verteidigung gebaut werden. Nicht mit den **Lager**-Hangars verwechseln.

**Ist der Terraformer nützlich?**
Ja: Jede Stufe fügt dem Planeten **5 Felder** hinzu, und der Terraformer **belegt selbst kein Feld** (er erfordert *Energietechnik* 12, was ihn dem Spätspiel vorbehält).

**Wie funktionieren Halten und das Allianzdepot?**
Die Mission **Halten** schickt eine Flotte zu einem **Mitglied deiner Allianz** (Planet oder Mond; Schaltflächen „Halten“ in der Galaxie) für 1 bis 32 Stunden. Der Haltetreibstoff (ein Zehntel des Flottenverbrauchs pro Stunde) wird im Voraus bezahlt. Während des Haltens bleibt die Flotte im Orbit und **verteidigt den Gastgeber**: Bei einem Angriff kämpft sie an seiner Seite (mit den Technologien des Gastgebers), die Verluste werden im Verhältnis der Schiffe aufgeteilt. Das **Allianzdepot** des Gastgebers (Planetengebäude) erstattet der Flotte diesen Treibstoff, bis zu 10 000 Deuterium je Stufe und Haltestunde und dem Deuterium, das der Gastgeber hat. Am Ende, oder wenn du die Flotte zurückrufst (Seite Bewegungen), kehrt sie zurück.

**Was machen Sensorphalanx und Sprungtor?**
Die **Phalanx** (Mond, Mondbasis 1) zeigt die Flottenbewegungen, die von einem Planeten eines anderen Spielers derselben Galaxie ausgehen oder dorthin führen, bis zu (Stufe² − 1) Systeme vom Mond entfernt; jeder Scan kostet 5 000 Deuterium vom Mond. Das **Sprungtor** (Mond, Mondbasis 1 und Hyperraumtechnik 7) verlegt Schiffe sofort von einem deiner Monde zu einem anderen Mond mit Tor (keine Rohstoffe, keine Solarsatelliten); danach laden beide Tore 1 h (geteilt durch die Serverspeed) auf. Beides findest du auf der Seite **Mond**.

**Wie bekomme ich einen Mond, und wozu dient er?**
Ein Kampf gegen einen *Planeten* kann einen Mond an denselben Koordinaten hinterlassen: Die Chance beträgt 1 % je 100 000 erzeugter Trümmer (Metall + Kristall), höchstens 20 %. Der Mond gehört dem Besitzer des angegriffenen Planeten; ein Kampf gegen einen Mond erzeugt keinen weiteren. Er erscheint in der Galaxie (🌙) und in der Planetenauswahl. Ein Mond **produziert nichts**, nicht einmal das Grundeinkommen: Schicke ihm Rohstoffe per Transport. Er startet mit 1 Feld; die **Mondbasis** (nur auf einem Mond baubar) fügt je Stufe 3 Felder hinzu und belegt eines. Dort baust du auch Robotfabrik und Werft, um Schiffe und Verteidigung zu stationieren. Flotten können von einem Mond starten und ihn anvisieren (Kästchen „Den Mond anvisieren“ auf der Flottenseite, 🌙-Schaltflächen in der Galaxie), um zu transportieren, zu stationieren, zu spionieren oder anzugreifen; Raketen zielen nur auf Planeten.

---

## 3. Energie und Solarsatelliten

**Wie funktioniert Energie?**
Minen verbrauchen Energie; Kraftwerke erzeugen sie. Solange die Erzeugung den Verbrauch deckt, laufen die Minen mit 100 %. Sonst **werden alle Minen proportional langsamer** (Erzeugung bei 50 % der nötigen Energie = 50 % Metall, Kristall und Deuterium). Produktionsstufe und Energiebilanz stehen in der Übersicht.

**Wie viel Energie erzeugt und verbraucht jedes Gebäude?**
Pro Stufe `n`: Solarkraftwerk `20 × n × 1,1^n`; Fusionskraftwerk `30 × n × (1,05 + 0,01 × Energie)^n`; Verbrauch der Metall- und Kristallmine `10 × n × 1,1^n`, des Deuterium-Synthetisierers `20 × n × 1,1^n`. Beispiele: Solarkraftwerk Stufe 10 → 518; Fusion Stufe 10 → 488 (Energie 0) oder 647 (Energie 3); Metallmine Stufe 10 → verbraucht 260.

**Welches Kraftwerk soll ich wählen?**
Das Solarkraftwerk: günstig, ohne Voraussetzungen. Das **Fusionskraftwerk** erfordert Synthetisierer Stufe 5 und *Energietechnik* 3 und **verbrennt Deuterium** (`10 × n × 1,1^n` pro Stunde, mal Servergeschwindigkeit), erzeugt aber mehr, je höher die Energietechnik steigt: mit *Energie* 3 liefert ein Fusionskraftwerk Stufe 10 647 Energie gegenüber 518 bei einem Solarkraftwerk gleicher Stufe, zum Preis von etwa 259 Deuterium pro Stunde; mit *Energie* 0 sind es nur 488. Es lohnt sich, wenn Felder knapp sind und die Energietechnik weit ist; das Solarkraftwerk bleibt am Anfang besser.

**Liefern Solarsatelliten Energie?**
**Ja.** Sobald er gebaut ist, befindet sich ein Solarsatellit (212: 2 000 Kristall und 500 Deuterium, ab Werft Stufe 1 baubar) **direkt im Orbit des Planeten** und liefert ihm dauerhaft **50 Energie**, zusätzlich zu den Kraftwerken. Die Energie zählt ab der Lieferung: Die Produktion der bereits verstrichenen Zeit ändert sich nicht. Beispiel: 3 Satelliten = 150 Energie. Der Wert ist fest (das Spiel kennt keine Planetentemperatur).

**Wann Satelliten statt eines Kraftwerks wählen?**
Ein Satellit verbraucht **kein Feld** und hat keine Voraussetzungen, kostet aber anfangs mehr als ein Solarkraftwerk (40 Kristall und 10 Deuterium pro Energiepunkt, gegenüber wenigen Einheiten Metall und Kristall für die ersten Kraftwerksstufen). Kraftwerke sind am Anfang besser; Satelliten lohnen sich, wenn Felder knapp werden oder Kraftwerksstufen teuer werden.

**Kann ein Satellit zu einem anderen Planeten geschickt werden?**
**Nein.** Er bleibt im Orbit des Planeten, auf dem er gebaut wurde: Er erscheint nicht auf der Seite *Flotte*, und das Spiel lehnt jede Mission mit einem Satelliten ab. Auch per Stationieren lässt er sich nicht verlegen.

**Kann ein Satellit zerstört werden?**
Ja. Auf einem angegriffenen Planeten kämpft er zusammen mit der Verteidigung (Hülle 2 000, Schild 1, Waffe 1) und fängt Schüsse ab; **ein zerstörter Satellit wird nicht wieder aufgebaut** (nur Verteidigungen) und die Energie sinkt ab diesem Zeitpunkt. Schützen Sie ihn mit Verteidigung.

**Was tun bei zu wenig Energie?**
Bauen Sie vor der nächsten Mine ein Solarkraftwerk aus. Bei einer Produktionsstufe von 80 % produzieren Ihre Minen 20 % weniger als geplant.

---

## 4. Forschung

**Wie funktioniert Forschung?**
Eine Forschung gleichzeitig pro Spieler, beim Start bezahlt, mit einer Laborstufe und manchmal weiteren Technologien als Voraussetzung (auf der Karte angezeigt). Die Kosten steigen mit jeder Stufe. Eine wartende Forschung kann abgebrochen werden.

**Welche Forschungen haben eine direkte Wirkung?**

| Forschung (Name im Spiel) | Tatsächliche Wirkung heute |
|---|---|
| **Militärtechnik** (*Technologie Militaire*, 109) | +10 % Waffenstärke **pro Stufe** für alle Ihre Schiffe und Verteidigungen |
| **Verteidigungstechnik** (*Technologie Défense*, 110) | +10 % Hülle pro Stufe |
| **Schildtechnik** (*Technologie Bouclier*, 111) | +10 % Schild pro Stufe |
| **Verbrennungstriebwerk** (*Réacteur à Combustion*, 115) | +10 % Geschwindigkeit pro Stufe für kleinen Transporter, leichten Jäger, Sonde |
| **Impulstriebwerk** (*Réacteur à Impulsion*, 117) | +20 % Geschwindigkeit pro Stufe für großen Transporter, schweren Jäger, Kolonieschiff, Recycler, Bomber |
| **Hyperraumantrieb** (*Propulsion Hyperespace*, 118) | +30 % Geschwindigkeit pro Stufe für Kreuzer, Schlachtschiff, Zerstörer, Todesstern, Schlachtkreuzer; +5 %/Stufe Ladekapazität für die Beute eines Angriffs |
| **Spionagetechnik** (*Technologie Espionnage*, 106) | bestimmt den Detailgrad der Spionageberichte (verglichen mit der des Ziels, siehe §5) |
| **Energietechnik** (*Technologie Énergie*, 113) | erhöht den Ertrag der Fusionskraftwerke (+0,01 auf die Basis 1,05 pro Stufe) |
| **Computertechnik** (*Technologie Ordinateur*, 108) | **1 Flotte im Flug als Basis, +1 pro Stufe** (siehe §6) |
| **Bauverwaltung** (*Gestion des chantiers*, 125) | 2. gleichzeitiger Gebäudebau |
| **Parallelproduktion** (*Production parallèle*, 126) | zusätzliche Produktionslinien in der Werft |

**Und die übrigen?**
Hyperraum (114), Laser (120), Ionen (121), Plasma (122) und Graviton (199) sind reine **Voraussetzungen**, um Gebäude, Schiffe und Verteidigungen freizuschalten (ihre Beschreibungen sagen „keine direkte Wirkung“). *Energie* erhöht außerdem den Ertrag der Fusion (siehe §3). Das **Intergalaktische Forschungsnetzwerk** (123) verbindet deine Labore: Eine auf einem Planeten gestartete Forschung zählt wie ein Labor der Stufe *lokal + die N besten Labore deiner anderen Planeten* (N = Netzwerkstufe; Monde zählen nicht), was die Forschungszeit verkürzt (die Forschungsseite zeigt das wirksame Labor). Kosten und Voraussetzungen bleiben unverändert.

**Was zuerst erforschen?**
*Energie* (Voraussetzung für Fusion und mehrere Verteidigungen), dann das Verbrennungstriebwerk für schnellere Transporter, danach *Militär/Verteidigung/Schild* je nach Kampfplan.

---

## 5. Schiffe

**Wo und wie werden Schiffe gebaut?**
In der **Werft** (Seite Werft). Der Auftrag wird sofort bezahlt und in Losen gebaut; ein **wartender** Auftrag kann zurückgezogen werden (90 % erstattet), ein bereits begonnenes Los wird normal beendet. Die Dauer hängt von den Kosten und der Werftstufe ab: `(Metall + Kristall) / (2 500 × (1 + Werft) × 2^Naniten)` **Stunden** pro Einheit, geteilt durch die Servergeschwindigkeit, mit einer **Untergrenze** von `(Metall + Kristall) / 660` Sekunden bei ×50 (5 s für einen leichten Jäger, etwa 3 h 47 für einen Todesstern): Werft und Naniten unterschreiten sie nie. Bei ×50 braucht ein leichter Jäger ohne Technologie etwa 48 s, voll ausgebaut 5 s.

**Welche Schiffe gibt es und wozu dienen sie?**

| Schiff (Name im Spiel) | Kosten (Metall / Kristall / Deuterium) | Fracht | Basisgeschw. | Waffe / Schild / Hülle | Nutzen |
|---|---|---:|---:|---|---|
| **Kleiner Transporter** (*Petit Transporteur*, 202) | 2 000 / 2 000 / 0 | 6 000 | 5 000 | 5 / 10 / 4 000 | Transport am Anfang |
| **Großer Transporter** (*Grand Transporteur*, 203) | 6 000 / 6 000 / 0 | 25 000 | 7 500 | 5 / 25 / 12 000 | große Transporte |
| **Leichter Jäger** (*Chasseur Léger*, 204) | 2 500 / 800 / 0 | 50 | 12 500 | 60 / 10 / 4 000 | billiger Massenkampf |
| **Schwerer Jäger** (*Chasseur Lourd*, 205) | 6 000 / 4 000 / 0 | 100 | 10 000 | 150 / 25 / 10 000 | vielseitiger Kampf |
| **Kreuzer** (*Croiseur*, 206) | 18 000 / 6 000 / 2 000 | 800 | 15 000 | 400 / 50 / 27 000 | schneller Kampf |
| **Schlachtschiff** (*Vaisseau de Bataille*, 207) | 45 000 / 15 000 / 0 | 1 500 | 10 000 | 1 000 / 200 / 60 000 | Kern der Flotte |
| **Kolonieschiff** (*Vaisseau de Colonisation*, 208) | 10 000 / 20 000 / 10 000 | 7 500 | 2 500 | 50 / 100 / 30 000 | Kolonie gründen (wird verbraucht) |
| **Recycler** (*Recycleur*, 209) | 10 000 / 6 000 / 2 000 | 20 000 | 2 000 | 1 / 10 / 16 000 | siehe unten |
| **Spionagesonde** (*Sonde d'Espionnage*, 210) | 0 / 1 000 / 0 | 0 | 50 000 | 0 / 0 / 1 000 | Spionage |
| **Bomber** (*Bombardier*, 211) | 50 000 / 25 000 / 15 000 | 500 | 4 000 | 1 000 / 500 / 75 000 | gegen Verteidigung gedacht |
| **Solarsatellit** (*Satellite Solaire*, 212) | 0 / 2 000 / 500 | 0 | 0 | 1 / 1 / 2 000 | Energie, bleibt im Orbit (§3) |
| **Zerstörer** (*Destructeur*, 213) | 60 000 / 50 000 / 15 000 | 2 000 | 5 000 | 2 000 / 500 / 110 000 | schwerer Kampf |
| **Schlachtkreuzer** (*Traqueur*, 215) | 30 000 / 40 000 / 15 000 | 10 000 | 10 000 | 700 / 400 / 70 000 | schneller Kampf |
| **Todesstern** (*Étoile de la Mort*, 214) | 5 000 000 / 4 000 000 / 1 000 000 | 1 000 000 | 100 | 200 000 / 50 000 / 9 000 000 | ultimativ; erfordert Werft 12 und *Graviton* |

Die Voraussetzungen (Werftstufe und Technologien) stehen auf jeder Karte.

**Welches Schiff für den Transport?**
Anfangs den kleinen Transporter (günstig, früh verfügbar), dann den großen (4× Kapazität für 3× Preis, schneller). Die Fracht ist die Summe aller gesendeten Schiffe.

**Wie spioniere ich?**
Mit **Spionagesonden**: Die Spionagemission akzeptiert nur Sonden. Eine Sonde kostet 1 000 Kristall und fliegt sehr schnell; Sonden **kehren immer zurück** (sie werden nicht zerstört) und das Ziel **wird nicht gewarnt**. Der Berichtsdetail hängt von einem Wert ab: `Wert = (Ihre Spionage − die des Ziels) + (Anzahl Sonden − 1)`. **Rohstoffe** sind immer sichtbar; ab **1** kommt die **Flotte** hinzu, ab **3** **Verteidigung und Gebäude**, ab **5** die **Technologien**. Beispiel: Bei gleicher Stufe genügen 6 Sonden, um alles zu sehen.

**Wozu dient der Recycler?**
Er erntet **Trümmerfelder**. Nach jedem Kampf bleiben 30 % von Metall und Kristall der zerstörten **Schiffe** (beider Seiten, nicht der Verteidigung) an den Zielkoordinaten im Orbit; sie summieren sich von Kampf zu Kampf und erscheinen in der Galaxie (Schaltfläche „Recyceln“). Schicken Sie Recycler allein mit der Mission **Recycling**: Bei Ankunft sammeln sie je bis zu 20 000 Einheiten (Metall und Kristall anteilig) und kehren mit der Ernte zurück. Es kann keine Fracht geladen werden; der Rest bleibt im Feld.

**Haben Schiffe „Schnellfeuer“?**
Ja. Trifft ein Schiff ein Ziel eines Typs, gegen den es Schnellfeuer mit dem Wert `n` hat, **schießt es mit der Wahrscheinlichkeit (n − 1) / n erneut**, und so weiter: im Mittel `n` Schüsse gegen diesen Typ. Andere Ziele geben keine Zusatzschüsse. Das gilt auch für die stationierte Flotte, die verteidigt.

| Schiff | Schnellfeuer gegen (Wert) |
|---|---|
| Leichter Jäger | Sonde ×5, Raketenwerfer ×10 |
| Schwerer Jäger | Leichter Jäger ×3, Sonde ×5, Raketenwerfer ×10 |
| Kreuzer | Leichter Jäger ×6, Sonde ×5, Raketenwerfer ×10, Leichtes Lasergeschütz ×10 |
| Bomber | Raketenwerfer ×20, Leichtes Lasergeschütz ×20, Schweres Lasergeschütz ×10 |
| Schlachtkreuzer | Kreuzer ×3 |

Andere Schiffe (vorerst auch der Todesstern) haben kein Schnellfeuer.

**Wie kolonisiere ich?**
Mission *Kolonisierung* mit einem Kolonieschiff zu einer **freien Position**: Die Kolonie wird gegründet, das Schiff verbraucht. Höchstens **21 Planeten** pro Spieler.

---

## 6. Flotten und Missionen

**Welche Missionen gibt es?**
**Transport** (liefert die Fracht, danach kehrt die Flotte zurück), **Stationieren** (setzt Flotte und Fracht auf *Ihren* anderen Planeten, ohne Rückkehr), **Angriff**, **Spionage**, **Kolonisierung**, **Recycling** (nur Recycler, zu einem Trümmerfeld). Die **Expedition** und das **Halten** haben eigene Einträge; Verbandsangriff und Zerstören lehnt das Spiel ab, ohne etwas abzubuchen.

**Wie funktionieren Expeditionen?**
Du brauchst die Technologie **Expedition** (Labor 3, Hyperraumtechnik 1, Hyperraumantrieb 5). Schicke eine Flotte (mit Fracht möglich) zu **Position 16** eines beliebigen Systems, von der Flottenseite oder über den Link „Expedition“ der Galaxie. Bei der Ankunft wird ein Ergebnis ausgelost: nichts (30 %), Rohstoffe gefunden (30 %, ein Anteil der Flottenkapazität), Schiffe gefunden (9 %), verspäteter Rückflug (10 %), schnellerer Rückflug (5 %), Piraten (15 %, 10 % bis 30 % jedes Schiffstyps verloren) oder Schwarzes Loch (1 %, Flotte und Fracht verloren). Der Bericht steht auf der Berichteseite. Gleichzeitige Expeditionen: ganzzahlige Wurzel der Technologiestufe (Stufe 4: 2).

**Wie werden Flugdauer und Treibstoff berechnet?**
Entfernung: `√(Δgalaxie² × 20 000 + Δsystem² × 95 + Δposition² × 5)`. Flottengeschwindigkeit: die ihres **langsamsten Schiffs** (mit Triebwerksboni). Dauer: `(35 000 / Geschwindigkeits-%) × √(Entfernung × 10 / Geschwindigkeit) + 10` Sekunden, geteilt durch die Flottengeschwindigkeit des Servers. Treibstoff (Deuterium, beim **Start** abgebucht): `Σ Anzahl × Verbrauch × (Entfernung / 35 000) × (Geschwindigkeit / 1 000 + 1)²`. Beispiel mit 10 kleinen Transportern: gleiches System (4 Positionen) 0 Deuterium; 10 Systeme weiter 10; andere Galaxie 14. Eine niedrigere Geschwindigkeit verlängert den Flug (10 % bis 100 %).

**Kann ich mehrere Flotten gleichzeitig schicken?**
Im Rahmen Ihrer Plätze: **1 Flotte im Flug als Basis, plus 1 pro Stufe der Technologie *Computertechnik***. Zurückkehrende Flotten zählen weiter mit. Der Zähler „Flotten im Flug: x/y“ steht auf der Seite *Flotte*, und das Spiel lehnt den nächsten Flug ab, wenn alle Plätze belegt sind.

**Wie rufe ich eine Flotte zurück?**
Über *Bewegungen*, solange sie auf dem Hinflug und noch nicht angekommen ist: Sie dreht um, und der Rückflug dauert so lange wie die bereits geflogene Strecke. Eine angekommene oder bereits zurückkehrende Flotte kann nicht zurückgerufen werden.

**Wo sehe ich das Ergebnis?**
In den *Berichten*.

**Was transportiert die Angriffsmission?**
Sie kann auch Fracht mitführen, aber die Beute nutzt nur den **freien Platz**, der in den überlebenden Schiffen bleibt.

**Wie funktioniert der Verbandsangriff?**
Die Mission **Verbandsangriff** ist für Mitglieder **derselben Allianz** (Ziel: ein Spieler außerhalb der Allianz). Die erste gesendete Flotte **erstellt eine Gruppe** und legt die Ankunftszeit fest; andere Mitglieder **treten bei** über die Flottenseite (Liste „Gruppe“ für dieselben Koordinaten) und kommen zur selben Zeit an, sofern ihre Flotte rechtzeitig dort sein kann (sonst „Flotte zu langsam“). Eine Gruppe hat **höchstens 5 Flotten**. Bei der Ankunft vereint **ein einziger Kampf** alle angekommenen Flotten, jede mit **ihren eigenen Technologien und ihrem Kommandanten**; Verluste werden pro Flotte gezählt. Die Beute (wie beim einfachen Angriff höchstens die Hälfte der Vorräte) wird **im Verhältnis zur freien Kapazität jeder Flotte aufgeteilt**. Jeder Teilnehmer erhält seinen Bericht mit der Teilnehmerliste. Eine zurückgerufene Flotte verlässt die Gruppe.

---

## 7. Kampf

**Wie läuft ein Kampf ab?**
Bis zu **6 Runden**. In jeder Runde schießt jede Einheit des Angreifers, dann jede Einheit des Verteidigers, auf eine **zufällig gewählte** gegnerische Einheit (und schießt gemäß ihrem **Schnellfeuer** erneut, siehe §5). Schaden entfernt zuerst den Schild, dann die Hülle; eine Einheit ohne Hülle ist zerstört. Am Ende jeder Runde **regenerieren die Schilde um 70 %** ihres Maximums. Der Kampf endet, wenn eine Seite vernichtet ist oder nach 6 Runden (Unentschieden).

**Welche Technologieboni gelten?**
*Militär* (+10 % Waffe pro Stufe), *Verteidigung* (+10 % Hülle), *Schild* (+10 % Schild), angewendet auf alle Ihre Einheiten, Schiffe **und** Verteidigungen. Jede Seite nutzt ihre eigenen Stufen.

**Wer verteidigt einen angegriffenen Planeten?**
Die **Verteidigungen** und die **stationierte Flotte** des Planeten kämpfen zusammen (auch Solarsatelliten, die sehr fragil sind).

**Was geht verloren und was kommt zurück?**
- Zerstörte Schiffe sind verloren.
- Zerstörte **Verteidigungen** werden nach dem Kampf mit je **70 % Wahrscheinlichkeit** wieder aufgebaut.
- Ein „Trümmerfeld“ wird erzeugt (30 % der Metall- und Kristallkosten der verlorenen Schiffe), im Bericht und in der Galaxie angezeigt und kann von Recyclern geerntet werden (§5).
- **Beute** (wenn der Angreifer gewinnt): bis zu **50 %** jedes Rohstoffs des Ziels, begrenzt auf die freie Kapazität der überlebenden Schiffe.

**Wie gewinne ich einen Kampf?**
Spionieren Sie zuerst, um Flotte und Verteidigung zu kennen, prüfen Sie, ob Ihre Fracht für die Beute reicht, und schicken Sie eine deutlich überlegene Flotte (der Zufall spielt mit). Der Schild einer Einheit absorbiert Schüsse bis zur Erschöpfung und regeneriert dann pro Runde um 70 %; Einheiten mit großen Schilden stecken also von Runde zu Runde viele Schüsse ein.

**Kann ich meinen eigenen Planeten angreifen?**
Nein. Stationieren erfordert einen **Ihrer** Planeten, ein Angriff schließt Ihre aus.

---

## 8. Verteidigung

**Welche Verteidigungen kann ich bauen?**

| Verteidigung (Name im Spiel) | Kosten (Metall / Kristall / Deuterium) | Waffe / Schild / Hülle | Wichtigste Voraussetzungen |
|---|---|---|---|
| **Raketenwerfer** (*Lanceur de Missiles*, 401) | 2 000 / 0 / 0 | 80 / 20 / 200 | Werft 1 |
| **Leichtes Lasergeschütz** (*Artillerie Laser Légère*, 402) | 1 500 / 500 / 0 | 100 / 25 / 2 000 | Werft 2, Energie 2, Laser 3 |
| **Schweres Lasergeschütz** (*Artillerie Laser Lourde*, 403) | 6 000 / 2 000 / 0 | 250 / 100 / 8 000 | Werft 4, Energie 3, Laser 6 |
| **Gaußkanone** (*Canon de Gauss*, 404) | 20 000 / 15 000 / 2 000 | 1 100 / 200 / 35 000 | Werft 6, Energie 6, Militär 3, Schild 1 |
| **Ionengeschütz** (*Artillerie à Ions*, 405) | 2 000 / 6 000 / 0 | 150 / 500 / 8 000 | Werft 4, Ionen 4 |
| **Plasmawerfer** (*Canon à Plasma*, 406) | 50 000 / 50 000 / 30 000 | 3 000 / 300 / 100 000 | Werft 8, Plasma 7 |
| **Kleine Schildkuppel** (*Petit Bouclier*, 407) | 10 000 / 10 000 / 0 | 1 / 2 000 / 20 000 | Werft 6, Schild 2 |
| **Große Schildkuppel** (*Grand Bouclier*, 408) | 50 000 / 50 000 / 0 | 1 / 10 000 / 100 000 | Werft 8, Schild 6 |

**Raketen.** Das Raketensilo (Werft 1) fasst 10 Raketen pro Stufe. Die *Abfangrakete* (Silo 1) schießt bei der Ankunft eine feindliche Rakete ab; die *Interplanetarrakete* (Silo 4, Impulsantrieb 1) wird von der Verteidigungsseite aus auf einen Planeten derselben Galaxie gestartet, bis zu 5 × Impulsantriebsstufe − 1 Systeme weit. Jede durchkommende Rakete richtet 12 000 Schaden an (+10 % je Waffenstufe) und trifft die Verteidigung des Ziels, zuerst die gewählte, dann Raketenwerfer, Laser, Gauß, Ionen, Plasma und Schilde. Raketen treffen weder Flotte noch Rohstoffe; Schaden, der keine ganze Einheit zerstört, verfällt.

**Sind Planetenschilde besonders?**
Ja: **je eines pro Planet** (klein, groß). Sie haben einen riesigen Schild und eine dicke Hülle bei nahezu keiner Waffe: Sie dienen dazu, Schüsse zu **absorbieren**.

**Welche Verteidigung lohnt sich am meisten?**
Nach Kosten sind Raketenwerfer und Lasergeschütze am Anfang am effizientesten; Schildkuppeln fangen viele Schüsse ab; der Plasmawerfer ist die stärkste Verteidigung, aber sehr teuer. Kombinieren Sie sie: Schüsse verteilen sich zufällig auf **alle** Einheiten, daher schützen billige Kuppeln und Werfer Ihre teuren Verteidigungen.

**Kommen zerstörte Verteidigungen zurück?**
Jede zerstörte Verteidigung wird nach dem Kampf mit **70 % Wahrscheinlichkeit** kostenlos wieder aufgebaut; verlorene Schiffe kommen nicht zurück.

**Schützt meine Verteidigung meine Rohstoffe?**
Nicht direkt: Gewinnt der Angreifer, kann er bis zu 50 % Ihres Bestands plündern. Eine starke Verteidigung erschwert seinen Sieg; Rohstoffe auszugeben, bevor Sie sich abmelden, ist der beste Schutz.

**Nehmen meine Schiffe an der Verteidigung teil?**
Ja, die auf dem Planeten **stationierten** (nicht die im Flug) kämpfen zusammen mit der Verteidigung.

**Verbessert Technologie meine Verteidigung?**
Ja: *Verteidigung* (Hülle), *Schild* und *Militär* (Waffe) mit +10 % pro Stufe gelten auch für Verteidigungen.

---

## 9. Macht, Kommandant und Rangliste

**Was ist Macht?**
Eine Punktzahl für Ihre Entwicklung: **Gebäude + Forschung + Schiffe + Verteidigung + Kolonien**. Pro Kategorie werden die investierten Kosten (Metall + Kristall + Deuterium) addiert und durch 1 000 geteilt. Jede Kolonie (über den ersten Planeten hinaus) zählt 1 000 Punkte. **Rohstoffbestände zählen nicht.**

**Was ist die Kommandantenstufe?**
Eine Stufe von 1 bis 100, **nur** aus den Punkten für Gebäude und Forschung berechnet (nicht Schiffe). Die Schwelle der Stufe `n` ist `10 × (n − 1)³`: Stufe 2 bei 10 Punkten, Stufe 10 bei 7 290, Stufe 50 bei 1 176 490. Auf Stufe 50 erhalten Sie den 3. gleichzeitigen Bau (mit *Gestion des chantiers*) und die 3. Produktionslinie (mit *Production parallèle*).

**Wie funktioniert die Rangliste?**
Sie beruht auf der **Macht**; Ihr Rang erscheint in der Kopfzeile und in der Übersicht. Schiffsverluste senken Ihre Macht; der Bau von Verteidigung erhöht sie.

**Was tun Offiziere?**
Fünf Charaktere, die **einmalig eingestellt** werden (500 000 Deuterium, vom gewählten Planeten abgezogen, Seite Offiziere) und deren Boni für dein ganzes Konto gelten: **Intendant** (+10 % Energie, +1 Bauplatz pro Planet), **Admiral** (+10 % Flottengeschwindigkeit, +2 gleichzeitige Expeditionen), **Ingenieur** (−10 % Bauzeit), **Geologe** (+10 % Minenproduktion und Lagerkapazität), **Technokrat** (−10 % Forschungszeit, +2 Spionagestufen). Nicht zu verwechseln mit der *Kommandantenstufe* oben, die deine Entwicklung misst. Produktionsboni gelten erst ab der Einstellung.

**Was sind Flottenkommandanten?**
Bis zu **3 Charaktere**, rekrutiert (250 000 Deuterium, Seite Kommandanten) und **beim Senden einer Flotte zugewiesen** (Liste „Kommandant“ auf der Flottenseite). Solange die Flotte nicht beendet ist, ist der Kommandant auf Mission. Er sammelt **Erfahrung bei jedem Angriffskampf** (100 + 1 pro 1 000 beim Gegner zerstörtem Metall und Kristall); jede Stufe braucht `1000 × 1,5^(Stufe − 1)` EP (Höchststufe 20) und gibt **1 Fertigkeitspunkt** für *Angriff* (Schaden), *Verteidigung* (Schild und Hülle), *Geschwindigkeit* oder *Fracht*: +1 % pro Fertigkeitsstufe, höchstens 10 Stufen. Wird die **ganze Flotte zerstört**, stirbt er mit 10 % Wahrscheinlichkeit. Die Boni gelten für die begleiteten Flotten (Geschwindigkeit und Kapazität beim Senden, Angriffskampf); nicht für eine haltende Flotte, die einen Verbündeten verteidigt. Dagegen sammelt der Kommandant einer haltenden Flotte **Erfahrung, wenn die Verteidigung gelingt** (der Angreifer gewinnt nicht), nach dem Wert der Schiffe, die der Angreifer verloren hat; beim Verteidigen riskiert er nicht den Tod.

**Wie funktioniert der Markt?**
Seite **Markt**: Du bietest eine Menge einer Ressource gegen eine andere an („1 000 Deuterium gegen Metall, zum Kurs 3“). Deine Ressource wird **hinterlegt** (vom gewählten Planeten abgezogen), bis sie verkauft ist, du sie zurückziehst oder das Angebot **abläuft** (24 h; die Hinterlegung wird dir zurückgegeben). Ein Käufer kann alles oder einen Teil nehmen (von dir festgelegter Mindestkauf); er zahlt in der verlangten Ressource und erhält die andere **sofort**; du erhältst die Zahlung auf dem ursprünglichen Planeten des Angebots, **abzüglich 5 % Steuer, die vernichtet werden**. Der Kurs muss zwischen der **Hälfte und dem Doppelten** des Referenzkurses liegen (Referenzwerte: Metall 1, Kristall 1,5, Deuterium 3). Höchstens **10 aktive Angebote** pro Spieler. Du kannst dein eigenes Angebot nicht kaufen. Der Verlauf zeigt den letzten und den jüngsten Durchschnittskurs jedes Paares.

**Wie funktionieren Quests?**
Seite **Quests**: **drei Quests pro Tag** und **zwei pro Woche**, aus einem Katalog gezogen (für alle Spieler gleich). Sie werden um **Mitternacht UTC** zurückgesetzt (montags für die Woche). Der Fortschritt wird aus deiner **echten Aktivität** seit Beginn des Zeitraums berechnet: abgeschlossene Bauten und Forschungen, auf der Werft gebaute Einheiten, gesendete Flotten, gewonnene Angriffskämpfe, Spionagen, Expeditionen. Ist das Ziel erreicht, schreibt **Abholen** die Belohnung (Metall, Kristall oder Deuterium) dem **gewählten Planeten** gut, **einmal pro Zeitraum**. Die Belohnung wird mit deiner **Kommandantenstufe** multipliziert (+10 % pro Stufe, bis ×6). Nicht Abgeholtes geht bei der Zurücksetzung verloren.

**Was sind Erfolge?**
Seite **Erfolge**: 34 Meilensteine in sechs Kategorien (Fortschritt, Bau, Kampf, Erkundung, Sozial, Wirtschaft): Kommandantenstufe, Planetenanzahl, abgeschlossene Bauten und Forschungen, Siege, Spionagen, Expeditionen, Monde, Allianz, Offiziere, Markthandel … Ein Erfolg wird freigeschaltet, sobald der Meilenstein erreicht ist, und **bleibt erhalten**, auch wenn die zugrunde liegende Aktivität verschwindet. Er bringt keine Ressourcen; die Seite zeigt deinen Abschlussprozentsatz.

**Was sind Weltereignisse?**
Zeitlich begrenzte Bonusphasen für **alle** Spieler, die ein Administrator in der Konsole startet (Reiter *Ereignisse*). Ein Banner oben auf den Spielseiten zeigt das laufende Ereignis, sein Ende und seine Wirkung: **Produktion +X %** (Minen und Grundeinkommen, auf allen Planeten) und/oder **gesenkte Marktsteuer**. Mehrere Ereignisse addieren sich, höchstens bis **+100 % Produktion**. Zeit, die vor dem Beginn oder nach dem Ende eines Ereignisses vergangen ist, wird nie mit dem Bonus neu berechnet: Die Produktion aller Planeten wird vor jeder Änderung abgerechnet. Nichts startet von selbst, außer der Administrator hakt bei einer saisonalen Vorlage **„Automatisch“** an (Frühlingsfest, Sommersonnenwende, Erntemond, Dunkler Nebel, Winterfest): Dann wird sie zu Beginn ihres Zeitraums gestartet, einmal pro Jahr. Bosse, Invasionen und Wettbewerbssaisons gibt es noch nicht.

---

## 10. „Warum kann ich nicht …?“

| Meldung (im Spiel auf Französisch) | Ursache und Lösung |
|---|---|
| „Ressources insuffisantes“ | Es fehlt Metall, Kristall oder Deuterium (bei einem Flug kommt der Treibstoff zur Deuteriumfracht hinzu). |
| „Prérequis manquants : …“ | Die Details nennen die zu erreichenden Gebäude- oder Technologiestufen. |
| „Capacité de construction atteinte“ | Die Warteschlange des Planeten ist voll: warten oder *Gestion des chantiers* freischalten (2 Warteschlangen). |
| „Nombre maximal de flottes en vol atteint“ | Alle Ihre Flottenplätze sind belegt: Warten Sie auf die Rückkehr einer Flotte oder erhöhen Sie die *Computertechnik* (§6). |
| „Plus de champs disponibles“ | Der Planet hat keine Felder mehr (163): Nutzen Sie die letzten Felder für nützliche Gebäude oder kolonisieren Sie. |
| „Aucune planète à cette position“ | Angriff und Spionage zielen nur auf einen existierenden Planeten; zum Kolonisieren muss die Position **frei** sein. |
| „Une mission d'espionnage n'accepte que des sondes d'espionnage“ | Nur Sonden (210) senden. |
| „Capacité de cargaison insuffisante“ | Transporter hinzufügen oder die Fracht verringern. |
| „Un bouclier planétaire ne se construit qu'en un seul exemplaire“ | Je eine kleine und eine große Schildkuppel pro Planet. |
| „La flotte est déjà arrivée“ | Rückruf ist nur auf dem Hinflug möglich. |
| „Mission non disponible“ | Die Mission gibt es noch nicht (§6). |

---

## 11. Was es noch nicht gibt

Galaktische Bosse, Invasionen und Wettbewerbssaisons. Die Roadmap des Projekts ([ROADMAP_MVP.md](../ROADMAP_MVP.md)) verfolgt diese Abweichungen.

*Diese FAQ wurde gegen den Code (`packages/game-config`, `packages/game-engine`, API) und, für die Solarsatelliten, durch einen automatisierten Integrationstest (`solar-satellites.integration.spec.ts`) geprüft.*

# Spielerhandbuch — XNova Reforged

> Version `v0.2.0` (private Alpha). Dieses Handbuch beschreibt, was das Spiel heute tatsächlich tut. Sprachen: [Français](GUIDE_JOUEUR.md) · [English](PLAYER_GUIDE_EN.md) · [Español](PLAYER_GUIDE_ES.md) · [Deutsch](PLAYER_GUIDE_DE.md) · [Italiano](PLAYER_GUIDE_IT.md).

## 1. Erste Schritte

1. **Erstelle dein Konto.** Deine E-Mail-Adresse muss bestätigt werden: Klicke auf den per E-Mail erhaltenen Link (24 Stunden gültig, auf der Anmeldeseite erneut anforderbar).
2. Du erhältst einen **Startplaneten** („Heimatplanet“) mit 500 Metall, 500 Kristall und ohne Gebäude.
3. Folge der **Einstiegshilfe** in der Übersicht: 11 Ziele, berechnet aus deiner tatsächlichen Lage, jeweils mit einem Link zur nächsten Aktion. Nach Abschluss kannst du sie ausblenden.
4. Wähle deine **Sprache** (Französisch, Englisch, Spanisch, Deutsch, Italienisch) über die Auswahl in der Kopfzeile oder in den *Optionen*. Sie folgt der Seitenadresse (`/fr/…`, `/de/…`).

## 2. Das Tempo des Servers

Kosten und Formeln entsprechen dem Originalspiel; die **Servergeschwindigkeit** beschleunigt Dauern und Produktion (Einstellung des Administrators). Das Referenzprofil ist **×50**:

| Meilenstein eines vernünftigen Spielers | Dauer bei ×50 |
|---|---:|
| Forschungslabor fertig | ≈ 22 Min. |
| Erste Forschung gestartet | ≈ 1 Std. |
| Raumwerft fertig | ≈ 1 Std. 05 |
| Erstes Schiff | ≈ 1 Std. 50 |

Diese Zeiten wurden auf dem Server mit einem Spieler gemessen, der nur ausgibt, was er produziert. Auf einem ×1-Server ist alles etwa 50-mal langsamer: Plane lange Wartezeiten ein.

## 3. Rohstoffe und Energie

- **Metall**: Gebäude, Schiffe, Verteidigung. **Kristall**: Labor, Forschungen, Schiffe. **Deuterium**: Treibstoff der Flotten, Labor und die meisten Forschungen (du hast zu Beginn keines: Der Deuteriumsynthetisierer ist deine Priorität).
- **Energie**: Minen verbrauchen die Energie der Solarkraftwerke. Übersteigt der Verbrauch die Produktion, werden **alle** Minen proportional langsamer. Halte die Produktion bei 100 %.
- Jeder Planet hat ein kleines Grundeinkommen, unabhängig von den Minen.
- Das **Lager** ist begrenzt (Basiskapazität von einer Million pro Rohstoff, wächst mit den Lagergebäuden); darüber hinaus geht die Produktion verloren.

## 4. Bauen, forschen, produzieren

- **Gebäude**: Die Kosten werden beim Start abgezogen und steigen mit jeder Stufe. Die Zahl gleichzeitiger Bauten pro Planet ist begrenzt: 1 zu Beginn, 2 mit der Forschung *Bauverwaltung*, 3 zusätzlich mit einem Kommandanten der Stufe 50.
- **Forschung**: nur eine gleichzeitig pro Spieler, beim Start bezahlt. Sie verlangt eine Laborstufe und manchmal weitere Technologien (fehlende Voraussetzungen werden angezeigt). Beginne mit *Energie*.
- **Raumwerft und Verteidigung**: Bestellungen werden sofort bezahlt und in Serien gebaut. Eine **wartende** Bestellung kann zurückgezogen werden: 90 % der bezahlten Rohstoffe werden erstattet. Eine bereits gestartete Serie wird normal beendet. *Parallelproduktion* fügt Produktionslinien hinzu.
- Die Voraussetzungen (Werftstufe, Technologien) stehen auf jeder Karte.

## 5. Flotten und Missionen

Seite *Flotte*: Wähle Schiffe, Koordinaten `[Galaxie:System:Position]`, eine Mission und die Geschwindigkeit. Der Treibstoff (Deuterium) wird beim Start abgezogen.

| Mission | Wirkung |
|---|---|
| **Transport** | liefert die Ladung auf dem Zielplaneten ab, dann kehrt die Flotte zurück |
| **Stationierung** | bringt Schiffe und Ladung auf **deinen** Zielplaneten, ohne Rückkehr |
| **Angriff** | Kampf; Beute möglich |
| **Spionage** | Bericht über das Ziel (mehr Sonden oder bessere *Spionagetechnik* = mehr Details) |
| **Kolonisierung** | gründet mit einem Kolonieschiff eine Kolonie auf einer freien Position (maximal 21 Planeten) |

Eine Flotte im Flug kann unter *Bewegungen* **zurückgerufen** werden. Die Ergebnisse erscheinen in den *Berichten*.

## 6. Kampf

- Höchstens 6 Runden; manche Schiffe haben **Schnellfeuer** gegen andere Typen.
- 30 % der Kosten zerstörter Schiffe werden zu **Trümmern**.
- Jede zerstörte **Verteidigungsanlage** wird nach dem Kampf mit 70 % Wahrscheinlichkeit repariert.
- **Beute**: bis zu 50 % der Rohstoffe des Ziels, **begrenzt auf den freien Platz in den überlebenden Schiffen** des Siegers; der Rest wird nicht mitgenommen.
- Tipps: Spioniere vor dem Angriff, prüfe die Ladekapazität, lass deine Rohstoffe nicht anhäufen.

## 7. Galaxie

- 9 Galaxien × 499 Systeme × 15 Positionen. Die Seite *Galaxie* öffnet sich im System deines aktiven Planeten; dein Planet ist hervorgehoben.
- Besetzte Position: spionieren, angreifen, transportieren. Freie Position: kolonisieren.

## 8. Kommandant, Macht, Rangliste

- Deine **Kommandantenstufe** (1 bis 100) hängt nur von Gebäuden und Forschungen ab; deine **Macht** umfasst zusätzlich Schiffe, Verteidigung und Kolonien. Lagerbestände zählen nicht.
- Die **Rangliste** beruht auf der Macht; dein Rang steht in der Kopfzeile und in der Übersicht.

## 9. Soziales

- **Nachrichten** zwischen Spielern (über den Benutzernamen).
- **Allianzen**: Gründe eine (Kürzel mit 2 bis 8 Zeichen) oder tritt per Einladung bei; der Gründer kann nicht austreten, ohne sie aufzulösen.

## 10. Konto und Sicherheit

- Passwort: mindestens 8 Zeichen mit einem Kleinbuchstaben, einem Großbuchstaben und einer Ziffer. Du kannst es und deine E-Mail-Adresse (Bestätigung per Link) in den *Optionen* ändern.
- „Passwort vergessen“ sendet einen Link, der eine Stunde gültig ist. Ändern oder Zurücksetzen des Passworts meldet deine anderen Geräte ab.
- Zu viele fehlgeschlagene Anmeldeversuche sperren den Zugang vorübergehend.

## 11. Bekannte Grenzen der Alpha

Keine Offiziere, kein Markt, keine Ereignisse; Namen und Beschreibungen des Spiels und einige Fehlermeldungen bleiben unabhängig von der gewählten Sprache auf Französisch; E-Mails werden auf Französisch gesendet.

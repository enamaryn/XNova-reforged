# Datenschutzerklärung

Letzte Aktualisierung: 27. Oktober 2026. Dieses Dokument erklärt, welche Daten dieser XNova-Reforged-Server erhebt, wozu, wie lange und wie Sie Ihre Rechte ausüben.

## 1. Verantwortlicher

**{{OPERATOR}}** betreibt diesen Server und entscheidet über die erhobenen Daten. Kontakt für Fragen und Anfragen: **{{CONTACT}}**.

## 2. Erhobene Daten

| Daten | Zweck | Speicherdauer |
|---|---|---|
| Spielername | Identifikation im Spiel, Ranglisten, Nachrichten, Galaxie (für andere Spieler sichtbar) | Solange das Konto besteht |
| E-Mail-Adresse (und ihre kanonische Form: ohne „+Tag“-Aliase und Gmail-Punkte) | Anmeldung, Kontobestätigung, Passwort vergessen, Erkennung von Mehrfachkonten | Solange das Konto besteht |
| Passwort | Anmeldung. Gespeichert wird nur ein **Argon2-Hash**, nie das Passwort selbst | Solange das Konto besteht |
| IP-Adresse (IPv4 oder /64-Präfix bei IPv6), erfasst bei Registrierung, Anmeldung und Sitzungserneuerung | Kontrolle von Mehrfachkonten und Sicherheit | Standardmäßig **90 Tage** nach der letzten Beobachtung (vom Betreiber einstellbar), automatische nächtliche Bereinigung |
| Spieldaten: Planeten, Gebäude, Forschung, Flotten, Berichte, private Nachrichten, Allianz, Aufgaben, Markt | Betrieb des Spiels | Solange das Konto besteht |
| Sitzungen: Hash des Erneuerungstokens, Zeitangaben | Angemeldet bleiben, Sitzungen widerrufen können | Höchstens 30 Tage je Sitzung |
| E-Mail-Tokens (nur Hash) | Adressbestätigung, Passwort-Zurücksetzung | Bis zum Ablauf |
| Technische Vorfälle: Serverfehler, wobei Passwörter, Tokens, Cookies, E-Mail-Adressen und private Nachrichten maskiert werden | Wartung und Sicherheit | Standardmäßig 30 Tage (vom Betreiber einstellbar) |
| Audit-Protokoll der Administrationsaktionen | Rechenschaft der Administratoren | Solange erforderlich |

Es werden keine Daten verkauft oder für Werbung oder Profiling genutzt. Die Seite verwendet kein Werkzeug zur Reichweitenmessung.

## 3. Rechtsgrundlagen

Erfüllung des von Ihnen gewünschten Dienstes (Konto, Spiel, Service-E-Mails); berechtigtes Interesse des Betreibers an der Sicherheit des Dienstes und an der Durchsetzung der Regel „ein Konto pro Person“ (IP-Adressen und kanonische E-Mail).

## 4. Empfänger

Ihre Daten sind für den Betreiber und die benannten Administratoren zugänglich. Service-E-Mails laufen über den vom Betreiber gewählten Mailserver (SMTP). Aktiviert der Betreiber die externe Fehlerüberwachung **Sentry** (optional, standardmäßig aus), werden maskierte Fehlerberichte an diesen Anbieter übermittelt, der sie außerhalb der Europäischen Union verarbeiten kann.

## 5. Cookies und Browser-Speicher

Die Seite verwendet nur **für den Betrieb notwendige** Elemente, ohne Werbe-Tracking:

- `xnova_access`: Anmelde-Cookie (Zugriffstoken);
- `NEXT_LOCALE`: Cookie mit Ihrer Sprachwahl (ein Jahr);
- lokaler Browser-Speicher: `xnova-auth` (Sitzungszustand) und `xnova-planet` (gewählter Planet).

Beim Abmelden wird das Anmelde-Cookie gelöscht.

## 6. Ihre Rechte

Sie können **Auskunft** über Ihre Daten, deren **Berichtigung**, **Löschung** oder **Übertragbarkeit** verlangen oder der Verarbeitung **widersprechen**, indem Sie an **{{CONTACT}}** schreiben. Eine Schaltfläche zum Löschen des Kontos gibt es noch nicht: Der Betreiber bearbeitet die Anfrage und löscht das Konto samt Spieldaten, soweit das Gesetz keine Aufbewahrung vorschreibt. Sie können sich außerdem bei der Datenschutzaufsichtsbehörde Ihres Landes beschweren.

## 7. Sicherheit

Gehashte Passwörter (Argon2), widerrufbare Sitzungen, als Hash gespeicherte Tokens, im Ruhezustand verschlüsselte Konfigurationsgeheimnisse. Kein System ist unfehlbar: Melden Sie Sicherheitslücken an **{{CONTACT}}**.

## 8. Änderungen

Diese Erklärung kann sich ändern; das obige Datum wird dann aktualisiert. Die [Nutzungsbedingungen](/{{LOCALE}}/terms) ergänzen dieses Dokument.

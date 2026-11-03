# Privacy Policy

Last updated: 3 November 2026. This document explains what data this XNova Reforged server collects, why, for how long, and how to exercise your rights.

## 1. Data controller

**{{OPERATOR}}** runs this server and decides which data is collected. Contact for any question or request: **{{CONTACT}}**.

## 2. Data collected

| Data | Purpose | Retention |
|---|---|---|
| Player name | In-game identification, rankings, messages, galaxy view (visible to other players) | As long as the account exists |
| Email address (and its canonical form: without "+tag" aliases or Gmail dots) | Login, account confirmation, forgotten password, multi-account detection | As long as the account exists |
| Password | Login. Only an **Argon2 hash** is stored, never the password itself | As long as the account exists |
| Date and version of the terms accepted | Proving your acceptance of the terms of use | As long as the account exists |
| Reports sent to support: type, subject, message, open page, game version, browser | Handling your support requests and fixing bugs | As long as the account exists (erased with it) |
| IP address (IPv4, or /64 prefix for IPv6), seen at registration, login and session refresh | Multi-account control and security | **90 days** after the last sighting by default (adjustable by the operator), automatic nightly purge |
| Game data: planets, buildings, research, fleets, reports, private messages, alliance, quests, market | Running the game | As long as the account exists |
| Sessions: hash of the refresh token, dates | Staying signed in, being able to revoke a session | 30 days at most per session |
| Email tokens (hash only) | Address confirmation, password reset | Until they expire |
| Technical incidents: server errors, with passwords, tokens, cookies, email addresses and private messages masked | Maintenance and security | 30 days by default (adjustable by the operator) |
| Audit log of administration actions | Accountability of administrators | Kept as long as needed |

No data is sold or used for advertising or profiling. The site uses no audience-measurement tool.

## 3. Legal bases

Performance of the service you request (account, game, service emails); the operator's legitimate interest in securing the service and enforcing the "one account per person" rule (IP addresses and canonical email).

## 4. Recipients

Your data is accessible to the operator and designated administrators. Service emails go through the sending server (SMTP) chosen by the operator. If the operator enables the external error tracker **Sentry** (optional, off by default), masked error reports are sent to that provider, which may process them outside the European Union.

## 5. Cookies and browser storage

The site only uses items **necessary for it to work**, with no advertising tracking:

- `xnova_access`: login cookie (access token);
- `NEXT_LOCALE`: cookie remembering your language choice (one year);
- browser local storage: `xnova-auth` (session state) and `xnova-planet` (selected planet).

Signing out deletes the login cookie.

## 6. Your rights

You may request **access** to your data, its **correction** or **portability**, or **object** to its processing, by writing to **{{CONTACT}}**. For **deletion**, there is a button in Settings, "Delete my account" section: after you confirm with your password, the account and its planets, fleets, messages, sessions and IP addresses are erased immediately and permanently (not possible while fleets or missiles are in flight). Other players' combat reports and trade histories may keep your player name or a technical identifier, with no other personal data; existing backups disappear when they are rotated. You may also lodge a complaint with the data protection authority of your country.

## 7. Security

Hashed passwords (Argon2), revocable sessions, tokens stored as hashes, configuration secrets encrypted at rest. No system is infallible, so please report any flaw to **{{CONTACT}}**.

## 8. Changes

This policy may change; the date above is then updated. The [terms of use](/{{LOCALE}}/terms) complete this document.

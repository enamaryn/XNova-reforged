# Politique de confidentialité

Dernière mise à jour : 27 octobre 2026. Ce document explique quelles données ce serveur de XNova Reforged collecte, pourquoi, combien de temps, et comment exercer vos droits.

## 1. Responsable du traitement

**{{OPERATOR}}** exploite ce serveur et décide des données collectées. Contact pour toute question ou demande : **{{CONTACT}}**.

## 2. Données collectées

| Donnée | Pourquoi | Durée de conservation |
|---|---|---|
| Nom de joueur | Identification en jeu, classements, messages, galaxie (visible des autres joueurs) | Tant que le compte existe |
| Adresse email (et sa forme canonique : sans alias « +étiquette » ni points Gmail) | Connexion, confirmation du compte, mot de passe oublié, détection des doubles comptes | Tant que le compte existe |
| Mot de passe | Connexion. Seule une **empreinte Argon2** est stockée, jamais le mot de passe | Tant que le compte existe |
| Adresse IP (IPv4, ou préfixe /64 pour IPv6), vue à l'inscription, à la connexion et au rafraîchissement de session | Contrôle des doubles comptes et sécurité | **90 jours** après la dernière observation par défaut (réglable par l'éditeur), purge automatique chaque nuit |
| Données de jeu : planètes, bâtiments, recherches, flottes, rapports, messages privés, alliance, quêtes, marché | Fonctionnement du jeu | Tant que le compte existe |
| Sessions : empreinte du jeton de rafraîchissement, dates | Rester connecté, pouvoir révoquer une session | 30 jours au plus par session |
| Jetons email (empreinte seulement) | Confirmation d'adresse, réinitialisation du mot de passe | Jusqu'à leur expiration |
| Incidents techniques : erreurs du serveur, avec masquage des mots de passe, jetons, cookies, adresses email et messages privés | Maintenance et sécurité | 30 jours par défaut (réglable par l'éditeur) |
| Journal d'audit des actions d'administration | Responsabilité des administrateurs | Conservé tant que nécessaire |

Aucune donnée n'est vendue, ni utilisée pour de la publicité ou du profilage. Le site n'utilise aucun outil de mesure d'audience.

## 3. Bases légales

Exécution du service que vous demandez (compte, jeu, emails de service) ; intérêt légitime de l'éditeur à sécuriser le service et à faire respecter la règle « un compte par personne » (adresses IP et email canonique).

## 4. Destinataires

Vos données sont accessibles à l'éditeur et aux administrateurs désignés. Les emails de service passent par le serveur d'envoi (SMTP) choisi par l'éditeur. Si l'éditeur active le suivi d'erreurs externe **Sentry** (optionnel, désactivé par défaut), les rapports d'erreurs masqués sont transmis à ce prestataire, qui peut les traiter hors de l'Union européenne.

## 5. Cookies et stockage du navigateur

Le site n'utilise que des éléments **nécessaires à son fonctionnement**, sans suivi publicitaire :

- `xnova_access` : cookie de connexion (jeton d'accès) ;
- `NEXT_LOCALE` : cookie mémorisant votre choix de langue (un an) ;
- stockage local du navigateur : `xnova-auth` (état de la session) et `xnova-planet` (planète sélectionnée).

Se déconnecter supprime le cookie de connexion.

## 6. Vos droits

Vous pouvez demander l'**accès** à vos données, leur **rectification**, leur **suppression**, leur **portabilité**, ou vous **opposer** à leur traitement, en écrivant à **{{CONTACT}}**. Il n'existe pas encore de bouton de suppression de compte : la demande est traitée par l'éditeur, qui supprime le compte et ses données de jeu, hors ce que la loi oblige à conserver. Vous pouvez aussi introduire une réclamation auprès de l'autorité de protection des données de votre pays (la CNIL en France).

## 7. Sécurité

Mots de passe hachés (Argon2), sessions révocables, jetons stockés sous forme d'empreintes, secrets de configuration chiffrés au repos. Aucun système n'étant infaillible, signalez toute faille à **{{CONTACT}}**.

## 8. Modifications

Cette politique peut évoluer ; la date ci-dessus est alors mise à jour. Les [conditions d'utilisation](/{{LOCALE}}/terms) complètent ce document.

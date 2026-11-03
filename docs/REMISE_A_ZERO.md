# Politique de remise à zéro de l'univers

Mise à jour : 3 novembre 2026. Critère V1 **9.5**. Décision du propriétaire : « oui, par défaut » (3 novembre 2026), c'est-à-dire les recommandations ci-dessous ; les dates restent à fixer par le propriétaire.

## Règles

1. **Une remise à zéro complète des planètes avant l'ouverture publique.** L'univers de l'alpha contient des comptes de test, des ressources issues de bugs corrigés et le rythme ×50 des essais : il ne doit pas devenir l'univers de départ des joueurs. Elle a lieu après la dernière correction bloquante de la bêta fermée et après la suppression des comptes de test (critère 2.7), à une date annoncée au moins **7 jours** avant.
2. **Les comptes des testeurs de l'alpha sont conservés** (nom, email, mot de passe, langue, acceptation des conditions) ; leurs planètes, flottes, recherches, ressources, messages, alliances, offres du marché, quêtes, succès et officiers repartent de zéro, comme à l'inscription.
3. **Aucune remise à zéro pendant la vie de l'univers**, sauf faille grave (duplication de ressources exploitée, corruption de données) qu'aucun correctif ni retour arrière ne répare. Dans ce cas : annonce d'au moins 7 jours quand c'est possible, 24 heures au minimum sinon, avec la raison.
4. **Univers permanent, sans saisons.** Les saisons compétitives n'existent pas dans le jeu. Si elles sont ajoutées, cette politique sera révisée avant leur lancement.
5. **Pendant l'alpha et la bêta fermée**, les remises à zéro restent possibles à tout moment, sans préavis (les conditions d'utilisation le disent déjà, section 2).

## Ce qui est effacé, ce qui est gardé

| Effacé à la remise à zéro | Conservé |
|---|---|
| Planètes et lunes, bâtiments, files de construction et de recherche, technologies | Comptes (`User`) : nom, email, mot de passe haché, langue, rôle, acceptation des conditions |
| Flottes, missiles, expéditions, champs de débris | Sessions (ou révoquées : à décider au moment de l'opération) |
| Rapports de combat et d'espionnage, messages privés | Réglages du serveur (`GameConfig` : langue, vitesse, SMTP chiffré, supervision, commerce PNJ, boss, double compte) |
| Alliances, groupes d'attaque, offres et échanges du marché, échanges PNJ | État de l'installation (parcours verrouillé) |
| Quêtes, succès, officiers, commandants de flotte, dégâts infligés aux boss | Journal d'audit de l'administration, signalements et réponses du support |
| Statistiques et classements recalculés | Exemptions de comptes liés (à relire : les comptes de test disparaissent avant) |

## Procédure

**Outil : `npm run universe:reset`** (code dans `apps/api/src/cli/universe-reset.ts`, à lancer depuis le dépôt du serveur, jeu arrêté).

```bash
sudo systemctl stop xnova-api xnova-web
npm run universe:reset -- --dry-run   # affiche ce qui serait effacé, ne change rien
npm run universe:reset                # confirmation RESET, sauvegarde, remise à zéro
sudo systemctl start xnova-api xnova-web
```

- **Refus** : si l'API répond encore (port `PORT`, 3001 par défaut) ; sans la confirmation `RESET` (`--yes` pour la passer dans un script).
- **Sauvegarde obligatoire** : `scripts/backup-db.sh` tourne avant toute modification, il n'existe aucune option pour s'en passer ; si elle échoue, rien n'est modifié. Le chemin de l'archive est affiché : la copier hors du serveur et la garder 30 jours.
- **Une seule transaction**, contrôlée avant validation : chaque compte doit avoir exactement une planète de départ et plus aucune donnée de jeu ; sinon tout est annulé.
- **Effets** : voir le tableau ci-dessus ; les planètes de départ ont les ressources de départ et la taille de planète réglées dans l'administration ; points et rangs repassent à 0 ; les sessions sont révoquées (les joueurs se reconnectent) ; les planètes « abandonnées » du fond de galaxie sont gardées.
- **Trace** : la date, le nombre de comptes et l'archive sont enregistrés dans `GameConfig` (clé `universe.lastReset`).
- Sans suppression des comptes de test au préalable (critère 2.7), ceux-ci reçoivent aussi une planète.

**Déroulé le jour J.**

1. **J − 7** : annoncer la date (Discord ou lien `SUPPORT_URL`, message aux joueurs, FAQ). Rappeler que les comptes sont conservés.
2. **J − 1** : vérifier l'état de la base, la place disque (voir [CAPACITE.md](CAPACITE.md)) et que la sauvegarde quotidienne s'exécute.
3. **J** : arrêter le jeu (`systemctl stop xnova-api xnova-web`), `npm run universe:reset` (sauvegarde incluse), redémarrage, puis contrôle (connexion d'un compte, planète de départ, onboarding, `/health`, console admin).
4. **Répétition obligatoire** : faire l'opération complète au moins une fois sur une **copie** de la base (voir [UPDATE.md](UPDATE.md) et `scripts/restore-db.sh`) avant le jour J, et conserver la sauvegarde d'avant-opération au moins 30 jours (copie hors du serveur).
5. **Retour arrière** : si le contrôle échoue, restaurer la sauvegarde d'avant-opération (`scripts/restore-db.sh --yes <archive>`).

**Option sans outil (comptes effacés).** Si le propriétaire préfère repartir d'une base vierge : sauvegarde, arrêt des services, recréation de la base, `npx prisma migrate deploy`, redémarrage, puis assistant d'installation. Tous les comptes, y compris les administrateurs, sont alors à recréer et les joueurs doivent se réinscrire ; l'acceptation des conditions est redemandée. À répéter d'abord sur une copie.

## Ce qui reste à décider (propriétaire)

- La date de la remise à zéro d'ouverture (la commande est prête).
- Si les récompenses symboliques (titre, officier offert) pour les testeurs de l'alpha sont souhaitées ; rien n'existe aujourd'hui.
- Le canal d'annonce principal (Discord, email via SMTP, message en jeu).

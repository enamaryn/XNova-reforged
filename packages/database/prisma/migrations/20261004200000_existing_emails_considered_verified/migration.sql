-- Reprise : la confirmation d'adresse devient obligatoire pour les nouveaux comptes (SCOPE-01).
-- Les comptes déjà existants (alpha privée) sont considérés comme confirmés pour ne pas être bloqués.
UPDATE "User" SET "emailVerifiedAt" = CURRENT_TIMESTAMP WHERE "emailVerifiedAt" IS NULL;

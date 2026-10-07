-- Un changement d’email administratif impose une vérification, y compris en développement.
ALTER TABLE "User" ADD COLUMN "mustVerifyEmail" BOOLEAN NOT NULL DEFAULT false;

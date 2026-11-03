-- Acceptation des conditions d'utilisation et de la politique de confidentialité
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "termsVersion" TEXT;

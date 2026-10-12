-- Maintien de position chez un allié : durée choisie et fin du maintien
ALTER TABLE "Fleet" ADD COLUMN "holdHours" INTEGER;
ALTER TABLE "Fleet" ADD COLUMN "holdUntil" TIMESTAMP(3);

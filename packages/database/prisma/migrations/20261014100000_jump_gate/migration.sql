-- Porte de saut : instant de fin de recharge de la lune
ALTER TABLE "Planet" ADD COLUMN "jumpGateReadyAt" TIMESTAMP(3);

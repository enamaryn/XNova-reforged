-- Attaque groupée coordonnée : arrivée prévue à la création, référence du retard maximal imposé par une flotte lente
ALTER TABLE "AttackGroup" ADD COLUMN "plannedArrivalTime" TIMESTAMP(3);
UPDATE "AttackGroup" SET "plannedArrivalTime" = "arrivalTime";
ALTER TABLE "AttackGroup" ALTER COLUMN "plannedArrivalTime" SET NOT NULL;

-- Attaques groupées : groupe d'attaque d'alliance, flottes rattachées, participants du rapport
CREATE TABLE "AttackGroup" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "toGalaxy" INTEGER NOT NULL,
    "toSystem" INTEGER NOT NULL,
    "toPosition" INTEGER NOT NULL,
    "toMoon" BOOLEAN NOT NULL DEFAULT false,
    "arrivalTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttackGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttackGroup_allianceId_arrivalTime_idx" ON "AttackGroup"("allianceId", "arrivalTime");

ALTER TABLE "AttackGroup" ADD CONSTRAINT "AttackGroup_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Fleet" ADD COLUMN "groupId" TEXT;

CREATE INDEX "Fleet_groupId_idx" ON "Fleet"("groupId");

ALTER TABLE "Fleet" ADD CONSTRAINT "Fleet_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AttackGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CombatReport" ADD COLUMN "participants" JSONB;

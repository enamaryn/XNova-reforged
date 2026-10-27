-- Boss galactiques : flotte unique en position 16, dégâts cumulés par joueur et journal des combats
CREATE TABLE "GalacticBoss" (
    "id" TEXT NOT NULL,
    "nameId" INTEGER NOT NULL,
    "galaxy" INTEGER NOT NULL,
    "system" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "activeSlot" INTEGER,
    "ships" JSONB NOT NULL,
    "maxShips" JSONB NOT NULL,
    "spawnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRegenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diedAt" TIMESTAMP(3),
    "respawnAt" TIMESTAMP(3),
    "killedById" TEXT,

    CONSTRAINT "GalacticBoss_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GalacticBoss_activeSlot_key" ON "GalacticBoss"("activeSlot");
CREATE INDEX "GalacticBoss_status_respawnAt_idx" ON "GalacticBoss"("status", "respawnAt");

CREATE TABLE "BossDamage" (
    "id" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "damage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "battles" INTEGER NOT NULL DEFAULT 0,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BossDamage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BossDamage_bossId_userId_key" ON "BossDamage"("bossId", "userId");
CREATE INDEX "BossDamage_bossId_damage_idx" ON "BossDamage"("bossId", "damage");
ALTER TABLE "BossDamage" ADD CONSTRAINT "BossDamage_bossId_fkey" FOREIGN KEY ("bossId") REFERENCES "GalacticBoss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BossBattle" (
    "id" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "galaxy" INTEGER NOT NULL,
    "system" INTEGER NOT NULL,
    "result" TEXT,
    "rounds" INTEGER NOT NULL DEFAULT 0,
    "attackerShips" JSONB,
    "attackerLosses" JSONB,
    "bossLosses" JSONB,
    "damage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bossHealthAfter" DOUBLE PRECISION,
    "killed" BOOLEAN NOT NULL DEFAULT false,
    "loot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BossBattle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BossBattle_userId_createdAt_idx" ON "BossBattle"("userId", "createdAt");
CREATE INDEX "BossBattle_bossId_createdAt_idx" ON "BossBattle"("bossId", "createdAt");
ALTER TABLE "BossBattle" ADD CONSTRAINT "BossBattle_bossId_fkey" FOREIGN KEY ("bossId") REFERENCES "GalacticBoss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

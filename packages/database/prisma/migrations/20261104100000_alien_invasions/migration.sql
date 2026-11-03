-- CreateTable
CREATE TABLE "Invasion" (
    "id" TEXT NOT NULL,
    "nameId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "activeSlot" INTEGER,
    "galaxy" INTEGER NOT NULL,
    "totalWaves" INTEGER NOT NULL,
    "currentWave" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "rewardPending" BOOLEAN NOT NULL DEFAULT false,
    "rewardProductionBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rewardDays" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Invasion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvasionWave" (
    "id" TEXT NOT NULL,
    "invasionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "system" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "activeSlot" INTEGER,
    "ships" JSONB NOT NULL,
    "maxShips" JSONB NOT NULL,
    "spawnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRegenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "InvasionWave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvasionDamage" (
    "id" TEXT NOT NULL,
    "invasionId" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "damage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "battles" INTEGER NOT NULL DEFAULT 0,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvasionDamage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvasionBattle" (
    "id" TEXT NOT NULL,
    "invasionId" TEXT NOT NULL,
    "waveId" TEXT,
    "waveIndex" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "galaxy" INTEGER NOT NULL,
    "system" INTEGER NOT NULL,
    "result" TEXT,
    "rounds" INTEGER NOT NULL DEFAULT 0,
    "attackerShips" JSONB,
    "attackerLosses" JSONB,
    "npcLosses" JSONB,
    "damage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waveHealthAfter" DOUBLE PRECISION,
    "cleared" BOOLEAN NOT NULL DEFAULT false,
    "loot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvasionBattle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invasion_activeSlot_key" ON "Invasion"("activeSlot");

-- CreateIndex
CREATE INDEX "Invasion_status_finishedAt_idx" ON "Invasion"("status", "finishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InvasionWave_activeSlot_key" ON "InvasionWave"("activeSlot");

-- CreateIndex
CREATE UNIQUE INDEX "InvasionWave_invasionId_index_key" ON "InvasionWave"("invasionId", "index");

-- CreateIndex
CREATE INDEX "InvasionDamage_invasionId_userId_idx" ON "InvasionDamage"("invasionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "InvasionDamage_waveId_userId_key" ON "InvasionDamage"("waveId", "userId");

-- CreateIndex
CREATE INDEX "InvasionBattle_invasionId_createdAt_idx" ON "InvasionBattle"("invasionId", "createdAt");

-- CreateIndex
CREATE INDEX "InvasionBattle_userId_createdAt_idx" ON "InvasionBattle"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "InvasionWave" ADD CONSTRAINT "InvasionWave_invasionId_fkey" FOREIGN KEY ("invasionId") REFERENCES "Invasion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvasionDamage" ADD CONSTRAINT "InvasionDamage_invasionId_fkey" FOREIGN KEY ("invasionId") REFERENCES "Invasion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvasionDamage" ADD CONSTRAINT "InvasionDamage_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "InvasionWave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvasionDamage" ADD CONSTRAINT "InvasionDamage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvasionBattle" ADD CONSTRAINT "InvasionBattle_invasionId_fkey" FOREIGN KEY ("invasionId") REFERENCES "Invasion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvasionBattle" ADD CONSTRAINT "InvasionBattle_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "InvasionWave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvasionBattle" ADD CONSTRAINT "InvasionBattle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


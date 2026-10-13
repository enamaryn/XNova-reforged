-- Événements du monde : périodes de bonus temporaires et réglage « automatique » par modèle
CREATE TABLE "WorldEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SEASONAL',
    "templateId" TEXT,
    "occurrenceKey" TEXT,
    "customName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "productionBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marketTaxReduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "launchedById" TEXT,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorldEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorldEvent_occurrenceKey_key" ON "WorldEvent"("occurrenceKey");
CREATE INDEX "WorldEvent_status_endsAt_idx" ON "WorldEvent"("status", "endsAt");
CREATE INDEX "WorldEvent_createdAt_idx" ON "WorldEvent"("createdAt");

CREATE TABLE "WorldEventSetting" (
    "templateId" TEXT NOT NULL,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldEventSetting_pkey" PRIMARY KEY ("templateId")
);

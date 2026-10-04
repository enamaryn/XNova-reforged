-- AlterTable
ALTER TABLE "Fleet" ADD COLUMN     "colonyName" TEXT;

-- CreateTable
CREATE TABLE "SpyReport" (
    "id" TEXT NOT NULL,
    "attackerId" TEXT NOT NULL,
    "defenderId" TEXT NOT NULL,
    "galaxy" INTEGER NOT NULL,
    "system" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "planetName" TEXT NOT NULL,
    "probes" INTEGER NOT NULL,
    "infoLevel" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpyReport_attackerId_createdAt_idx" ON "SpyReport"("attackerId", "createdAt");

-- CreateIndex
CREATE INDEX "SpyReport_defenderId_idx" ON "SpyReport"("defenderId");

-- AddForeignKey
ALTER TABLE "SpyReport" ADD CONSTRAINT "SpyReport_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpyReport" ADD CONSTRAINT "SpyReport_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


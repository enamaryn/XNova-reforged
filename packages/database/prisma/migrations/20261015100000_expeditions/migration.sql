-- Expéditions : rapport d'issue de chaque expédition
CREATE TABLE "ExpeditionReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "galaxy" INTEGER NOT NULL,
    "system" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "ships" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpeditionReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExpeditionReport_userId_createdAt_idx" ON "ExpeditionReport"("userId", "createdAt");

ALTER TABLE "ExpeditionReport" ADD CONSTRAINT "ExpeditionReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

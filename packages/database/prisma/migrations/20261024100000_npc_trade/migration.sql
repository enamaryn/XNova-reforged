-- Commerce PNJ : historique des échanges de ressources et des achats de vaisseaux (plafond quotidien par joueur)
CREATE TABLE "NpcTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "giveResource" TEXT,
    "wantResource" TEXT,
    "giveAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receiveAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shipId" INTEGER,
    "shipAmount" INTEGER,
    "rate" DOUBLE PRECISION,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NpcTrade_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NpcTrade_userId_kind_createdAt_idx" ON "NpcTrade"("userId", "kind", "createdAt");
CREATE INDEX "NpcTrade_createdAt_idx" ON "NpcTrade"("createdAt");

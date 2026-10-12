-- Marché : offres d'échange de ressources (séquestre) et historique des ventes
CREATE TABLE "MarketOffer" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "planetId" TEXT,
    "giveResource" TEXT NOT NULL,
    "wantResource" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "remaining" DOUBLE PRECISION NOT NULL,
    "minAmount" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rate" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketOffer_active_giveResource_wantResource_rate_idx" ON "MarketOffer"("active", "giveResource", "wantResource", "rate");
CREATE INDEX "MarketOffer_sellerId_active_idx" ON "MarketOffer"("sellerId", "active");
CREATE INDEX "MarketOffer_active_expiresAt_idx" ON "MarketOffer"("active", "expiresAt");

ALTER TABLE "MarketOffer" ADD CONSTRAINT "MarketOffer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MarketTrade" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "giveResource" TEXT NOT NULL,
    "wantResource" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "payment" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketTrade_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketTrade_giveResource_wantResource_createdAt_idx" ON "MarketTrade"("giveResource", "wantResource", "createdAt");
CREATE INDEX "MarketTrade_buyerId_createdAt_idx" ON "MarketTrade"("buyerId", "createdAt");
CREATE INDEX "MarketTrade_sellerId_createdAt_idx" ON "MarketTrade"("sellerId", "createdAt");

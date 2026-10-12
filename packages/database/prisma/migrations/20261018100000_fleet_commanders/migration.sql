-- Commandants de flotte : personnages recrutés, assignés à une flotte à l'envoi
CREATE TABLE "FleetCommander" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "skillPoints" INTEGER NOT NULL DEFAULT 0,
    "attack" INTEGER NOT NULL DEFAULT 0,
    "defense" INTEGER NOT NULL DEFAULT 0,
    "speed" INTEGER NOT NULL DEFAULT 0,
    "cargo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FleetCommander_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FleetCommander_userId_idx" ON "FleetCommander"("userId");

ALTER TABLE "FleetCommander" ADD CONSTRAINT "FleetCommander_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Fleet" ADD COLUMN "commanderId" TEXT;

CREATE INDEX "Fleet_commanderId_idx" ON "Fleet"("commanderId");

ALTER TABLE "Fleet" ADD CONSTRAINT "Fleet_commanderId_fkey" FOREIGN KEY ("commanderId") REFERENCES "FleetCommander"("id") ON DELETE SET NULL ON UPDATE CASCADE;

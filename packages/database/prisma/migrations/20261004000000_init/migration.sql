-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "bannedUntil" TIMESTAMP(3),
    "banReason" TEXT,
    "bannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "points" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "galaxy" INTEGER NOT NULL,
    "system" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "planetType" TEXT NOT NULL DEFAULT 'normal',
    "metal" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "crystal" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "deuterium" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metalProduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "crystalProduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deuteriumProduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "energyUsed" INTEGER NOT NULL DEFAULT 0,
    "energyAvailable" INTEGER NOT NULL DEFAULT 0,
    "fieldsUsed" INTEGER NOT NULL DEFAULT 0,
    "fieldsMax" INTEGER NOT NULL DEFAULT 163,
    "metalMine" INTEGER NOT NULL DEFAULT 0,
    "crystalMine" INTEGER NOT NULL DEFAULT 0,
    "deuteriumMine" INTEGER NOT NULL DEFAULT 0,
    "solarPlant" INTEGER NOT NULL DEFAULT 0,
    "fusionPlant" INTEGER NOT NULL DEFAULT 0,
    "roboticsFactory" INTEGER NOT NULL DEFAULT 0,
    "naniteFactory" INTEGER NOT NULL DEFAULT 0,
    "shipyard" INTEGER NOT NULL DEFAULT 0,
    "metalStorage" INTEGER NOT NULL DEFAULT 0,
    "crystalStorage" INTEGER NOT NULL DEFAULT 0,
    "deuteriumStorage" INTEGER NOT NULL DEFAULT 0,
    "researchLab" INTEGER NOT NULL DEFAULT 0,
    "terraformer" INTEGER NOT NULL DEFAULT 0,
    "allianceDepot" INTEGER NOT NULL DEFAULT 0,
    "missileSilo" INTEGER NOT NULL DEFAULT 0,
    "moonBase" INTEGER NOT NULL DEFAULT 0,
    "phalanx" INTEGER NOT NULL DEFAULT 0,
    "jumpGate" INTEGER NOT NULL DEFAULT 0,
    "lastUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Planet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildQueue" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "buildingId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "paidCost" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technology" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "techId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Technology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "techId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "paidCost" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ship" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "shipId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Ship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipQueue" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "shipId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "paidCost" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Defense" (
    "id" TEXT NOT NULL,
    "planetId" TEXT NOT NULL,
    "defenseId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Defense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fleet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromGalaxy" INTEGER NOT NULL,
    "fromSystem" INTEGER NOT NULL,
    "fromPosition" INTEGER NOT NULL,
    "toGalaxy" INTEGER NOT NULL,
    "toSystem" INTEGER NOT NULL,
    "toPosition" INTEGER NOT NULL,
    "mission" INTEGER NOT NULL,
    "ships" JSONB NOT NULL,
    "cargo" JSONB NOT NULL DEFAULT '{}',
    "startTime" TIMESTAMP(3) NOT NULL,
    "arrivalTime" TIMESTAMP(3) NOT NULL,
    "returnTime" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fleet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CombatReport" (
    "id" TEXT NOT NULL,
    "attackerId" TEXT NOT NULL,
    "defenderId" TEXT NOT NULL,
    "attackerShips" JSONB NOT NULL,
    "defenderShips" JSONB NOT NULL,
    "defenderDefs" JSONB NOT NULL,
    "attackerLosses" JSONB NOT NULL,
    "defenderLosses" JSONB NOT NULL,
    "result" TEXT NOT NULL,
    "rounds" INTEGER NOT NULL DEFAULT 1,
    "timeline" JSONB NOT NULL,
    "loot" JSONB NOT NULL,
    "debris" JSONB NOT NULL,
    "galaxy" INTEGER NOT NULL,
    "system" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CombatReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alliance" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "founderId" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllianceMember" (
    "id" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllianceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "GameConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBanLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBanLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_lastActive_idx" ON "User"("lastActive");

-- CreateIndex
CREATE INDEX "User_points_idx" ON "User"("points");

-- CreateIndex
CREATE INDEX "User_rank_idx" ON "User"("rank");

-- CreateIndex
CREATE INDEX "Planet_userId_idx" ON "Planet"("userId");

-- CreateIndex
CREATE INDEX "Planet_galaxy_system_idx" ON "Planet"("galaxy", "system");

-- CreateIndex
CREATE INDEX "Planet_userId_galaxy_system_position_idx" ON "Planet"("userId", "galaxy", "system", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Planet_galaxy_system_position_key" ON "Planet"("galaxy", "system", "position");

-- CreateIndex
CREATE INDEX "BuildQueue_planetId_idx" ON "BuildQueue"("planetId");

-- CreateIndex
CREATE INDEX "BuildQueue_endTime_idx" ON "BuildQueue"("endTime");

-- CreateIndex
CREATE INDEX "BuildQueue_planetId_completed_idx" ON "BuildQueue"("planetId", "completed");

-- CreateIndex
CREATE INDEX "BuildQueue_completed_endTime_idx" ON "BuildQueue"("completed", "endTime");

-- CreateIndex
CREATE INDEX "Technology_userId_idx" ON "Technology"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Technology_userId_techId_key" ON "Technology"("userId", "techId");

-- CreateIndex
CREATE INDEX "ResearchQueue_userId_idx" ON "ResearchQueue"("userId");

-- CreateIndex
CREATE INDEX "ResearchQueue_planetId_idx" ON "ResearchQueue"("planetId");

-- CreateIndex
CREATE INDEX "ResearchQueue_endTime_idx" ON "ResearchQueue"("endTime");

-- CreateIndex
CREATE INDEX "ResearchQueue_userId_completed_idx" ON "ResearchQueue"("userId", "completed");

-- CreateIndex
CREATE INDEX "ResearchQueue_completed_endTime_idx" ON "ResearchQueue"("completed", "endTime");

-- CreateIndex
CREATE INDEX "Ship_planetId_idx" ON "Ship"("planetId");

-- CreateIndex
CREATE UNIQUE INDEX "Ship_planetId_shipId_key" ON "Ship"("planetId", "shipId");

-- CreateIndex
CREATE INDEX "ShipQueue_planetId_idx" ON "ShipQueue"("planetId");

-- CreateIndex
CREATE INDEX "ShipQueue_endTime_idx" ON "ShipQueue"("endTime");

-- CreateIndex
CREATE INDEX "ShipQueue_completed_idx" ON "ShipQueue"("completed");

-- CreateIndex
CREATE INDEX "ShipQueue_planetId_completed_idx" ON "ShipQueue"("planetId", "completed");

-- CreateIndex
CREATE INDEX "ShipQueue_completed_endTime_idx" ON "ShipQueue"("completed", "endTime");

-- CreateIndex
CREATE INDEX "Defense_planetId_idx" ON "Defense"("planetId");

-- CreateIndex
CREATE UNIQUE INDEX "Defense_planetId_defenseId_key" ON "Defense"("planetId", "defenseId");

-- CreateIndex
CREATE INDEX "Fleet_userId_idx" ON "Fleet"("userId");

-- CreateIndex
CREATE INDEX "Fleet_arrivalTime_idx" ON "Fleet"("arrivalTime");

-- CreateIndex
CREATE INDEX "Fleet_returnTime_idx" ON "Fleet"("returnTime");

-- CreateIndex
CREATE INDEX "Fleet_status_idx" ON "Fleet"("status");

-- CreateIndex
CREATE INDEX "Fleet_userId_status_idx" ON "Fleet"("userId", "status");

-- CreateIndex
CREATE INDEX "Fleet_status_arrivalTime_idx" ON "Fleet"("status", "arrivalTime");

-- CreateIndex
CREATE INDEX "Fleet_status_returnTime_idx" ON "Fleet"("status", "returnTime");

-- CreateIndex
CREATE INDEX "CombatReport_attackerId_idx" ON "CombatReport"("attackerId");

-- CreateIndex
CREATE INDEX "CombatReport_defenderId_idx" ON "CombatReport"("defenderId");

-- CreateIndex
CREATE INDEX "CombatReport_createdAt_idx" ON "CombatReport"("createdAt");

-- CreateIndex
CREATE INDEX "CombatReport_attackerId_createdAt_idx" ON "CombatReport"("attackerId", "createdAt");

-- CreateIndex
CREATE INDEX "CombatReport_defenderId_createdAt_idx" ON "CombatReport"("defenderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Alliance_tag_key" ON "Alliance"("tag");

-- CreateIndex
CREATE INDEX "Alliance_tag_idx" ON "Alliance"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "AllianceMember_userId_key" ON "AllianceMember"("userId");

-- CreateIndex
CREATE INDEX "AllianceMember_allianceId_idx" ON "AllianceMember"("allianceId");

-- CreateIndex
CREATE INDEX "AllianceMember_userId_idx" ON "AllianceMember"("userId");

-- CreateIndex
CREATE INDEX "Message_toId_read_idx" ON "Message"("toId", "read");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "Message_toId_createdAt_idx" ON "Message"("toId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameConfig_key_key" ON "GameConfig"("key");

-- CreateIndex
CREATE INDEX "GameConfig_key_idx" ON "GameConfig"("key");

-- CreateIndex
CREATE INDEX "AdminAuditLog_userId_idx" ON "AdminAuditLog"("userId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "UserBanLog_userId_idx" ON "UserBanLog"("userId");

-- CreateIndex
CREATE INDEX "UserBanLog_actorId_idx" ON "UserBanLog"("actorId");

-- CreateIndex
CREATE INDEX "UserBanLog_createdAt_idx" ON "UserBanLog"("createdAt");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- AddForeignKey
ALTER TABLE "Planet" ADD CONSTRAINT "Planet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildQueue" ADD CONSTRAINT "BuildQueue_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technology" ADD CONSTRAINT "Technology_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchQueue" ADD CONSTRAINT "ResearchQueue_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ship" ADD CONSTRAINT "Ship_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipQueue" ADD CONSTRAINT "ShipQueue_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defense" ADD CONSTRAINT "Defense_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "Planet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fleet" ADD CONSTRAINT "Fleet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllianceMember" ADD CONSTRAINT "AllianceMember_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllianceMember" ADD CONSTRAINT "AllianceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBanLog" ADD CONSTRAINT "UserBanLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBanLog" ADD CONSTRAINT "UserBanLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


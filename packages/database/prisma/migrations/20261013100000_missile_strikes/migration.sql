-- Missiles interplanétaires : frappes en vol puis résolues
CREATE TABLE "MissileStrike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "fromGalaxy" INTEGER NOT NULL,
    "fromSystem" INTEGER NOT NULL,
    "fromPosition" INTEGER NOT NULL,
    "toGalaxy" INTEGER NOT NULL,
    "toSystem" INTEGER NOT NULL,
    "toPosition" INTEGER NOT NULL,
    "missiles" INTEGER NOT NULL,
    "primaryTarget" INTEGER,
    "startTime" TIMESTAMP(3) NOT NULL,
    "arrivalTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'traveling',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissileStrike_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MissileStrike_status_arrivalTime_idx" ON "MissileStrike"("status", "arrivalTime");
CREATE INDEX "MissileStrike_userId_createdAt_idx" ON "MissileStrike"("userId", "createdAt");
CREATE INDEX "MissileStrike_targetUserId_createdAt_idx" ON "MissileStrike"("targetUserId", "createdAt");

ALTER TABLE "MissileStrike" ADD CONSTRAINT "MissileStrike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissileStrike" ADD CONSTRAINT "MissileStrike_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

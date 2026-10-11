-- Supervision locale : journal des incidents regroupés par empreinte
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "errorType" TEXT,
    "operation" TEXT,
    "httpStatus" INTEGER,
    "userId" TEXT,
    "planetId" TEXT,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'new',
    "version" TEXT,
    "commit" TEXT,
    "context" JSONB,
    "stack" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Incident_fingerprint_key" ON "Incident"("fingerprint");
CREATE INDEX "Incident_status_lastSeen_idx" ON "Incident"("status", "lastSeen");
CREATE INDEX "Incident_level_lastSeen_idx" ON "Incident"("level", "lastSeen");
CREATE INDEX "Incident_source_lastSeen_idx" ON "Incident"("source", "lastSeen");
CREATE INDEX "Incident_lastSeen_idx" ON "Incident"("lastSeen");

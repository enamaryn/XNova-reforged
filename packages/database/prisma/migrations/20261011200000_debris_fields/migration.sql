-- Champs de débris (mission de recyclage)
CREATE TABLE "DebrisField" (
    "id" TEXT NOT NULL,
    "galaxy" INTEGER NOT NULL,
    "system" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "metal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "crystal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebrisField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DebrisField_galaxy_system_position_key" ON "DebrisField"("galaxy", "system", "position");
CREATE INDEX "DebrisField_galaxy_system_idx" ON "DebrisField"("galaxy", "system");

-- Lunes : une lune est une ligne Planet (isMoon) qui partage les coordonnées de sa planète
ALTER TABLE "Planet" ADD COLUMN "isMoon" BOOLEAN NOT NULL DEFAULT false;
DROP INDEX "Planet_galaxy_system_position_key";
CREATE UNIQUE INDEX "Planet_galaxy_system_position_isMoon_key" ON "Planet"("galaxy", "system", "position", "isMoon");

-- Flottes au départ ou à destination d'une lune
ALTER TABLE "Fleet" ADD COLUMN "fromMoon" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Fleet" ADD COLUMN "toMoon" BOOLEAN NOT NULL DEFAULT false;

-- Rapport de combat : une lune est née
ALTER TABLE "CombatReport" ADD COLUMN "moonCreated" BOOLEAN NOT NULL DEFAULT false;

-- SETUP-01 : les serveurs déjà en service (au moins un compte de joueur) n'ont pas à repasser par le parcours
-- d'installation : il est marqué terminé. Une base sans joueur (nouvelle installation) reste à installer.
-- Le compte système « __abandoned__ » (semis de la galaxie) n'est pas un joueur.
INSERT INTO "GameConfig" ("id", "key", "value")
SELECT gen_random_uuid()::text, 'setup.completedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE EXISTS (SELECT 1 FROM "User" WHERE "username" <> '__abandoned__')
ON CONFLICT ("key") DO NOTHING;

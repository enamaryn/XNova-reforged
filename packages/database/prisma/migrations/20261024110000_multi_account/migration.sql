-- Doubles comptes : email canonique, adresses IP vues par compte, exemptions décidées par un administrateur
ALTER TABLE "User" ADD COLUMN "emailCanonical" TEXT;

UPDATE "User" u
SET "emailCanonical" = c."local" || '@' || c."domain"
FROM (
    SELECT s."id",
           CASE WHEN s."d" = 'gmail.com' THEN replace(s."l", '.', '') ELSE s."l" END AS "local",
           s."d" AS "domain"
    FROM (
        SELECT "id",
               CASE WHEN split_part(lower(trim("email")), '@', 2) = 'googlemail.com' THEN 'gmail.com'
                    ELSE split_part(lower(trim("email")), '@', 2) END AS "d",
               split_part(split_part(lower(trim("email")), '@', 1), '+', 1) AS "l"
        FROM "User"
    ) s
) c
WHERE u."id" = c."id";

CREATE INDEX "User_emailCanonical_idx" ON "User"("emailCanonical");

CREATE TABLE "AccountIp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hits" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AccountIp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountIp_userId_ip_key" ON "AccountIp"("userId", "ip");
CREATE INDEX "AccountIp_ip_lastSeenAt_idx" ON "AccountIp"("ip", "lastSeenAt");
CREATE INDEX "AccountIp_lastSeenAt_idx" ON "AccountIp"("lastSeenAt");

ALTER TABLE "AccountIp" ADD CONSTRAINT "AccountIp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AccountLinkExemption" (
    "id" TEXT NOT NULL,
    "userA" TEXT NOT NULL,
    "userB" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountLinkExemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountLinkExemption_userA_userB_key" ON "AccountLinkExemption"("userA", "userB");

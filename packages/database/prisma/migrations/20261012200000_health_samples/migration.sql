-- Mesure de disponibilité (supervision locale) : un échantillon de santé par minute
CREATE TABLE "HealthSample" (
    "at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "failing" TEXT,
    "version" TEXT,

    CONSTRAINT "HealthSample_pkey" PRIMARY KEY ("at")
);

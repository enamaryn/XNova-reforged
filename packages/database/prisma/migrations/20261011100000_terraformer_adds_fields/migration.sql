-- Le terraformeur ajoute désormais 5 cases par niveau et n'occupe plus de case (il n'avait aucun effet et en
-- consommait une par niveau). Les planètes qui en possèdent déjà reçoivent les cases correspondantes.
UPDATE "Planet"
SET "fieldsMax" = "fieldsMax" + 5 * "terraformer",
    "fieldsUsed" = GREATEST(0, "fieldsUsed" - "terraformer")
WHERE "terraformer" > 0;

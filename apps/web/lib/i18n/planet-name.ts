/** Noms par défaut créés par le serveur (en français) : affichés dans la langue du joueur. */
const DEFAULT_NAMES: Record<string, string> = {
  "Planète Mère": "planet.homeworld",
  "Nouvelle colonie": "planet.newColony",
};

/** Un nom choisi par le joueur est affiché tel quel ; seuls les noms par défaut sont traduits. */
export function planetDisplayName(
  name: string | null | undefined,
  t: (key: string) => string,
): string {
  if (!name) return t("overview.planet");
  const key = DEFAULT_NAMES[name];
  return key ? t(key) : name;
}

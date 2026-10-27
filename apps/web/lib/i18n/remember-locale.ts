import { useAuthStore } from "@/lib/stores/auth-store";
import { apiClient } from "@/lib/api/client";
import { persistLocaleCookie, type Locale } from "./locale";

/**
 * Mémorise le choix de langue : cookie (lu par le proxy) et, si le joueur est connecté, son compte
 * (les emails et textes du serveur suivent sa langue). L'échec réseau n'empêche pas le changement d'affichage.
 */
export function rememberLocaleChoice(next: Locale) {
  persistLocaleCookie(next);
  if (useAuthStore.getState().tokens?.accessToken) {
    void apiClient.put("/auth/locale", { locale: next }).catch(() => undefined);
  }
}

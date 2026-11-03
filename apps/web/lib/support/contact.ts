/**
 * Coordonnées du support, lues dans l'environnement du serveur web à chaque requête :
 * `LEGAL_CONTACT` (adresse email, déjà utilisée par les textes légaux) et `SUPPORT_URL` (salon de la communauté,
 * lien https:// seulement : tout autre schéma est ignoré).
 */
export interface SupportContact {
  contact: string | null;
  contactIsEmail: boolean;
  communityUrl: string | null;
}

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export function readSupportContact(env: Record<string, string | undefined> = process.env): SupportContact {
  const contact = env.LEGAL_CONTACT?.trim() || null;
  let communityUrl: string | null = null;
  const raw = env.SUPPORT_URL?.trim();
  if (raw) {
    try {
      const url = new URL(raw);
      if (url.protocol === "https:") communityUrl = url.toString();
    } catch {
      // Valeur invalide : aucun lien affiché
    }
  }
  return { contact, contactIsEmail: !!contact && EMAIL.test(contact), communityUrl };
}

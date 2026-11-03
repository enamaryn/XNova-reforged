import { readFile } from "node:fs/promises";
import path from "node:path";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

export type LegalDocument = "terms" | "privacy";

/** Texte affiché tant que l'administrateur n'a pas renseigné LEGAL_OPERATOR_NAME / LEGAL_CONTACT. */
const MISSING: Record<Locale, { operator: string; contact: string }> = {
  fr: { operator: "l'administrateur du serveur (nom non renseigné)", contact: "adresse de contact non renseignée" },
  en: { operator: "the server administrator (name not provided)", contact: "contact address not provided" },
  es: { operator: "el administrador del servidor (nombre no indicado)", contact: "dirección de contacto no indicada" },
  de: { operator: "der Serveradministrator (Name nicht angegeben)", contact: "Kontaktadresse nicht angegeben" },
  it: { operator: "l'amministratore del server (nome non indicato)", contact: "indirizzo di contatto non indicato" },
};

/** Remplace les marqueurs {{OPERATOR}}, {{CONTACT}} et {{LOCALE}} du modèle. */
export function fillLegalTemplate(
  template: string,
  locale: Locale,
  env: Record<string, string | undefined> = process.env,
): string {
  const operator = env.LEGAL_OPERATOR_NAME?.trim() || MISSING[locale].operator;
  const contact = env.LEGAL_CONTACT?.trim() || MISSING[locale].contact;
  return template.replaceAll("{{OPERATOR}}", operator).replaceAll("{{CONTACT}}", contact).replaceAll("{{LOCALE}}", locale);
}

/** Conditions d'utilisation ou politique de confidentialité, dans la langue demandée (`content/legal/<document>.<langue>.md`). */
export async function loadLegal(document: LegalDocument, locale: string): Promise<{ locale: Locale; markdown: string; title: string }> {
  const safe: Locale = (locales as readonly string[]).includes(locale) ? (locale as Locale) : defaultLocale;
  const file = path.join(process.cwd(), "content", "legal", `${document}.${safe}.md`);
  const markdown = fillLegalTemplate(await readFile(file, "utf8"), safe);
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() ?? document;
  return { locale: safe, markdown, title };
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

/** Contenu de la FAQ par langue : copie de `docs/FAQ*.md` synchronisée par `scripts/faq/sync-faq.mjs`. */
export async function loadFaq(locale: string): Promise<{ locale: Locale; markdown: string; title: string }> {
  const safe: Locale = (locales as readonly string[]).includes(locale) ? (locale as Locale) : defaultLocale;
  const file = path.join(process.cwd(), "content", "faq", `${safe}.md`);
  const markdown = await readFile(file, "utf8");
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() ?? "FAQ";
  return { locale: safe, markdown, title };
}

import { FaqDocument } from "@/components/faq/FaqDocument";
import { locales } from "@/i18n/config";
import { loadFaq } from "@/lib/faq/content";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { title } = await loadFaq(locale);
  return { title: `${title} — XNova Reforged` };
}

/** FAQ publique : accessible sans être connecté. */
export default async function PublicFaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { markdown } = await loadFaq(locale);
  return <FaqDocument markdown={markdown} section="faq" />;
}

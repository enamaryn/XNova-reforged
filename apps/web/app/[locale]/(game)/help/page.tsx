import { FaqDocument } from "@/components/faq/FaqDocument";
import { loadFaq } from "@/lib/faq/content";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { title } = await loadFaq(locale);
  return { title: `${title} — XNova Reforged` };
}

/** Même FAQ, affichée dans le cadre du jeu (menu de gauche) pour les joueurs connectés. */
export default async function GameFaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { markdown } = await loadFaq(locale);
  return <FaqDocument markdown={markdown} section="help" />;
}

import { FaqDocument } from "@/components/faq/FaqDocument";
import { loadLegal } from "@/lib/legal/content";

// Lit LEGAL_OPERATOR_NAME / LEGAL_CONTACT à chaque requête, pas à la compilation.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { title } = await loadLegal("terms", locale);
  return { title: `${title} — XNova Reforged` };
}

/** Page publique, accessible sans être connecté. */
export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { markdown } = await loadLegal("terms", locale);
  return <FaqDocument markdown={markdown} section="faq" testId="legal-document" />;
}

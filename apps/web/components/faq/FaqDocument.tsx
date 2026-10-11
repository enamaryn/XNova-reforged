import { renderMarkdown } from "@/lib/faq/markdown";

/** Document de la FAQ ; `section` est le segment d'URL (`faq` public, `help` dans le jeu). */
export function FaqDocument({ markdown, section }: { markdown: string; section: "faq" | "help" }) {
  return (
    <article data-testid="faq-document" className="mx-auto w-full max-w-4xl px-4 py-8 text-base sm:px-6 sm:py-12">
      {renderMarkdown(markdown, section)}
    </article>
  );
}

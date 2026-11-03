import { SupportPage } from "@/components/support/SupportPage";
import { readSupportContact } from "@/lib/support/contact";

// Lit LEGAL_CONTACT / SUPPORT_URL à chaque requête, pas à la compilation.
export const dynamic = "force-dynamic";

export const metadata = { title: "Support — XNova Reforged" };

/** Même page de support, dans le cadre du jeu (menu de gauche). */
export default function SupportGamePage() {
  return <SupportPage contact={readSupportContact()} variant="game" />;
}

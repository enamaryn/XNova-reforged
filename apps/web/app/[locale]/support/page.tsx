import { SupportPage } from "@/components/support/SupportPage";
import { readSupportContact } from "@/lib/support/contact";

// Lit LEGAL_CONTACT / SUPPORT_URL à chaque requête, pas à la compilation.
export const dynamic = "force-dynamic";

export const metadata = { title: "Support — XNova Reforged" };

/** Page de support publique (sans connexion). */
export default function SupportPublicPage() {
  return <SupportPage contact={readSupportContact()} variant="public" />;
}

import Link from "next/link";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <AuthHeader
        eyebrow="Récupération"
        title="Mot de passe oublié."
        subtitle="Indiquez l'adresse email de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe."
      />
      <ForgotPasswordForm />
      <Link href="/login" className="text-sm font-semibold text-slate-900">
        Retour à la connexion
      </Link>
    </div>
  );
}

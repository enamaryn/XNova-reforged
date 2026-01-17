import Link from "next/link";
import { AuthHeader } from "@/components/auth/AuthHeader";

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <AuthHeader
        eyebrow="Recuperation"
        title="Mot de passe oublie."
        subtitle="Le module de recuperation sera disponible prochainement."
      />
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-500">
        En attendant, contactez l'equipe pour reinitialiser votre acces.
      </div>
      <Link href="/login" className="text-sm font-semibold text-slate-900">
        Retour a la connexion
      </Link>
    </div>
  );
}

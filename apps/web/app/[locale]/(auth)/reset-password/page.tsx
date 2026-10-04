import { Suspense } from "react";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <AuthHeader
        eyebrow="Récupération"
        title="Nouveau mot de passe."
        subtitle="Choisissez un mot de passe d'au moins 8 caractères avec une minuscule, une majuscule et un chiffre."
      />
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}

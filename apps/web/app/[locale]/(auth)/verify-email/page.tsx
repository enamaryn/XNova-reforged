import { Suspense } from "react";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { VerifyEmail } from "@/components/auth/VerifyEmail";

export default function VerifyEmailPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <AuthHeader eyebrow="Compte" title="Confirmation de l'adresse email." />
      <Suspense fallback={null}>
        <VerifyEmail />
      </Suspense>
    </div>
  );
}

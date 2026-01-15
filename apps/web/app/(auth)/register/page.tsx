import Link from "next/link";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <AuthHeader
        eyebrow="Inscription"
        title="Fonder une nouvelle colonie."
        subtitle="Rejoignez l'univers XNova avec votre premier avant-poste."
      />
      <RegisterForm />
      <p className="text-sm text-slate-500">
        Deja un compte ?{" "}
        <Link href="/login" className="font-semibold text-slate-900">
          Se connecter
        </Link>
      </p>
    </div>
  );
}

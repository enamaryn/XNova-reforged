import Link from "next/link";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <AuthHeader
        eyebrow="Authentification"
        title="Reprendre le controle."
        subtitle="Accedez a votre commandement et coordonnez vos flottes."
      />
      <LoginForm />
      <p className="text-sm text-slate-500">
        Nouveau commandant ?{" "}
        <Link href="/register" className="font-semibold text-slate-900">
          Creer un compte
        </Link>
      </p>
    </div>
  );
}

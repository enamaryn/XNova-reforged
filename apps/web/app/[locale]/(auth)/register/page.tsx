import Link from "next/link";
import { useTranslations } from 'next-intl';
import { AuthHeader } from "@/components/auth/AuthHeader";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  const t = useTranslations('auth.register');

  return (
    <div className="space-y-5 sm:space-y-6">
      <AuthHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
      />
      <RegisterForm />
      <p className="text-sm text-slate-500">
        {t('alreadyHaveAccount')}{" "}
        <Link href="/login" className="font-semibold text-slate-900">
          {t('loginLink')}
        </Link>
      </p>
    </div>
  );
}

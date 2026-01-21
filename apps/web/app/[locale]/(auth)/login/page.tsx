import Link from "next/link";
import { useTranslations } from 'next-intl';
import { AuthHeader } from "@/components/auth/AuthHeader";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  const t = useTranslations('auth.login');

  return (
    <div className="space-y-5 sm:space-y-6">
      <AuthHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
      />
      <LoginForm />
      <p className="text-sm text-slate-500">
        {t('newCommander')}{" "}
        <Link href="/register" className="font-semibold text-slate-900">
          {t('createAccount')}
        </Link>
      </p>
    </div>
  );
}

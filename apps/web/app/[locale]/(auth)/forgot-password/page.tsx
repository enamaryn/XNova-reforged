import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recovery" });
  return (
    <div className="space-y-5 sm:space-y-6">
      <AuthHeader
        eyebrow={t("eyebrow")}
        title={t("forgotTitle")}
        subtitle={t("forgotSubtitle")}
      />
      <ForgotPasswordForm />
      <Link href="/login" className="text-sm font-semibold text-slate-900">
        {t("backToLogin")}
      </Link>
    </div>
  );
}

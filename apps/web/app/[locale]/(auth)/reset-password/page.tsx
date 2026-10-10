import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage({
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
        title={t("resetTitle")}
        subtitle={t("resetSubtitle")}
      />
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}

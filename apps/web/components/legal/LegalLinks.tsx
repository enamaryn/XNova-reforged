"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

/** Liens vers les conditions d'utilisation et la politique de confidentialité (pied de page). */
export function LegalLinks() {
  const { t } = useI18n();
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1 normal-case tracking-normal" data-testid="legal-links">
      <Link href="/terms" className="underline-offset-2 hover:underline">
        {t("legal.terms")}
      </Link>
      <Link href="/privacy" className="underline-offset-2 hover:underline">
        {t("legal.privacy")}
      </Link>
    </span>
  );
}

/** Mention affichée sous le bouton d'inscription. */
export function LegalAcceptNotice() {
  const { t } = useI18n();
  return (
    <p className="text-center text-xs text-slate-500" data-testid="legal-accept-notice">
      {t("legal.acceptPrefix")}{" "}
      <Link href="/terms" className="underline underline-offset-2" target="_blank">
        {t("legal.terms")}
      </Link>
      {t("legal.acceptAnd")}
      <Link href="/privacy" className="underline underline-offset-2" target="_blank">
        {t("legal.privacy")}
      </Link>
      .
    </p>
  );
}

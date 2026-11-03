"use client";

import Link from "next/link";
import type { UseFormRegisterReturn } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { acceptTerms, getMe } from "@/lib/api/auth";

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

/** Case à cocher d'inscription : l'acceptation des deux textes est obligatoire et enregistrée avec le compte. */
export function LegalAcceptCheckbox({
  inputProps,
  error,
}: {
  inputProps: UseFormRegisterReturn;
  error?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-1" data-testid="legal-accept-notice">
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" id="acceptTerms" className="mt-1 h-4 w-4 shrink-0" {...inputProps} />
        <span>
          {t("legal.acceptPrefix")}{" "}
          <Link href="/terms" className="underline underline-offset-2" target="_blank">
            {t("legal.terms")}
          </Link>
          {t("legal.acceptAnd")}
          <Link href="/privacy" className="underline underline-offset-2" target="_blank">
            {t("legal.privacy")}
          </Link>
          .
        </span>
      </label>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

/**
 * Bandeau des joueurs dont les textes en vigueur ne sont pas acceptés (comptes antérieurs, ou textes révisés) :
 * un clic enregistre l'acceptation.
 */
export function TermsAcceptanceBanner() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["auth-me"], queryFn: getMe });
  const accept = useMutation({
    mutationFn: acceptTerms,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth-me"] }),
  });
  if (!me.data || me.data.termsCurrent !== false) return null;
  return (
    <section
      role="region"
      aria-label={t("legal.acceptTitle")}
      data-testid="terms-banner"
      className="mx-4 mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100"
    >
      <h2 className="font-semibold">{t("legal.acceptTitle")}</h2>
      <p className="mt-1 text-amber-100/90">{t("legal.acceptBody")}</p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/terms" target="_blank" className="underline underline-offset-2">
          {t("legal.terms")}
        </Link>
        <Link href="/privacy" target="_blank" className="underline underline-offset-2">
          {t("legal.privacy")}
        </Link>
      </p>
      <button
        type="button"
        data-testid="terms-accept"
        disabled={accept.isPending}
        onClick={() => accept.mutate()}
        className="mt-3 rounded-full border border-amber-300/60 px-5 py-2 text-xs uppercase tracking-[0.2em] hover:bg-amber-400/20 disabled:opacity-50"
      >
        {t("legal.acceptButton")}
      </button>
      {accept.isError ? <p className="mt-2 text-rose-300">{t("legal.acceptError")}</p> : null}
    </section>
  );
}

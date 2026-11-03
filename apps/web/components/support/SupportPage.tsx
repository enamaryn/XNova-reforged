"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import {
  SUPPORT_KINDS,
  SUPPORT_LIMITS,
  supportApi,
  type SupportKind,
} from "@/lib/api/support";
import type { SupportContact } from "@/lib/support/contact";
import { buildVersionLabel } from "@/lib/build-version";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useI18n } from "@/lib/i18n";

const THEMES = {
  public: {
    card: "rounded-3xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6",
    field: "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm ${th.heading} outline-hidden focus:border-blue-500",
    heading: "${th.heading}",
    text: "${th.text}",
    muted: "${th.muted}",
    subtle: "${th.subtle}",
    divider: "divide-slate-100",
    reply: "bg-sky-50",
    button: "bg-slate-900 text-white",
    ok: "text-emerald-700",
    error: "text-rose-700",
  },
  game: {
    card: "rounded-3xl border border-slate-800/80 bg-slate-950/60 p-4 sm:p-6",
    field: "w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60",
    heading: "text-white",
    text: "text-slate-200",
    muted: "${th.subtle}",
    subtle: "${th.muted}",
    divider: "divide-slate-800",
    reply: "bg-sky-500/10",
    button: "border border-blue-500/60 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20",
    ok: "text-emerald-300",
    error: "text-rose-300",
  },
} as const;

const STATUS_STYLE = {
  new: "bg-sky-100 text-sky-800",
  seen: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  ignored: "bg-slate-100 ${th.muted}",
} as const;

/** Page de support : coordonnées, conseils, formulaire de signalement et suivi des signalements du joueur. */
export function SupportPage({ contact, variant = "public" }: { contact: SupportContact; variant?: "public" | "game" }) {
  const th = THEMES[variant];
  const card = th.card;
  const field = th.field;
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const loggedIn = useAuthStore((state) => !!state.tokens?.accessToken);
  const [form, setForm] = useState({ kind: "bug" as SupportKind, subject: "", body: "" });
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const mine = useQuery({ queryKey: ["support-mine"], queryFn: supportApi.mine, enabled: loggedIn });
  const send = useMutation({
    mutationFn: () =>
      supportApi.create({
        kind: form.kind,
        subject: form.subject.trim(),
        body: form.body.trim(),
        pagePath: window.location.pathname,
        appVersion: buildVersionLabel,
      }),
    onSuccess: async () => {
      setForm((prev) => ({ ...prev, subject: "", body: "" }));
      setNotice({ kind: "ok", text: t("support.sent") });
      await queryClient.invalidateQueries({ queryKey: ["support-mine"] });
    },
    onError: (error) =>
      setNotice({ kind: "error", text: error instanceof ApiError ? error.message : t("support.errorGeneric") }),
  });

  const valid =
    form.subject.trim().length >= SUPPORT_LIMITS.subjectMin && form.body.trim().length >= SUPPORT_LIMITS.bodyMin;

  return (
    <article className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 text-base sm:px-6 sm:py-12" data-testid="support-page">
      <header className="space-y-2">
        <h1 className={`text-2xl font-semibold ${th.heading}`}>{t("support.title")}</h1>
        <p className={`text-sm ${th.muted}`}>{t("support.intro")}</p>
      </header>

      <section className={card} data-testid="support-contact">
        <h2 className={`text-lg font-semibold ${th.heading}`}>{t("support.contactTitle")}</h2>
        {contact.contact ? (
          <p className={`mt-2 text-sm ${th.text}`}>
            {t("support.contactLabel")} :{" "}
            {contact.contactIsEmail ? (
              <a className="font-semibold underline underline-offset-2" href={`mailto:${contact.contact}`}>
                {contact.contact}
              </a>
            ) : (
              <strong>{contact.contact}</strong>
            )}
          </p>
        ) : (
          <p className={`mt-2 text-sm ${th.muted}`}>{t("support.contactNone")}</p>
        )}
        {contact.communityUrl ? (
          <p className="mt-2 text-sm">
            <a
              className="font-semibold underline underline-offset-2"
              href={contact.communityUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="support-community"
            >
              {t("support.communityLink")}
            </a>
          </p>
        ) : null}
        <p className={`mt-3 text-sm ${th.muted}`}>
          {t("support.faqPrefix")}{" "}
          <Link href="/faq" className="font-semibold underline underline-offset-2">
            {t("support.faqLink")}
          </Link>
          {t("support.faqSuffix")}
        </p>
      </section>

      <section className={card}>
        <h2 className={`text-lg font-semibold ${th.heading}`}>{t("support.tipsTitle")}</h2>
        <ul className={`mt-2 list-disc space-y-1 pl-5 text-sm ${th.text}`}>
          {(["tip1", "tip2", "tip3", "tip4"] as const).map((key) => (
            <li key={key}>{t(`support.${key}`)}</li>
          ))}
        </ul>
      </section>

      <section className={card} data-testid="support-form-section">
        <h2 className={`text-lg font-semibold ${th.heading}`}>{t("support.formTitle")}</h2>
        {loggedIn ? (
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setNotice(null);
              send.mutate();
            }}
          >
            <label className={`block space-y-1 text-sm ${th.text}`}>
              <span>{t("support.kind")}</span>
              <select
                className={field}
                value={form.kind}
                onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value as SupportKind }))}
                data-testid="support-kind"
              >
                {SUPPORT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`support.kind${kind}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className={`block space-y-1 text-sm ${th.text}`}>
              <span>{t("support.subject")}</span>
              <input
                className={field}
                value={form.subject}
                maxLength={SUPPORT_LIMITS.subjectMax}
                placeholder={t("support.subjectPlaceholder")}
                onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                data-testid="support-subject"
              />
            </label>
            <label className={`block space-y-1 text-sm ${th.text}`}>
              <span>{t("support.body")}</span>
              <textarea
                className={`${field} min-h-36`}
                value={form.body}
                maxLength={SUPPORT_LIMITS.bodyMax}
                placeholder={t("support.bodyPlaceholder")}
                onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
                data-testid="support-body"
              />
              <span className={`block text-right text-xs ${th.subtle}`}>
                {form.body.length} / {SUPPORT_LIMITS.bodyMax}
              </span>
            </label>
            <p className={`text-xs ${th.muted}`}>{t("support.autoNote")}</p>
            <button
              type="submit"
              disabled={!valid || send.isPending}
              className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] disabled:opacity-50 ${th.button}`}
              data-testid="support-submit"
            >
              {send.isPending ? t("support.sending") : t("support.submit")}
            </button>
            {notice ? (
              <p
                role="status"
                data-testid="support-notice"
                className={`text-sm ${notice.kind === "ok" ? th.ok : th.error}`}
              >
                {notice.text}
              </p>
            ) : null}
          </form>
        ) : (
          <p className={`mt-2 text-sm ${th.muted}`} data-testid="support-login">
            {t("support.loginPrompt")}{" "}
            <Link href="/login" className="font-semibold underline underline-offset-2">
              {t("support.loginLink")}
            </Link>
          </p>
        )}
      </section>

      {loggedIn ? (
        <section className={card} data-testid="support-mine">
          <h2 className={`text-lg font-semibold ${th.heading}`}>{t("support.mineTitle")}</h2>
          {mine.data && mine.data.length > 0 ? (
            <ul className={`mt-3 divide-y ${th.divider}`}>
              {mine.data.map((report) => (
                <li key={report.id} className="py-2 text-sm" data-testid={`support-mine-${report.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`min-w-0 flex-1 truncate ${th.text}`}>
                      <span className={`mr-2 text-xs uppercase tracking-wide ${th.subtle}`}>{t(`support.kind${report.kind}`)}</span>
                      {report.subject}
                    </span>
                    <span className={`text-xs ${th.subtle}`}>{new Date(report.createdAt).toLocaleDateString(locale)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[report.status]}`} data-testid={`support-status-${report.status}`}>
                      {t(`support.status${report.status}`)}
                    </span>
                  </div>
                  {report.replies.map((reply) => (
                    <blockquote
                      key={reply.id}
                      className={`mt-2 rounded-xl border-l-4 border-sky-400/60 px-3 py-2 ${th.reply}`}
                      data-testid="support-reply"
                    >
                      <p className={`text-xs ${th.subtle}`}>
                        {t("support.replyTitle")} · {new Date(reply.createdAt).toLocaleDateString(locale)}
                      </p>
                      <p className={`mt-1 whitespace-pre-wrap break-words ${th.text}`}>{reply.body}</p>
                    </blockquote>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <p className={`mt-2 text-sm ${th.muted}`}>{t("support.mineEmpty")}</p>
          )}
        </section>
      ) : null}
    </article>
  );
}

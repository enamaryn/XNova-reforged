"use client";

import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { changeEmail, changePassword, getMe, resendVerification } from "@/lib/api/auth";

const inputClass =
  "w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60";
const labelClass = "text-xs uppercase tracking-[0.2em] text-slate-500";
const buttonClass =
  "rounded-full border border-blue-500/60 bg-blue-500/10 px-5 py-2 text-xs uppercase tracking-[0.2em] text-blue-200 hover:bg-blue-500/20 disabled:opacity-50";

type Notice = { kind: "ok" | "error"; text: string } | null;

function NoticeBox({ notice, testId }: { notice: Notice; testId: string }) {
  if (!notice) return null;
  return (
    <p
      role="status"
      data-testid={testId}
      className={`mt-3 text-xs ${notice.kind === "ok" ? "text-emerald-300" : "text-rose-300"}`}
    >
      {notice.text}
    </p>
  );
}

const messageOf = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

/** Compte : adresse email (statut, changement), mot de passe. */
export function AccountSettings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["auth-me"], queryFn: getMe });

  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdNotice, setPwdNotice] = useState<Notice>(null);
  const [mail, setMail] = useState({ current: "", email: "" });
  const [mailNotice, setMailNotice] = useState<Notice>(null);
  const [verifyNotice, setVerifyNotice] = useState<Notice>(null);

  const pwdMutation = useMutation({
    mutationFn: () => changePassword(pwd.current, pwd.next),
    onSuccess: () => {
      setPwd({ current: "", next: "", confirm: "" });
      setPwdNotice({ kind: "ok", text: t("account.passwordChanged") });
    },
    onError: (error) => setPwdNotice({ kind: "error", text: messageOf(error, t("account.genericError")) }),
  });

  const mailMutation = useMutation({
    mutationFn: () => changeEmail(mail.current, mail.email.trim()),
    onSuccess: (result) => {
      setMail({ current: "", email: "" });
      setMailNotice({ kind: "ok", text: result.message });
    },
    onError: (error) => setMailNotice({ kind: "error", text: messageOf(error, t("account.genericError")) }),
  });

  const resendMutation = useMutation({
    mutationFn: resendVerification,
    onSuccess: (result) => {
      setVerifyNotice({ kind: "ok", text: result.message });
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
    onError: (error) => setVerifyNotice({ kind: "error", text: messageOf(error, t("account.genericError")) }),
  });

  const verified = !!me.data?.emailVerifiedAt;

  return (
    <div className="space-y-6" data-testid="account-settings">
      <div>
        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("account.emailTitle")}</h3>
        <p className="mt-2 text-sm text-slate-200" data-testid="account-email">
          {me.data?.email ?? "…"}{" "}
          {me.data ? (
            <span
              data-testid="email-status"
              className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${
                verified
                  ? "border-emerald-500/50 text-emerald-300"
                  : "border-amber-500/50 text-amber-300"
              }`}
            >
              {verified ? t("account.confirmed") : t("account.notConfirmed")}
            </span>
          ) : null}
        </p>
        {me.data && !verified ? (
          <div className="mt-3">
            <button
              type="button"
              className={buttonClass}
              disabled={resendMutation.isPending}
              onClick={() => {
                setVerifyNotice(null);
                resendMutation.mutate();
              }}
            >
              {t("account.resend")}
            </button>
            <NoticeBox notice={verifyNotice} testId="verify-notice" />
          </div>
        ) : null}
      </div>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setMailNotice(null);
          mailMutation.mutate();
        }}
      >
        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("account.changeEmailTitle")}</h3>
        <label className="block space-y-1">
          <span className={labelClass}>{t("account.newAddress")}</span>
          <input
            className={inputClass}
            type="email"
            required
            value={mail.email}
            onChange={(event) => setMail((prev) => ({ ...prev, email: event.target.value }))}
            aria-label={t("account.newAddressAria")}
          />
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>{t("account.currentPassword")}</span>
          <input
            className={inputClass}
            type="password"
            required
            autoComplete="current-password"
            value={mail.current}
            onChange={(event) => setMail((prev) => ({ ...prev, current: event.target.value }))}
            aria-label={t("account.currentPasswordMailAria")}
          />
        </label>
        <button type="submit" className={buttonClass} disabled={mailMutation.isPending}>
          {t("account.sendConfirmation")}
        </button>
        <NoticeBox notice={mailNotice} testId="email-notice" />
      </form>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setPwdNotice(null);
          if (pwd.next !== pwd.confirm) {
            setPwdNotice({ kind: "error", text: t("account.mismatch") });
            return;
          }
          pwdMutation.mutate();
        }}
      >
        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("account.changePasswordTitle")}</h3>
        <label className="block space-y-1">
          <span className={labelClass}>{t("account.currentPassword")}</span>
          <input
            className={inputClass}
            type="password"
            required
            autoComplete="current-password"
            value={pwd.current}
            onChange={(event) => setPwd((prev) => ({ ...prev, current: event.target.value }))}
            aria-label={t("account.currentPassword")}
          />
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>{t("account.newPassword")}</span>
          <input
            className={inputClass}
            type="password"
            required
            autoComplete="new-password"
            value={pwd.next}
            onChange={(event) => setPwd((prev) => ({ ...prev, next: event.target.value }))}
            aria-label={t("account.newPassword")}
          />
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>{t("account.confirmation")}</span>
          <input
            className={inputClass}
            type="password"
            required
            autoComplete="new-password"
            value={pwd.confirm}
            onChange={(event) => setPwd((prev) => ({ ...prev, confirm: event.target.value }))}
            aria-label={t("account.confirmationAria")}
          />
        </label>
        <button type="submit" className={buttonClass} disabled={pwdMutation.isPending}>
          {t("account.changePassword")}
        </button>
        <NoticeBox notice={pwdNotice} testId="password-notice" />
      </form>
    </div>
  );
}

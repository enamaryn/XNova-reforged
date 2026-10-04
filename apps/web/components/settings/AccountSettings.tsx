"use client";

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

const messageOf = (error: unknown) =>
  error instanceof ApiError ? error.message : "Une erreur est survenue.";

/** Compte : adresse email (statut, changement), mot de passe. */
export function AccountSettings() {
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
      setPwdNotice({ kind: "ok", text: "Mot de passe modifié. Vos autres appareils ont été déconnectés." });
    },
    onError: (error) => setPwdNotice({ kind: "error", text: messageOf(error) }),
  });

  const mailMutation = useMutation({
    mutationFn: () => changeEmail(mail.current, mail.email.trim()),
    onSuccess: (result) => {
      setMail({ current: "", email: "" });
      setMailNotice({ kind: "ok", text: result.message });
    },
    onError: (error) => setMailNotice({ kind: "error", text: messageOf(error) }),
  });

  const resendMutation = useMutation({
    mutationFn: resendVerification,
    onSuccess: (result) => {
      setVerifyNotice({ kind: "ok", text: result.message });
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
    onError: (error) => setVerifyNotice({ kind: "error", text: messageOf(error) }),
  });

  const verified = !!me.data?.emailVerifiedAt;

  return (
    <div className="space-y-6" data-testid="account-settings">
      <div>
        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">Adresse email</h3>
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
              {verified ? "Confirmée" : "Non confirmée"}
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
              Renvoyer l&apos;email de confirmation
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
        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">Changer d&apos;adresse email</h3>
        <label className="block space-y-1">
          <span className={labelClass}>Nouvelle adresse</span>
          <input
            className={inputClass}
            type="email"
            required
            value={mail.email}
            onChange={(event) => setMail((prev) => ({ ...prev, email: event.target.value }))}
            aria-label="Nouvelle adresse email"
          />
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>Mot de passe actuel</span>
          <input
            className={inputClass}
            type="password"
            required
            autoComplete="current-password"
            value={mail.current}
            onChange={(event) => setMail((prev) => ({ ...prev, current: event.target.value }))}
            aria-label="Mot de passe actuel (changement d'adresse)"
          />
        </label>
        <button type="submit" className={buttonClass} disabled={mailMutation.isPending}>
          Envoyer la confirmation
        </button>
        <NoticeBox notice={mailNotice} testId="email-notice" />
      </form>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setPwdNotice(null);
          if (pwd.next !== pwd.confirm) {
            setPwdNotice({ kind: "error", text: "Les deux mots de passe ne correspondent pas." });
            return;
          }
          pwdMutation.mutate();
        }}
      >
        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">Changer de mot de passe</h3>
        <label className="block space-y-1">
          <span className={labelClass}>Mot de passe actuel</span>
          <input
            className={inputClass}
            type="password"
            required
            autoComplete="current-password"
            value={pwd.current}
            onChange={(event) => setPwd((prev) => ({ ...prev, current: event.target.value }))}
            aria-label="Mot de passe actuel"
          />
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>Nouveau mot de passe</span>
          <input
            className={inputClass}
            type="password"
            required
            autoComplete="new-password"
            value={pwd.next}
            onChange={(event) => setPwd((prev) => ({ ...prev, next: event.target.value }))}
            aria-label="Nouveau mot de passe"
          />
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>Confirmation</span>
          <input
            className={inputClass}
            type="password"
            required
            autoComplete="new-password"
            value={pwd.confirm}
            onChange={(event) => setPwd((prev) => ({ ...prev, confirm: event.target.value }))}
            aria-label="Confirmation du nouveau mot de passe"
          />
        </label>
        <button type="submit" className={buttonClass} disabled={pwdMutation.isPending}>
          Changer le mot de passe
        </button>
        <NoticeBox notice={pwdNotice} testId="password-notice" />
      </form>
    </div>
  );
}

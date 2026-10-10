"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { resetPassword } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const t = useTranslations("recovery");
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => resetPassword(token, password),
    onSuccess: () => {
      // Toutes les sessions sont révoquées côté serveur : on oublie aussi celle de ce navigateur
      useAuthStore.getState().reset();
      setDone(true);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("genericError")),
  });

  if (!token) {
    return (
      <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {t("linkIncomplete")}{" "}
        <Link href="/forgot-password" className="font-semibold underline">
          {t("forgotLink")}
        </Link>
      </p>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          data-testid="reset-done"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {t("resetDone")}
        </p>
        <Link href="/login" className="text-sm font-semibold text-slate-900">
          {t("goLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (password !== confirmation) {
          setError(t("mismatch"));
          return;
        }
        mutation.mutate();
      }}
      aria-busy={mutation.isPending}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">{t("newPassword")}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmation">{t("confirmation")}</Label>
          <Input
            id="confirmation"
            type="password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" data-testid="form-error" className="text-xs text-rose-600">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {t("changePassword")}
      </Button>
    </form>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { forgotPassword } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const t = useTranslations("recovery");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: forgotPassword,
    onSuccess: () => {
      setError(null);
      setSent(true);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    },
  });

  if (sent) {
    return (
      <div
        role="status"
        data-testid="forgot-sent"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
      >
        {t("sentNotice")}
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(email.trim());
      }}
      aria-busy={mutation.isPending}
    >
      <div className="space-y-2">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {t("sendLink")}
      </Button>
    </form>
  );
}

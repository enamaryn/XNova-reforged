"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslations } from 'next-intl';

import { ApiError } from "@/lib/api/client";
import { login } from "@/lib/api/auth";
import { showError, showSuccess } from "@/lib/utils/toast";
import { loginSchema, type LoginSchema } from "@/lib/validators/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ResendConfirmation } from "@/components/auth/ResendConfirmation";

export function LoginForm() {
  const t = useTranslations('auth.login');
  const setStatus = useAuthStore((state) => state.setStatus);
  const setRemember = useAuthStore((state) => state.setRemember);
  const [remember, setLocalRemember] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      showSuccess(t('success'));
      // Navigation complète : le cache du routeur peut contenir les préchargements de /overview faits
      // avant connexion (redirigés vers /login par le middleware) et renverrait le joueur à /login.
      window.location.assign("/overview");
    },
    onError: (error) => {
      setStatus("unauthenticated");
      setNeedsConfirmation(error instanceof ApiError && error.payload?.code === "EMAIL_NOT_VERIFIED");
      if (error instanceof ApiError) {
        showError(error.message);
      } else {
        showError(t('error.generic'));
      }
    },
  });

  const onSubmit = (values: LoginSchema) => {
    setRemember(remember);
    mutation.mutate(values);
  };

  return (
    <form
      className="space-y-6"
      onSubmit={form.handleSubmit(onSubmit)}
      aria-busy={mutation.isPending}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier">{t('emailLabel')}</Label>
          <Input
            id="identifier"
            autoComplete="username"
            placeholder={t('emailPlaceholder')}
            {...form.register("identifier")}
          />
          {form.formState.errors.identifier ? (
            <p className="text-xs text-rose-600">
              {form.formState.errors.identifier.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('passwordLabel')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder={t('passwordPlaceholder')}
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-rose-600">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
              checked={remember}
              onChange={(event) => setLocalRemember(event.target.checked)}
            />
            {t('rememberMe')}
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            {t('forgotPassword')}
          </Link>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {t('submit')}
      </Button>

      {needsConfirmation ? (
        <div
          className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          data-testid="login-needs-confirmation"
        >
          <p>
            Votre adresse email n&apos;est pas encore confirmée. Cliquez sur le lien reçu par email, ou
            demandez-en un nouveau :
          </p>
          <ResendConfirmation initialEmail={form.getValues("identifier").includes("@") ? form.getValues("identifier") : ""} />
        </div>
      ) : null}
    </form>
  );
}

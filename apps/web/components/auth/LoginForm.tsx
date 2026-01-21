"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export function LoginForm() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const setStatus = useAuthStore((state) => state.setStatus);
  const setRemember = useAuthStore((state) => state.setRemember);
  const [remember, setLocalRemember] = useState(false);

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
      router.push("/overview");
    },
    onError: (error) => {
      setStatus("unauthenticated");
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
    </form>
  );
}

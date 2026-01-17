"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { ApiError } from "@/lib/api/client";
import { login } from "@/lib/api/auth";
import { loginSchema, type LoginSchema } from "@/lib/validators/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormError } from "@/components/auth/AuthFormError";
import Link from "next/link";

export function LoginForm() {
  const router = useRouter();
  const setStatus = useAuthStore((state) => state.setStatus);
  const setRemember = useAuthStore((state) => state.setRemember);
  const [formError, setFormError] = useState<string | null>(null);
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
    onMutate: () => {
      setFormError(null);
      setStatus("loading");
    },
    onSuccess: () => {
      router.push("/overview");
    },
    onError: (error) => {
      setStatus("unauthenticated");
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError("Impossible de se connecter. Veuillez reessayer.");
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
          <Label htmlFor="identifier">Identifiant</Label>
          <Input
            id="identifier"
            autoComplete="username"
            placeholder="Nom d'utilisateur ou email"
            {...form.register("identifier")}
          />
          {form.formState.errors.identifier ? (
            <p className="text-xs text-rose-600">
              {form.formState.errors.identifier.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="********"
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
            Se souvenir de moi
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Mot de passe oublie
          </Link>
        </div>
      </div>

      <AuthFormError message={formError} />

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Connexion en cours..." : "Se connecter"}
      </Button>
    </form>
  );
}

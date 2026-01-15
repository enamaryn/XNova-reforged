"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { ApiError } from "@/lib/api/client";
import { register } from "@/lib/api/auth";
import { registerSchema, type RegisterSchema } from "@/lib/validators/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormError } from "@/components/auth/AuthFormError";

export function RegisterForm() {
  const router = useRouter();
  const setStatus = useAuthStore((state) => state.setStatus);
  const setRemember = useAuthStore((state) => state.setRemember);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: register,
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
        setFormError("Impossible de creer le compte. Veuillez reessayer.");
      }
    },
  });

  const onSubmit = (values: RegisterSchema) => {
    setRemember(true);
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
          <Label htmlFor="username">Nom d'utilisateur</Label>
          <Input
            id="username"
            autoComplete="username"
            placeholder="NovaCommander"
            {...form.register("username")}
          />
          {form.formState.errors.username ? (
            <p className="text-xs text-rose-600">
              {form.formState.errors.username.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="commandant@xnova.io"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-rose-600">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Au moins 8 caracteres"
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-rose-600">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>
      </div>

      <AuthFormError message={formError} />

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Inscription en cours..." : "Creer mon compte"}
      </Button>
    </form>
  );
}

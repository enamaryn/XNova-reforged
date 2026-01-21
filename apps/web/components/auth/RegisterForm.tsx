"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { ApiError } from "@/lib/api/client";
import { register } from "@/lib/api/auth";
import { showError, showSuccess } from "@/lib/utils/toast";
import { registerSchema, type RegisterSchema } from "@/lib/validators/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const router = useRouter();
  const setStatus = useAuthStore((state) => state.setStatus);
  const setRemember = useAuthStore((state) => state.setRemember);

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
    onSuccess: () => {
      showSuccess("Compte cree avec succes");
      router.push("/overview");
    },
    onError: (error) => {
      setStatus("unauthenticated");
      if (error instanceof ApiError) {
        showError(error.message);
      } else {
        showError("Impossible de creer le compte. Veuillez reessayer.");
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

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Inscription en cours..." : "Creer mon compte"}
      </Button>
    </form>
  );
}

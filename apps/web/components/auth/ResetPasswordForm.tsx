"use client";

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
    onError: (err) => setError(err instanceof ApiError ? err.message : "Une erreur est survenue."),
  });

  if (!token) {
    return (
      <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Lien incomplet. Redemandez un email de réinitialisation.{" "}
        <Link href="/forgot-password" className="font-semibold underline">
          Mot de passe oublié
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
          Mot de passe modifié. Vous pouvez vous connecter avec le nouveau.
        </p>
        <Link href="/login" className="text-sm font-semibold text-slate-900">
          Aller à la connexion
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
          setError("Les deux mots de passe ne correspondent pas.");
          return;
        }
        mutation.mutate();
      }}
      aria-busy={mutation.isPending}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nouveau mot de passe</Label>
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
          <Label htmlFor="confirmation">Confirmation</Label>
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
        Changer le mot de passe
      </Button>
    </form>
  );
}

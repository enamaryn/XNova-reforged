"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { resendConfirmation } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Renvoi du lien de confirmation d'un compte pas encore activé (aucune session n'existe). */
export function ResendConfirmation({ initialEmail = "" }: { initialEmail?: string }) {
  const t = useTranslations("recovery");
  const [email, setEmail] = useState(initialEmail);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () => resendConfirmation(email.trim()),
    onSuccess: (result) => setNotice({ kind: "ok", text: result.message }),
    onError: (error) =>
      setNotice({ kind: "error", text: error instanceof ApiError ? error.message : t("genericError") }),
  });

  return (
    <form
      className="space-y-3"
      data-testid="resend-confirmation"
      onSubmit={(event) => {
        event.preventDefault();
        setNotice(null);
        mutation.mutate();
      }}
    >
      <Label htmlFor="resend-email">Adresse email du compte</Label>
      <Input
        id="resend-email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {t("resendConfirmation")}
      </Button>
      {notice ? (
        <p
          role="status"
          data-testid="resend-notice"
          className={`text-xs ${notice.kind === "ok" ? "text-emerald-700" : "text-rose-600"}`}
        >
          {notice.text}
        </p>
      ) : null}
    </form>
  );
}

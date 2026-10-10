"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { verifyEmail } from "@/lib/api/auth";

type State = { kind: "loading" } | { kind: "ok"; message: string } | { kind: "error"; message: string };

/** Consomme le jeton du lien (une seule fois, même si l'effet est rejoué par React). */
export function VerifyEmail() {
  const t = useTranslations("recovery");
  const token = useSearchParams().get("token");
  const started = useRef(false);
  const [state, setState] = useState<State>(
    token ? { kind: "loading" } : { kind: "error", message: t("verifyIncomplete") },
  );

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmail(token)
      .then((result) => setState({ kind: "ok", message: result.message }))
      .catch((error) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : t("genericError"),
        }),
      );
  }, [token, t]);

  if (state.kind === "loading") {
    return <p className="text-sm text-slate-500">Vérification en cours...</p>;
  }

  return (
    <div className="space-y-4">
      <p
        role="status"
        data-testid="verify-result"
        className={`rounded-2xl border p-4 text-sm ${
          state.kind === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}
      >
        {state.message}
      </p>
      <Link href="/overview" className="text-sm font-semibold text-slate-900">
        {t("continue")}
      </Link>
    </div>
  );
}

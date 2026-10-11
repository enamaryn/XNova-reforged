"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  banUser,
  unbanUser,
  resetPlayer,
  deletePlayer,
  type AdminPlayerDetail,
} from "@/lib/api/admin";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useI18n } from "@/lib/i18n";

type Action = "ban" | "unban" | "reset" | "delete";
const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white";
const buttonClass =
  "rounded-xl border border-slate-700 px-3 py-2 text-sm hover:border-blue-400 disabled:opacity-50";

export function PlayerActions({ player }: { player: AdminPlayerDetail }) {
  const { t } = useI18n();
  const labels: Record<Action, string> = {
    ban: t("admin.actions.ban"),
    unban: t("admin.actions.unban"),
    reset: t("admin.actions.reset"),
    delete: t("admin.actions.delete"),
  };
  const { user } = useAuthStore();
  const router = useRouter();
  const locale = usePathname().split("/")[1];
  const client = useQueryClient();
  const [action, setAction] = useState<Action | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(0);
  const [message, setMessage] = useState("");
  const ranks: Record<string, number> = {
    PLAYER: 0,
    MODERATOR: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
  };
  const canManage =
    user?.id !== player.id &&
    (ranks[user?.role ?? ""] ?? 0) > (ranks[player.role] ?? 0);
  const mutation = useMutation({
    mutationFn: async (selected: Action) => {
      const payload = {
        confirmationUsername: confirmation,
        reason: reason.trim(),
      };
      if (selected === "reset") return resetPlayer(player.id, payload);
      if (selected === "delete") return deletePlayer(player.id, payload);
      if (selected === "ban")
        return banUser({
          username: player.username,
          reason: payload.reason,
          days,
        });
      return unbanUser({ username: player.username, reason: payload.reason });
    },
    onSuccess: async (_data, selected) => {
      setAction(null);
      setConfirmation("");
      setReason("");
      if (selected === "delete") {
        client.removeQueries({ queryKey: ["admin", "player", player.id] });
        router.replace(`/${locale}/admin`);
      } else {
        setMessage(
          selected === "reset"
            ? t("admin.actions.resetDone")
            : selected === "ban"
              ? t("admin.actions.banDone")
              : t("admin.actions.unbanDone"),
        );
      }
      await client.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  const choose = (selected: Action) => {
    setAction(selected);
    setConfirmation("");
    setReason("");
    setDays(0);
    setMessage("");
    mutation.reset();
  };
  return (
    <section
      aria-label={t("admin.actions.aria")}
      className="space-y-4 rounded-2xl border border-slate-700 p-4"
    >
      <h3 className="font-semibold">{t("admin.actions.title")}</h3>
      <div className="flex flex-wrap gap-2">
        <button
          className={buttonClass}
          disabled={!canManage || mutation.isPending}
          onClick={() => choose(player.banned ? "unban" : "ban")}
        >
          {player.banned ? labels.unban : labels.ban}
        </button>
        <button
          className={`${buttonClass} text-amber-300`}
          disabled={!canManage || mutation.isPending}
          onClick={() => choose("reset")}
        >
          {labels.reset}
        </button>
        <button
          className={`${buttonClass} text-red-300`}
          disabled={!canManage || mutation.isPending}
          onClick={() => choose("delete")}
        >
          {labels.delete}
        </button>
      </div>
      {!canManage && (
        <p className="text-sm text-slate-400">
          {t("admin.actions.restricted")}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-emerald-300">
          {message}
        </p>
      )}
      {action && (
        <form
          aria-label={t("admin.actions.confirmAria", { action: labels[action] })}
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (confirmation === player.username && reason.trim().length >= 3)
              mutation.mutate(action);
          }}
        >
          <h4 className="font-semibold">
            {labels[action]} : {player.username}
          </h4>
          {action === "reset" && (
            <p className="text-sm text-amber-200">
              {t("admin.actions.resetWarning")}
            </p>
          )}
          {action === "delete" && (
            <p className="text-sm text-red-200">
              {t("admin.actions.deleteWarning")}
            </p>
          )}
          {(action === "reset" || action === "delete") && (
            <p className="text-xs text-slate-400">
              {t("admin.actions.fleetsWarning")}
            </p>
          )}
          {action === "ban" && (
            <label className="block text-sm">
              {t("admin.actions.banDays")}
              <input
                type="number"
                min={0}
                max={365}
                step={1}
                className={`mt-1 ${inputClass}`}
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              />
            </label>
          )}
          <label className="block text-sm">
            {t("admin.actions.reason")}
            <textarea
              required
              minLength={3}
              maxLength={2000}
              className={`mt-1 ${inputClass}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            {t("admin.actions.retype", { name: player.username })}
            <input
              required
              autoComplete="off"
              className={`mt-1 ${inputClass}`}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className={`${buttonClass} text-red-300`}
              disabled={
                mutation.isPending ||
                confirmation !== player.username ||
                reason.trim().length < 3
              }
            >
              {mutation.isPending
                ? t("admin.actions.pending")
                : t("admin.actions.confirm", { action: labels[action].toLowerCase() })}
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={mutation.isPending}
              onClick={() => setAction(null)}
            >
              {t("admin.actions.cancel")}
            </button>
          </div>
          {mutation.error && (
            <p role="alert" className="text-red-300">
              {mutation.error.message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

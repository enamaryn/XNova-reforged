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

type Action = "ban" | "unban" | "reset" | "delete";
const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white";
const buttonClass =
  "rounded-xl border border-slate-700 px-3 py-2 text-sm hover:border-blue-400 disabled:opacity-50";
const labels: Record<Action, string> = {
  ban: "Bannir",
  unban: "Débannir",
  reset: "Réinitialiser la progression",
  delete: "Supprimer le compte",
};

export function PlayerActions({ player }: { player: AdminPlayerDetail }) {
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
            ? "Progression réinitialisée. Le joueur a été déconnecté et peut reprendre avec les mêmes accès."
            : selected === "ban"
              ? "Joueur banni et sessions déconnectées."
              : "Joueur débanni.",
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
      aria-label="Actions sur le joueur"
      className="space-y-4 rounded-2xl border border-slate-700 p-4"
    >
      <h3 className="font-semibold">Gestion du compte</h3>
      <div className="flex flex-wrap gap-2">
        <button
          className={buttonClass}
          disabled={!canManage || mutation.isPending}
          onClick={() => choose(player.banned ? "unban" : "ban")}
        >
          {player.banned ? "Débannir" : "Bannir"}
        </button>
        <button
          className={`${buttonClass} text-amber-300`}
          disabled={!canManage || mutation.isPending}
          onClick={() => choose("reset")}
        >
          Réinitialiser la progression
        </button>
        <button
          className={`${buttonClass} text-red-300`}
          disabled={!canManage || mutation.isPending}
          onClick={() => choose("delete")}
        >
          Supprimer le compte
        </button>
      </div>
      {!canManage && (
        <p className="text-sm text-slate-400">
          Les actions sont réservées aux comptes de rang inférieur au vôtre.
          Votre propre compte est protégé.
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-emerald-300">
          {message}
        </p>
      )}
      {action && (
        <form
          aria-label={`Confirmer : ${labels[action]}`}
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
              Cette action est irréversible. Les colonies, bâtiments,
              recherches, vaisseaux, défenses et files sont effacés. La planète
              principale repart avec 500 métal et 500 cristal. Les accès, le
              rôle, le bannissement, l’alliance et les messages sont conservés.
              Le joueur est déconnecté.
            </p>
          )}
          {action === "delete" && (
            <p className="text-sm text-red-200">
              Suppression définitive du compte, de ses planètes, ressources,
              unités, recherches, messages et rapports. Le joueur sera
              déconnecté.
            </p>
          )}
          {(action === "reset" || action === "delete") && (
            <p className="text-xs text-slate-400">
              Les flottes actives du joueur ou dirigées vers ses planètes
              doivent terminer ou être rappelées avant cette action. Pour
              supprimer un fondateur d’alliance, transférez d’abord la fondation
              ou dissolvez l’alliance.
            </p>
          )}
          {action === "ban" && (
            <label className="block text-sm">
              Durée en jours (0 = permanent)
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
            Motif
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
            Retapez le pseudo {player.username} pour confirmer
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
                ? "Action en cours…"
                : `Confirmer ${labels[action].toLowerCase()}`}
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={mutation.isPending}
              onClick={() => setAction(null)}
            >
              Annuler
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

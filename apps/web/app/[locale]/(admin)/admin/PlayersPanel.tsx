"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAdminPlayers } from "@/lib/api/admin";

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white";
const buttonClass =
  "rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-blue-400 disabled:opacity-50";
const count = (value: number) => value.toLocaleString("fr-FR");

export function PlayersPanel() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const locale = usePathname().split("/")[1];
  const list = useQuery({
    queryKey: ["admin", "players", search, page],
    queryFn: () => getAdminPlayers(search, page),
  });
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6">
        <h2 className="font-semibold text-white">Joueurs</h2>
        <form
          className="my-4 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(query.trim());
            setPage(1);
          }}
        >
          <label className="flex-1 text-sm text-slate-400">
            Rechercher par pseudo
            <input
              className={`mt-1 ${inputClass}`}
              value={query}
              maxLength={20}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tous les joueurs ou une partie du pseudo"
            />
          </label>
          <button className={`${buttonClass} self-end`} type="submit">
            Rechercher
          </button>
        </form>
        {list.isLoading && <p role="status">Chargement des joueurs…</p>}
        {list.error && (
          <p role="alert" className="text-red-300">
            {list.error.message}{" "}
            <button className={buttonClass} onClick={() => list.refetch()}>
              Réessayer
            </button>
          </p>
        )}
        {list.data && (
          <>
            <p className="mb-2 text-sm text-slate-400">
              {count(list.data.total)} joueur(s)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    {[
                      "Pseudo",
                      "Email",
                      "Points / rang",
                      "Planètes",
                      "État",
                      "Actions",
                    ].map((label) => (
                      <th className="px-2 py-3" scope="col" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.data.players.map((player) => (
                    <tr key={player.id} className="border-t border-slate-800">
                      <th className="px-2 py-3 font-medium" scope="row">
                        {player.username}
                        <span className="block text-xs text-slate-500">
                          {player.role}
                        </span>
                      </th>
                      <td className="px-2">
                        {player.email}
                        <span className="block text-xs text-slate-400">
                          {player.emailVerifiedAt ? "Confirmé" : "À confirmer"}
                        </span>
                      </td>
                      <td className="px-2">
                        {count(player.points)} / {player.rank || "—"}
                      </td>
                      <td className="px-2">{player.planets}</td>
                      <td
                        className={`px-2 ${player.banned ? "text-red-300" : "text-emerald-300"}`}
                      >
                        {player.banned ? "Banni" : "Actif"}
                      </td>
                      <td className="px-2">
                        <div className="flex gap-2">
                          <Link
                            className={buttonClass}
                            aria-label={`Voir la fiche de ${player.username}`}
                            href={`/${locale}/admin/players/${player.id}`}
                          >
                            Fiche joueur
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.data.players.length === 0 && (
              <p className="py-4 text-slate-400">Aucun joueur trouvé.</p>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                className={buttonClass}
                disabled={page === 1 || list.isFetching}
                onClick={() => setPage(page - 1)}
              >
                Précédent
              </button>
              <span className="text-sm text-slate-400">
                Page {page} /{" "}
                {Math.max(1, Math.ceil(list.data.total / list.data.pageSize))}
              </span>
              <button
                className={buttonClass}
                disabled={
                  page * list.data.pageSize >= list.data.total ||
                  list.isFetching
                }
                onClick={() => setPage(page + 1)}
              >
                Suivant
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

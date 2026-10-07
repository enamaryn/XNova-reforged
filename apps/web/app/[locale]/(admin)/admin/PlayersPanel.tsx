"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  banUser,
  unbanUser,
  getAdminPlayers,
  getAdminPlayer,
  updatePlayerEmail,
  type AdminPlayerDetail,
} from "@/lib/api/admin";

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white";
const buttonClass =
  "rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-blue-400 disabled:opacity-50";
const count = (value: number) => value.toLocaleString("fr-FR");

export function PlayersPanel() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ["admin", "players", search, page],
    queryFn: () => getAdminPlayers(search, page),
  });
  const detail = useQuery({
    queryKey: ["admin", "player", selected],
    queryFn: () => getAdminPlayer(selected!),
    enabled: !!selected,
  });
  const moderation = useMutation({
    mutationFn: ({
      username,
      banned,
    }: {
      username: string;
      banned: boolean;
    }) => (banned ? unbanUser({ username }) : banUser({ username })),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin"] }),
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
            setSelected(null);
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
        <p className="mb-3 text-xs text-slate-400">
          Les boutons Bannir appliquent un bannissement permanent. Pour une
          durée limitée, utilisez la modération dans Vue générale.
        </p>
        {list.isLoading && <p role="status">Chargement des joueurs…</p>}
        {list.error && (
          <p role="alert" className="text-red-300">
            {list.error.message}{" "}
            <button className={buttonClass} onClick={() => list.refetch()}>
              Réessayer
            </button>
          </p>
        )}
        {moderation.error && (
          <p role="alert" className="text-red-300">
            {moderation.error.message}
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
                          <button
                            className={buttonClass}
                            aria-label={`Voir la fiche de ${player.username}`}
                            onClick={() => setSelected(player.id)}
                          >
                            Fiche
                          </button>
                          <button
                            className={`${buttonClass} ${player.banned ? "text-emerald-300" : "text-red-300"}`}
                            disabled={moderation.isPending}
                            aria-label={`${player.banned ? "Débannir" : "Bannir"} ${player.username}`}
                            onClick={() =>
                              moderation.mutate({
                                username: player.username,
                                banned: player.banned,
                              })
                            }
                          >
                            {player.banned ? "Débannir" : "Bannir"}
                          </button>
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
      {selected && detail.isLoading && (
        <p role="status">Chargement de la fiche…</p>
      )}
      {detail.error && (
        <p role="alert" className="text-red-300">
          {detail.error.message}
        </p>
      )}
      {selected && detail.data && (
        <PlayerDetails
          key={`${detail.data.id}:${detail.data.email}`}
          player={detail.data}
        />
      )}
    </div>
  );
}

function PlayerDetails({ player }: { player: AdminPlayerDetail }) {
  const [email, setEmail] = useState(player.email);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: updatePlayerEmail,
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin"] }),
  });
  return (
    <section
      aria-label={`Fiche de ${player.username}`}
      className="space-y-6 rounded-3xl border border-slate-800 bg-slate-950/60 p-6"
    >
      <div>
        <h2 className="text-xl font-semibold">{player.username}</h2>
        <p className="text-sm text-slate-400">
          {count(player.points)} points · Rang {player.rank || "—"} · Dernière
          activité : {new Date(player.lastActive).toLocaleString("fr-FR")}
        </p>
        {player.banned && (
          <p className="mt-2 text-sm text-red-300">
            Banni{" "}
            {player.bannedUntil
              ? `jusqu’au ${new Date(player.bannedUntil).toLocaleString("fr-FR")}`
              : "définitivement"}
            {player.banReason ? ` : ${player.banReason}` : ""}
          </p>
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate({ id: player.id, email });
        }}
        className="space-y-2"
      >
        <label className="block text-sm text-slate-300">
          Adresse email
          <input
            className={`mt-1 ${inputClass}`}
            type="email"
            required
            maxLength={255}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <p className="text-xs text-slate-400">
          Le changement déconnecte le joueur et envoie un nouveau lien. La
          connexion reste bloquée jusqu’à confirmation de la nouvelle adresse.
        </p>
        <button
          className={buttonClass}
          disabled={
            mutation.isPending ||
            email.trim().toLowerCase() === player.email.toLowerCase()
          }
        >
          Changer l’email et envoyer la vérification
        </button>
        <p
          role="status"
          className={`text-sm ${player.emailVerifiedAt ? "text-emerald-300" : "text-amber-300"}`}
        >
          {player.emailVerifiedAt ? "Email confirmé" : "Email à confirmer"}
        </p>
        {mutation.error && (
          <p role="alert" className="text-red-300">
            {mutation.error.message}
          </p>
        )}
      </form>
      <div>
        <h3 className="mb-3 font-semibold">Technologies</h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          {player.technologies.map((tech) => (
            <div
              key={tech.id}
              className="flex justify-between gap-3 rounded-xl bg-slate-900/60 p-3 text-sm"
            >
              <dt>{tech.name}</dt>
              <dd className="font-mono text-blue-300">Niv. {tech.level}</dd>
            </div>
          ))}
        </dl>
      </div>
      {player.planets.map((planet) => (
        <div
          className="space-y-3 border-t border-slate-800 pt-4"
          key={planet.id}
        >
          <h3 className="font-semibold">
            {planet.name} [{planet.coordinates}]
          </h3>
          <dl className="grid gap-2 sm:grid-cols-3">
            {Object.entries(planet.resources).map(([resource, amount]) => (
              <div className="rounded-xl bg-slate-900/60 p-3" key={resource}>
                <dt className="text-xs text-slate-400">
                  {
                    {
                      metal: "Métal",
                      crystal: "Cristal",
                      deuterium: "Deutérium",
                    }[resource]
                  }
                </dt>
                <dd className="font-mono">{count(amount)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-slate-400">
            Énergie : {count(planet.energy.produced)} produite /{" "}
            {count(planet.energy.used)} consommée · Cases : {planet.fields.used}
            /{planet.fields.max} · Ressources au{" "}
            {new Date(planet.lastUpdate).toLocaleString("fr-FR")}
          </p>
          <dl className="grid gap-2 sm:grid-cols-2">
            {planet.buildings.map((building) => (
              <div
                key={building.id}
                className="flex justify-between gap-3 text-sm"
              >
                <dt className="text-slate-300">{building.name}</dt>
                <dd className="font-mono text-blue-300">
                  Niv. {building.level}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}

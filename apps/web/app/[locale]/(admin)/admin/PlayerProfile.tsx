"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminPlayer,
  updatePlayerEmail,
  type AdminPlayerDetail,
  type AdminQueueEntry,
} from "@/lib/api/admin";
import { useAuthStore } from "@/lib/stores/auth-store";
import { SHIPS } from "@xnova/game-config";
import { PlayerActions } from "./PlayerActions";
const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white";
const buttonClass =
  "rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-blue-400 disabled:opacity-50";
const count = (value: number) => value.toLocaleString("fr-FR");

export function PlayerProfile({ id }: { id: string }) {
  const locale = usePathname().split("/")[1];
  const query = useQuery({
    queryKey: ["admin", "player", id],
    queryFn: () => getAdminPlayer(id),
  });
  return (
    <div className="space-y-4">
      <Link href={`/${locale}/admin`} className={buttonClass}>
        ← Retour aux joueurs
      </Link>
      {query.isLoading && <p role="status">Chargement de la fiche joueur…</p>}
      {query.error && (
        <div role="alert" className="space-y-3 text-red-300">
          <p>{query.error.message}</p>
          <button className={buttonClass} onClick={() => query.refetch()}>
            Réessayer
          </button>
        </div>
      )}
      {query.data && (
        <>
          <button
            className={buttonClass}
            disabled={query.isFetching}
            onClick={() => query.refetch()}
          >
            Actualiser la fiche
          </button>
          <PlayerDetails
            key={`${query.data.id}:${query.data.email}`}
            player={query.data}
          />
        </>
      )}
    </div>
  );
}

function Queue({
  title,
  entries,
}: {
  title: string;
  entries: AdminQueueEntry[];
}) {
  return (
    <div>
      <h4 className="mb-2 font-semibold">{title}</h4>
      {entries.length ? (
        <ul className="space-y-2 text-sm text-slate-300">
          {entries.map((row) => (
            <li key={row.id}>
              {row.name} ·{" "}
              {row.level !== undefined
                ? `Niv. ${row.level}`
                : `${row.amount} unités`}{" "}
              · Fin : {new Date(row.endTime).toLocaleString("fr-FR")}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Aucune file en cours.</p>
      )}
    </div>
  );
}

function PlayerDetails({ player }: { player: AdminPlayerDetail }) {
  const { user } = useAuthStore();
  const canEditEmail =
    user?.role === "SUPER_ADMIN" ||
    (user?.role === "ADMIN" && player.role !== "SUPER_ADMIN");
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
      <PlayerActions player={player} />
      {canEditEmail && (
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
      )}
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
      <Queue title="Recherche en cours" entries={player.researchQueue} />
      <div>
        <h3 className="mb-3 font-semibold">Flottes en vol et entrantes</h3>
        {[...player.fleets, ...player.incomingFleets].length ? (
          <ul className="space-y-3">
            {[...player.fleets, ...player.incomingFleets].map((fleet) => (
              <li
                key={fleet.id}
                className="rounded-xl bg-slate-900/60 p-3 text-sm"
              >
                <p>
                  {player.incomingFleets.some((row) => row.id === fleet.id)
                    ? "Entrante"
                    : "Du joueur"}{" "}
                  · Mission {fleet.mission} · {fleet.status}
                </p>
                <p>
                  [{fleet.fromGalaxy}:{fleet.fromSystem}:{fleet.fromPosition}] →
                  [{fleet.toGalaxy}:{fleet.toSystem}:{fleet.toPosition}]
                </p>
                <p>
                  Arrivée :{" "}
                  {new Date(fleet.arrivalTime).toLocaleString("fr-FR")}
                  {fleet.returnTime &&
                    ` · Retour : ${new Date(fleet.returnTime).toLocaleString("fr-FR")}`}
                </p>
                <p>
                  Vaisseaux :{" "}
                  {Object.entries(fleet.ships)
                    .map(
                      ([id, amount]) =>
                        `${SHIPS[Number(id)]?.name ?? `Vaisseau ${id}`} : ${count(amount)}`,
                    )
                    .join(" · ")}
                </p>
                <p>
                  Cargaison :{" "}
                  {Object.entries(fleet.cargo)
                    .map(
                      ([resource, amount]) => `${resource} : ${count(amount)}`,
                    )
                    .join(" · ") || "Vide"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Aucune flotte active.</p>
        )}
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
          <div className="grid gap-4 sm:grid-cols-2">
            {(["ships", "defenses"] as const).map((kind) => (
              <div key={kind}>
                <h4 className="mb-2 font-semibold">
                  {kind === "ships" ? "Vaisseaux à quai" : "Défenses"}
                </h4>
                {planet[kind].length ? (
                  <dl className="space-y-2">
                    {planet[kind].map((unit) => (
                      <div
                        key={unit.id}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <dt>{unit.name}</dt>
                        <dd className="font-mono text-blue-300">
                          {count(unit.amount)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-slate-500">Aucune unité.</p>
                )}
              </div>
            ))}
          </div>
          <Queue title="Constructions en cours" entries={planet.buildQueue} />
          <Queue title="Chantier spatial en cours" entries={planet.shipQueue} />
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

"use client";
import { ProgressionSummary } from "@/components/game/CommanderSummary";
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
import { useI18n, useItemText } from "@/lib/i18n";
import { PlayerActions } from "./PlayerActions";
const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white";
const buttonClass =
  "rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-blue-400 disabled:opacity-50";
const NUMBER_LOCALES = { fr: "fr-FR", en: "en-GB", es: "es-ES", de: "de-DE", it: "it-IT" } as const;

export function PlayerProfile({ id }: { id: string }) {
  const { t } = useI18n();
  const locale = usePathname().split("/")[1];
  const query = useQuery({
    queryKey: ["admin", "player", id],
    queryFn: () => getAdminPlayer(id),
  });
  return (
    <div className="space-y-4">
      <Link href={`/${locale}/admin`} className={buttonClass}>
        {t("admin.profile.back")}
      </Link>
      {query.isLoading && <p role="status">{t("admin.profile.loading")}</p>}
      {query.error && (
        <div role="alert" className="space-y-3 text-red-300">
          <p>{query.error.message}</p>
          <button className={buttonClass} onClick={() => query.refetch()}>
            {t("common.retry")}
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
            {t("admin.profile.refresh")}
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
  const { t, locale } = useI18n();
  return (
    <div>
      <h4 className="mb-2 font-semibold">{title}</h4>
      {entries.length ? (
        <ul className="space-y-2 text-sm text-slate-300">
          {entries.map((row) => (
            <li key={row.id}>
              {row.name} ·{" "}
              {row.level !== undefined
                ? t("admin.profile.levelShort", { level: row.level })
                : t("admin.profile.units", { amount: row.amount ?? 0 })}{" "}
              · {t("admin.profile.end")} : {new Date(row.endTime).toLocaleString(NUMBER_LOCALES[locale])}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">{t("admin.profile.noQueue")}</p>
      )}
    </div>
  );
}

function PlayerDetails({ player }: { player: AdminPlayerDetail }) {
  const { t, locale } = useI18n();
  const itemText = useItemText();
  const count = (value: number) => value.toLocaleString(NUMBER_LOCALES[locale]);
  const dateTime = (value: string | number | Date) => new Date(value).toLocaleString(NUMBER_LOCALES[locale]);
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
      aria-label={t("admin.profile.ariaProfile", { name: player.username })}
      className="space-y-6 rounded-3xl border border-slate-800 bg-slate-950/60 p-6"
    >
      <div>
        <h2 className="text-xl font-semibold">{player.username}</h2>
        <p className="text-sm text-slate-400">
          {count(player.progression?.power ?? player.points)} {t("admin.profile.power")} ·
          {t("admin.profile.rank")} {player.rank || "—"} · {t("admin.profile.lastActive")} :{" "}
          {dateTime(player.lastActive)}
        </p>
        {player.banned && (
          <p className="mt-2 text-sm text-red-300">
            {t("admin.profile.banned")}{" "}
            {player.bannedUntil
              ? t("admin.profile.bannedUntil", { date: dateTime(player.bannedUntil) })
              : t("admin.profile.bannedForever")}
            {player.banReason ? ` : ${player.banReason}` : ""}
          </p>
        )}
      </div>
      {player.progression && (
        <ProgressionSummary progression={player.progression} />
      )}
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
            {t("admin.profile.email")}
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
            {t("admin.profile.emailHint")}
          </p>
          <button
            className={buttonClass}
            disabled={
              mutation.isPending ||
              email.trim().toLowerCase() === player.email.toLowerCase()
            }
          >
            {t("admin.profile.emailChange")}
          </button>
          <p
            role="status"
            className={`text-sm ${player.emailVerifiedAt ? "text-emerald-300" : "text-amber-300"}`}
          >
            {player.emailVerifiedAt ? t("admin.profile.emailConfirmed") : t("admin.profile.emailPending")}
          </p>
          {mutation.error && (
            <p role="alert" className="text-red-300">
              {mutation.error.message}
            </p>
          )}
        </form>
      )}
      <div>
        <h3 className="mb-3 font-semibold">{t("admin.profile.technologies")}</h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          {player.technologies.map((tech) => (
            <div
              key={tech.id}
              className="flex justify-between gap-3 rounded-xl bg-slate-900/60 p-3 text-sm"
            >
              <dt>{itemText(tech.id, tech).name}</dt>
              <dd className="font-mono text-blue-300">{t("admin.profile.levelShort", { level: tech.level })}</dd>
            </div>
          ))}
        </dl>
      </div>
      <Queue title={t("admin.profile.researchQueue")} entries={player.researchQueue} />
      <div>
        <h3 className="mb-3 font-semibold">{t("admin.profile.fleets")}</h3>
        {[...player.fleets, ...player.incomingFleets].length ? (
          <ul className="space-y-3">
            {[...player.fleets, ...player.incomingFleets].map((fleet) => (
              <li
                key={fleet.id}
                className="rounded-xl bg-slate-900/60 p-3 text-sm"
              >
                <p>
                  {player.incomingFleets.some((row) => row.id === fleet.id)
                    ? t("admin.profile.incoming")
                    : t("admin.profile.own")}{" "}
                  · {t("admin.profile.mission")} {fleet.mission} · {fleet.status}
                </p>
                <p>
                  [{fleet.fromGalaxy}:{fleet.fromSystem}:{fleet.fromPosition}] →
                  [{fleet.toGalaxy}:{fleet.toSystem}:{fleet.toPosition}]
                </p>
                <p>
                  {t("admin.profile.arrival")} :{" "}
                  {dateTime(fleet.arrivalTime)}
                  {fleet.returnTime &&
                    ` · ${t("admin.profile.return")} : ${dateTime(fleet.returnTime)}`}
                </p>
                <p>
                  {t("admin.profile.ships")} :{" "}
                  {Object.entries(fleet.ships)
                    .map(
                      ([id, amount]) =>
                        `${SHIPS[Number(id)] ? itemText(Number(id), SHIPS[Number(id)]).name : t("admin.profile.shipFallback", { id })} : ${count(amount)}`,
                    )
                    .join(" · ")}
                </p>
                <p>
                  {t("admin.profile.cargo")} :{" "}
                  {Object.entries(fleet.cargo)
                    .map(
                      ([resource, amount]) => `${resource} : ${count(amount)}`,
                    )
                    .join(" · ") || t("admin.profile.empty")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{t("admin.profile.noFleet")}</p>
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
                  {t(`admin.profile.resource.${resource}`)}
                </dt>
                <dd className="font-mono">{count(amount)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-slate-400">
            {t("admin.profile.energy")} : {count(planet.energy.produced)} {t("admin.profile.produced")} /{" "}
            {count(planet.energy.used)} {t("admin.profile.consumed")} · {t("admin.profile.fields")} : {planet.fields.used}
            /{planet.fields.max} · {t("admin.profile.resourcesAt")}{" "}
            {dateTime(planet.lastUpdate)}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["ships", "defenses"] as const).map((kind) => (
              <div key={kind}>
                <h4 className="mb-2 font-semibold">
                  {kind === "ships" ? t("admin.profile.dockedShips") : t("admin.profile.defenses")}
                </h4>
                {planet[kind].length ? (
                  <dl className="space-y-2">
                    {planet[kind].map((unit) => (
                      <div
                        key={unit.id}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <dt>{itemText(unit.id, unit).name}</dt>
                        <dd className="font-mono text-blue-300">
                          {count(unit.amount)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-slate-500">{t("admin.profile.noUnit")}</p>
                )}
              </div>
            ))}
          </div>
          <Queue title={t("admin.profile.buildQueue")} entries={planet.buildQueue} />
          <Queue title={t("admin.profile.shipQueue")} entries={planet.shipQueue} />
          <dl className="grid gap-2 sm:grid-cols-2">
            {planet.buildings.map((building) => (
              <div
                key={building.id}
                className="flex justify-between gap-3 text-sm"
              >
                <dt className="text-slate-300">{itemText(building.id, building).name}</dt>
                <dd className="font-mono text-blue-300">
                  {t("admin.profile.levelShort", { level: building.level })}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}

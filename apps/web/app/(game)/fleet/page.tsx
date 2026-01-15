'use client';

import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanetStore } from '@/lib/stores/planet-store';
import { getActiveFleets, getAvailableShips, sendFleet } from '@/lib/api/fleet';
import { useI18n } from '@/lib/i18n';

function formatCountdown(dateValue?: string | Date | null) {
  if (!dateValue) return '--';
  const target = new Date(dateValue).getTime();
  const diffSeconds = Math.max(0, Math.floor((target - Date.now()) / 1000));
  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

export default function FleetPage() {
  const [mission, setMission] = useState('transport');
  const [speedPercent, setSpeedPercent] = useState(100);
  const [shipSelection, setShipSelection] = useState<Record<number, number>>({});
  const [cargo, setCargo] = useState({ metal: 0, crystal: 0, deuterium: 0 });
  const [destination, setDestination] = useState({ galaxy: 1, system: 1, position: 1 });
  const { user } = useAuthStore();
  const { selectedPlanetId } = usePlanetStore();
  const { t } = useI18n();
  const planetId = selectedPlanetId || user?.planets?.[0]?.id;

  const {
    data: shipsData,
    isLoading: shipsLoading,
    error: shipsError,
  } = useQuery({
    queryKey: ['fleet-available', planetId],
    queryFn: () => getAvailableShips(planetId!),
    enabled: !!planetId,
  });

  const {
    data: activeFleets,
    isLoading: fleetsLoading,
    error: fleetsError,
  } = useQuery({
    queryKey: ['fleet-active'],
    queryFn: () => getActiveFleets(),
  });

  const ships = useMemo(() => shipsData?.ships ?? [], [shipsData]);

  useEffect(() => {
    if (!shipsData) return;
    setShipSelection((prev) => {
      const next = { ...prev };
      shipsData.ships.forEach((ship) => {
        if (next[ship.shipId] === undefined) {
          next[ship.shipId] = 0;
        }
      });
      return next;
    });
  }, [shipsData]);

  const sendMutation = useMutation({
    mutationFn: () =>
      sendFleet({
        planetId: planetId!,
        toGalaxy: destination.galaxy,
        toSystem: destination.system,
        toPosition: destination.position,
        mission: mission === 'transport' ? 3 : mission === 'attaque' ? 1 : mission === 'espionnage' ? 6 : 7,
        speedPercent,
        ships: Object.fromEntries(
          Object.entries(shipSelection).filter(([, amount]) => Number(amount) > 0),
        ),
        cargo,
      }),
    onSuccess: () => {
      setShipSelection({});
      setCargo({ metal: 0, crystal: 0, deuterium: 0 });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Commandement</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{t('fleet.title')}</h1>
        <p className="text-sm text-slate-400">
          {t('fleet.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500">
            {t('fleet.compose')}
          </h2>
          <div className="mt-4 grid gap-4">
            <div className="rounded-2xl bg-slate-900/60 p-4">
              <p className="text-sm text-slate-300">{t('fleet.availableShips')}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {shipsLoading && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-400">
                    {t('common.loading')}
                  </div>
                )}
                {shipsError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {t('common.error')}
                  </div>
                )}
                {!shipsLoading && !shipsError && ships.length === 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-400">
                    Aucun vaisseau disponible.
                  </div>
                )}
                {ships.map((ship) => (
                  <div
                    key={ship.shipId}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-400"
                  >
                    <div>
                      <div className="text-slate-200">{ship.name}</div>
                      <div className="text-xs text-slate-500">Disponible: {ship.amount}</div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={ship.amount}
                      value={shipSelection[ship.shipId] ?? 0}
                      onChange={(event) =>
                        setShipSelection((prev) => ({
                          ...prev,
                          [ship.shipId]: Math.min(
                            ship.amount,
                            Math.max(0, Number(event.target.value)),
                          ),
                        }))
                      }
                      className="w-20 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-sm text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/60 p-4">
              <p className="text-sm text-slate-300">{t('fleet.mission')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { id: 'transport', label: t('fleet.missions.transport') },
                  { id: 'attaque', label: t('fleet.missions.attack') },
                  { id: 'espionnage', label: t('fleet.missions.spy') },
                  { id: 'colonisation', label: t('fleet.missions.colonize') },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setMission(item.id)}
                    className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition ${
                      mission === item.id
                        ? 'border-blue-400/60 bg-blue-500/10 text-blue-200'
                        : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/60 p-4">
              <p className="text-sm text-slate-300">{t('fleet.destination')}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {['Galaxie', 'Système', 'Position'].map((label) => (
                  <label key={label} className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {label}
                    <input
                      type="number"
                      min={1}
                      value={
                        label === 'Galaxie'
                          ? destination.galaxy
                          : label === 'Système'
                            ? destination.system
                            : destination.position
                      }
                      onChange={(event) => {
                        const value = Math.max(1, Number(event.target.value));
                        setDestination((prev) => ({
                          galaxy: label === 'Galaxie' ? value : prev.galaxy,
                          system: label === 'Système' ? value : prev.system,
                          position: label === 'Position' ? value : prev.position,
                        }));
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
                      placeholder="0"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/60 p-4">
              <p className="text-sm text-slate-300">Cargaison</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {(['metal', 'crystal', 'deuterium'] as const).map((key) => (
                  <label key={key} className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {key}
                    <input
                      type="number"
                      min={0}
                      value={cargo[key]}
                      onChange={(event) =>
                        setCargo((prev) => ({ ...prev, [key]: Math.max(0, Number(event.target.value)) }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/60 p-4">
              <p className="text-sm text-slate-300">Vitesse (%)</p>
              <input
                type="number"
                min={10}
                max={100}
                value={speedPercent}
                onChange={(event) => setSpeedPercent(Math.min(100, Math.max(10, Number(event.target.value))))}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
              />
            </div>
          </div>

          <button
            onClick={() => sendMutation.mutate()}
            disabled={!planetId || sendMutation.isPending}
            className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold ${
              sendMutation.isPending
                ? 'bg-slate-800 text-slate-500'
                : 'bg-blue-500/20 text-blue-100 hover:bg-blue-500/30'
            }`}
          >
            {sendMutation.isPending ? 'Envoi...' : 'Envoyer la flotte'}
          </button>

          {sendMutation.error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {(sendMutation.error as Error).message}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500">
            {t('fleet.active')}
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-400">
            {fleetsLoading && (
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4">
                {t('common.loading')}
              </div>
            )}
            {fleetsError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                {t('common.error')}
              </div>
            )}
            {!fleetsLoading && !fleetsError && activeFleets && activeFleets.length > 0 ? (
              activeFleets.map((fleet) => (
                <div
                  key={fleet.id}
                  className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Mission {fleet.mission}
                    </span>
                    <span className="text-xs text-slate-500">{fleet.status}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">
                    {fleet.fromGalaxy}:{fleet.fromSystem}:{fleet.fromPosition} →{' '}
                    {fleet.toGalaxy}:{fleet.toSystem}:{fleet.toPosition}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Arrivée dans {formatCountdown(fleet.arrivalTime)}
                  </div>
                </div>
              ))
            ) : !fleetsLoading && !fleetsError ? (
              <>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4">
                  {t('fleet.none')}
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4">
                  {t('fleet.last')}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

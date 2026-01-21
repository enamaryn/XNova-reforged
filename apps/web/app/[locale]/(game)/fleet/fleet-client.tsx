'use client';

import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SHIPS, getShipSpeed } from '@xnova/game-config';
import {
  calculateDistance,
  calculateFleetSpeed,
  calculateFlightDurationSeconds,
  calculateFuelConsumption,
} from '@xnova/game-engine';
import { useSearchParams } from 'next/navigation';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanetStore } from '@/lib/stores/planet-store';
import { getActiveFleets, getAvailableShips, sendFleet } from '@/lib/api/fleet';
import { researchApi } from '@/lib/api/research';
import { useI18n } from '@/lib/i18n';
import { designTokens } from '@/lib/design-tokens';

function formatCountdown(dateValue: string | Date | null | undefined, nowMs: number) {
  if (!dateValue) return '--';
  const target = new Date(dateValue).getTime();
  const diffSeconds = Math.max(0, Math.floor((target - nowMs) / 1000));
  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${hours}h ${minutes}m ${remainingSeconds}s`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(Math.floor(value));
}

export default function FleetClient() {
  const shouldReduceMotion = useReducedMotion();
  const fadeInProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.fadeIn;
  const listVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0 },
  };

  const [mission, setMission] = useState('transport');
  const [speedPercent, setSpeedPercent] = useState(100);
  const [shipSelection, setShipSelection] = useState<Record<number, number>>({});
  const [cargo, setCargo] = useState({ metal: 0, crystal: 0, deuterium: 0 });
  const [destination, setDestination] = useState({ galaxy: 1, system: 1, position: 1 });
  const [nowMs, setNowMs] = useState(Date.now());
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { selectedPlanetId } = usePlanetStore();
  const { t } = useI18n();
  const planetId = selectedPlanetId || user?.planets?.[0]?.id;

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const missionParam = searchParams.get('mission');
    const galaxyParam = searchParams.get('galaxy');
    const systemParam = searchParams.get('system');
    const positionParam = searchParams.get('position');

    if (missionParam) {
      if (missionParam === 'attack') setMission('attaque');
      if (missionParam === 'transport') setMission('transport');
      if (missionParam === 'spy') setMission('espionnage');
      if (missionParam === 'colonize') setMission('colonisation');
    }

    const galaxyValue = galaxyParam ? Number(galaxyParam) : null;
    const systemValue = systemParam ? Number(systemParam) : null;
    const positionValue = positionParam ? Number(positionParam) : null;

    if (galaxyValue || systemValue || positionValue) {
      setDestination((prev) => ({
        galaxy: galaxyValue ?? prev.galaxy,
        system: systemValue ?? prev.system,
        position: positionValue ?? prev.position,
      }));
    }
  }, [searchParams]);

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

  const { data: techData } = useQuery({
    queryKey: ['fleet-tech', planetId],
    queryFn: () => researchApi.getTechnologies(planetId!),
    enabled: !!planetId,
    staleTime: 60000,
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

  const selectedShips = useMemo(
    () =>
      Object.entries(shipSelection)
        .map(([id, amount]) => ({ shipId: Number(id), amount: Number(amount) }))
        .filter((ship) => ship.amount > 0),
    [shipSelection],
  );

  const originPlanet = useMemo(
    () => user?.planets?.find((planet) => planet.id === planetId) ?? null,
    [user, planetId],
  );

  const techLevels = useMemo(() => {
    const levels = { combustion: 0, impulse: 0, hyperspace: 0 };
    if (!techData?.technologies) return levels;
    for (const tech of techData.technologies) {
      if (tech.id === 115) levels.combustion = tech.currentLevel;
      if (tech.id === 117) levels.impulse = tech.currentLevel;
      if (tech.id === 118) levels.hyperspace = tech.currentLevel;
    }
    return levels;
  }, [techData]);

  const missionSummary = useMemo(() => {
    if (!originPlanet || selectedShips.length === 0) return null;

    const shipSpeeds = selectedShips.map((ship) =>
      getShipSpeed(
        ship.shipId,
        techLevels.combustion,
        techLevels.impulse,
        techLevels.hyperspace,
      ),
    );

    const fleetSpeed = calculateFleetSpeed(shipSpeeds);
    if (!fleetSpeed) return null;

    const distance = calculateDistance(
      {
        galaxy: originPlanet.galaxy,
        system: originPlanet.system,
        position: originPlanet.position,
      },
      {
        galaxy: destination.galaxy,
        system: destination.system,
        position: destination.position,
      },
    );

    const baseDuration = calculateFlightDurationSeconds({
      distance,
      fleetSpeed,
      speedPercent,
    });
    const speedMultiplierRaw = Number(process.env.NEXT_PUBLIC_FLEET_SPEED ?? '1');
    const speedMultiplier =
      Number.isFinite(speedMultiplierRaw) && speedMultiplierRaw > 0 ? speedMultiplierRaw : 1;
    const durationSeconds = Math.max(1, Math.floor(baseDuration / speedMultiplier));

    const fuelConsumption = calculateFuelConsumption({
      distance,
      fleetSpeed,
      ships: selectedShips.map((ship) => ({
        amount: ship.amount,
        consumption: SHIPS[ship.shipId]?.consumption ?? 0,
      })),
    });

    const capacity = selectedShips.reduce(
      (sum, ship) => sum + (SHIPS[ship.shipId]?.cargo ?? 0) * ship.amount,
      0,
    );
    const cargoTotal = cargo.metal + cargo.crystal + cargo.deuterium;

    return {
      distance,
      durationSeconds,
      fuelConsumption,
      capacity,
      cargoTotal,
    };
  }, [originPlanet, selectedShips, destination, speedPercent, cargo, techLevels]);

  const isOverCapacity =
    missionSummary ? missionSummary.cargoTotal > missionSummary.capacity : false;

  const sendMutation = useMutation({
    mutationFn: () =>
      sendFleet({
        planetId: planetId!,
        toGalaxy: destination.galaxy,
        toSystem: destination.system,
        toPosition: destination.position,
        mission: mission === 'transport' ? 3 : mission === 'attaque' ? 1 : mission === 'espionnage' ? 6 : 7,
        speedPercent,
        ships: Object.fromEntries(selectedShips.map((ship) => [ship.shipId, ship.amount])),
        cargo,
      }),
    onSuccess: () => {
      setShipSelection({});
      setCargo({ metal: 0, crystal: 0, deuterium: 0 });
      queryClient.invalidateQueries({ queryKey: ['fleet-active'] });
    },
  });

  return (
    <motion.div {...fadeInProps} className="space-y-6">
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
              <motion.div
                variants={shouldReduceMotion ? undefined : listVariants}
                initial={shouldReduceMotion ? undefined : 'hidden'}
                animate={shouldReduceMotion ? undefined : 'show'}
                className="mt-3 grid gap-2 sm:grid-cols-2"
              >
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
                  <motion.div
                    key={ship.shipId}
                    variants={shouldReduceMotion ? undefined : itemVariants}
                    className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between"
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
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-sm text-white sm:w-20"
                    />
                  </motion.div>
                ))}
              </motion.div>
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

            {missionSummary && (
              <div className="rounded-2xl bg-slate-900/60 p-4">
                <p className="text-sm text-slate-300">{t('fleet.summary')}</p>
                <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                  <div className="flex items-center justify-between">
                    <span>{t('fleet.distance')}</span>
                    <span className="text-slate-200">
                      {formatNumber(missionSummary.distance)} u
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t('fleet.duration')}</span>
                    <span className="text-slate-200">
                      {formatDuration(missionSummary.durationSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t('fleet.fuel')}</span>
                    <span className="text-slate-200">
                      {formatNumber(missionSummary.fuelConsumption)} D
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t('fleet.capacity')}</span>
                    <span className="text-slate-200">
                      {formatNumber(missionSummary.capacity)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:col-span-2">
                    <span>{t('fleet.cargoSelected')}</span>
                    <span className={isOverCapacity ? 'text-red-300' : 'text-slate-200'}>
                      {formatNumber(missionSummary.cargoTotal)}
                    </span>
                  </div>
                </div>
              </div>
            )}
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
          <motion.div
            variants={shouldReduceMotion ? undefined : listVariants}
            initial={shouldReduceMotion ? undefined : 'hidden'}
            animate={shouldReduceMotion ? undefined : 'show'}
            className="mt-4 space-y-3 text-sm text-slate-400"
          >
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
              activeFleets.map((fleet) => {
                const isReturning = fleet.status === 'returning';
                const targetTime = isReturning ? fleet.returnTime : fleet.arrivalTime;
                const countdownLabel = isReturning ? t('movement.backIn') : t('movement.arrivalIn');

                return (
                  <motion.div
                    key={fleet.id}
                    variants={shouldReduceMotion ? undefined : itemVariants}
                    className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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
                      {countdownLabel} {formatCountdown(targetTime, nowMs)}
                    </div>
                  </motion.div>
                );
              })
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
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

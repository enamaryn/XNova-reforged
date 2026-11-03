// Invasions aliens : une campagne de vagues successives de flottes NPC, à repousser ensemble avant l'échéance.
// Chaque vague occupe la position 16 (espace profond) d'un système d'une galaxie ; les joueurs la combattent par une
// attaque normale vers cette position, comme le boss. Une vague détruite fait apparaître la suivante, plus forte ;
// les aliens n'attaquent jamais de planète. Si toutes les vagues tombent avant l'échéance, l'invasion est repoussée :
// butin partagé au prorata des dégâts et bonus de production pour tous les joueurs. Sinon les aliens se retirent sans
// butin. Tous les réglages sont modifiables depuis la console admin et validés par `parseInvasionConfig`.
import { BOSS_LIMITS, fleetValue, isBossShip } from './boss';
import { MARKET_RESOURCES, type MarketResource } from './market';

export interface InvasionConfig {
  /** Les invasions peuvent démarrer et se combattre. Désactivé par défaut : l'administrateur règle puis active. */
  enabled: boolean;
  /** Jours entre la fin d'une invasion et le début automatique de la suivante (0 = lancement manuel seulement). */
  autoIntervalDays: number;
  /** Nombre de vagues de la campagne. */
  waves: number;
  /** Durée de la campagne en heures : au-delà, les aliens se retirent. */
  durationHours: number;
  /** Flotte de la première vague (identifiant de vaisseau → nombre). */
  waveShips: Record<number, number>;
  /** Facteur de croissance des effectifs d'une vague à la suivante (1 = vagues identiques). */
  waveGrowth: number;
  /** Niveaux de technologie des aliens (armes, bouclier, coque). */
  tech: { weapon: number; shield: number; armor: number };
  /** Part de la flotte d'une vague regagnée chaque heure (en %, 0 = aucune régénération). */
  regenPercentPerHour: number;
  /** Butin partagé à la destruction de chaque vague, au prorata des dégâts infligés à cette vague. */
  waveLoot: Record<MarketResource, number>;
  /** Butin partagé quand l'invasion est repoussée, au prorata des dégâts de toute la campagne. */
  finalLoot: Record<MarketResource, number>;
  /** Bonus de production offert à tous les joueurs quand l'invasion est repoussée (0 = aucun). */
  rewardProductionBonus: number;
  /** Durée de ce bonus, en jours. */
  rewardDays: number;
}

export const INVASION_DEFAULTS: InvasionConfig = {
  enabled: false,
  autoIntervalDays: 0,
  waves: 5,
  durationHours: 72,
  waveShips: { 204: 400, 205: 150, 206: 60, 207: 15 },
  waveGrowth: 1.35,
  tech: { weapon: 3, shield: 3, armor: 3 },
  regenPercentPerHour: 3,
  waveLoot: { metal: 1_500_000, crystal: 750_000, deuterium: 375_000 },
  finalLoot: { metal: 8_000_000, crystal: 4_000_000, deuterium: 2_000_000 },
  rewardProductionBonus: 0.2,
  rewardDays: 3,
};

export const INVASION_CONFIG_KEY = 'invasion.config';

export const INVASION_LIMITS = {
  autoIntervalDays: { min: 0, max: 90 },
  waves: { min: 1, max: 20 },
  durationHours: { min: 1, max: 720 },
  shipCount: BOSS_LIMITS.shipCount,
  waveGrowth: { min: 1, max: 3 },
  tech: BOSS_LIMITS.tech,
  regenPercentPerHour: BOSS_LIMITS.regenPercentPerHour,
  loot: BOSS_LIMITS.loot,
  rewardProductionBonus: { min: 0, max: 5 },
  rewardDays: { min: 1, max: 30 },
} as const;

/** Nombre de noms d'invasion traduits (`invasion.names.1` à `invasion.names.N`) : un nom est tiré à chaque invasion. */
export const INVASION_NAME_COUNT = 4;

/** Statuts d'une invasion : en cours, repoussée (toutes les vagues détruites), échouée (échéance dépassée), annulée. */
export type InvasionStatus = 'ACTIVE' | 'REPELLED' | 'FAILED' | 'CANCELLED';

/** Les aliens utilisent les mêmes vaisseaux que le boss (le satellite solaire ne combat pas). */
export const isInvasionShip = isBossShip;

/**
 * Flotte de la vague `index` (1 = première) : effectifs de la première vague multipliés par `growth^(index - 1)`,
 * arrondis à l'entier inférieur, avec au moins 1 vaisseau pour chaque type présent.
 */
export function waveFleet(base: Record<number, number>, growth: number, index: number): Record<number, number> {
  const factor = Math.pow(Math.max(1, growth), Math.max(0, Math.floor(index) - 1));
  const result: Record<number, number> = {};
  for (const [id, count] of Object.entries(base)) {
    if (!(count > 0)) continue;
    result[Number(id)] = Math.max(1, Math.floor(count * factor));
  }
  return result;
}

/** Valeur (équivalent métal) de la vague `index`. */
export function waveValue(base: Record<number, number>, growth: number, index: number): number {
  return fleetValue(waveFleet(base, growth, index));
}

/** Échéance de la campagne. */
export function invasionDeadline(startedAt: Date, durationHours: number): Date {
  return new Date(startedAt.getTime() + durationHours * 3_600_000);
}

/** Les aliens ont-ils dépassé l'échéance ? */
export function invasionExpired(endsAt: Date, now: Date): boolean {
  return now.getTime() >= endsAt.getTime();
}

/** Date du prochain lancement automatique : `autoIntervalDays` après la fin de la dernière invasion (null = manuel). */
export function nextAutoInvasionAt(lastFinishedAt: Date | null, autoIntervalDays: number): Date | null {
  if (autoIntervalDays <= 0) return null;
  return lastFinishedAt ? new Date(lastFinishedAt.getTime() + autoIntervalDays * 86_400_000) : new Date(0);
}

function strictNumber(value: unknown, min: number, max: number, label: string, errors: string[], integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    errors.push(`${label} doit être ${integer ? 'un entier ' : 'un nombre '}compris entre ${min} et ${max}`);
    return min;
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export type InvasionParse = { ok: true; config: InvasionConfig } | { ok: false; errors: string[] };

/** Valide un réglage complet envoyé par la console admin (rien n'est corrigé en silence). */
export function parseInvasionConfig(input: unknown): InvasionParse {
  const errors: string[] = [];
  const source = asRecord(input);
  const l = INVASION_LIMITS;
  if (typeof source.enabled !== 'boolean') errors.push('enabled doit être un booléen');
  const autoIntervalDays = strictNumber(source.autoIntervalDays, l.autoIntervalDays.min, l.autoIntervalDays.max, 'autoIntervalDays', errors, true);
  const waves = strictNumber(source.waves, l.waves.min, l.waves.max, 'waves', errors, true);
  const durationHours = strictNumber(source.durationHours, l.durationHours.min, l.durationHours.max, 'durationHours', errors, true);
  const waveGrowth = strictNumber(source.waveGrowth, l.waveGrowth.min, l.waveGrowth.max, 'waveGrowth', errors);
  const regenPercentPerHour = strictNumber(source.regenPercentPerHour, l.regenPercentPerHour.min, l.regenPercentPerHour.max, 'regenPercentPerHour', errors);
  const rewardProductionBonus = strictNumber(source.rewardProductionBonus, l.rewardProductionBonus.min, l.rewardProductionBonus.max, 'rewardProductionBonus', errors);
  const rewardDays = strictNumber(source.rewardDays, l.rewardDays.min, l.rewardDays.max, 'rewardDays', errors, true);

  const waveShips: Record<number, number> = {};
  const shipSource = asRecord(source.waveShips);
  if (Object.keys(shipSource).length === 0) errors.push('waveShips doit contenir au moins un vaisseau');
  for (const [key, count] of Object.entries(shipSource)) {
    const id = Number(key);
    if (!isInvasionShip(id)) {
      errors.push(`waveShips contient un vaisseau inconnu ou impossible : ${key}`);
      continue;
    }
    waveShips[id] = strictNumber(count, l.shipCount.min, l.shipCount.max, `waveShips.${key}`, errors, true);
  }

  const techSource = asRecord(source.tech);
  const tech = {
    weapon: strictNumber(techSource.weapon, l.tech.min, l.tech.max, 'tech.weapon', errors, true),
    shield: strictNumber(techSource.shield, l.tech.min, l.tech.max, 'tech.shield', errors, true),
    armor: strictNumber(techSource.armor, l.tech.min, l.tech.max, 'tech.armor', errors, true),
  };

  const readLoot = (value: unknown, label: string) => {
    const lootSource = asRecord(value);
    const loot = {} as Record<MarketResource, number>;
    for (const resource of MARKET_RESOURCES) {
      loot[resource] = strictNumber(lootSource[resource], l.loot.min, l.loot.max, `${label}.${resource}`, errors, true);
    }
    return loot;
  };
  const waveLoot = readLoot(source.waveLoot, 'waveLoot');
  const finalLoot = readLoot(source.finalLoot, 'finalLoot');

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    config: {
      enabled: source.enabled as boolean,
      autoIntervalDays,
      waves,
      durationHours,
      waveShips,
      waveGrowth,
      tech,
      regenPercentPerHour,
      waveLoot,
      finalLoot,
      rewardProductionBonus,
      rewardDays,
    },
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(Math.max(number, min), max);
}

/** Relit un réglage stocké : valeur absente ou invalide → défaut (un enregistrement corrompu ne bloque rien). */
export function readInvasionConfig(raw: string | null | undefined): InvasionConfig {
  if (!raw) return INVASION_DEFAULTS;
  let stored: Record<string, unknown>;
  try {
    stored = asRecord(JSON.parse(raw));
  } catch {
    return INVASION_DEFAULTS;
  }
  const d = INVASION_DEFAULTS;
  const l = INVASION_LIMITS;
  const waveShips: Record<number, number> = {};
  for (const [key, count] of Object.entries(asRecord(stored.waveShips))) {
    const id = Number(key);
    if (isInvasionShip(id) && typeof count === 'number' && Number.isFinite(count) && count >= 1) {
      waveShips[id] = Math.min(Math.floor(count), l.shipCount.max);
    }
  }
  const techSource = asRecord(stored.tech);
  const readLoot = (value: unknown, fallback: Record<MarketResource, number>) => {
    const lootSource = asRecord(value);
    const loot = {} as Record<MarketResource, number>;
    for (const resource of MARKET_RESOURCES) loot[resource] = Math.floor(clamp(lootSource[resource], l.loot.min, l.loot.max, fallback[resource]));
    return loot;
  };
  return {
    enabled: typeof stored.enabled === 'boolean' ? stored.enabled : d.enabled,
    autoIntervalDays: Math.round(clamp(stored.autoIntervalDays, l.autoIntervalDays.min, l.autoIntervalDays.max, d.autoIntervalDays)),
    waves: Math.round(clamp(stored.waves, l.waves.min, l.waves.max, d.waves)),
    durationHours: Math.round(clamp(stored.durationHours, l.durationHours.min, l.durationHours.max, d.durationHours)),
    waveShips: Object.keys(waveShips).length > 0 ? waveShips : d.waveShips,
    waveGrowth: clamp(stored.waveGrowth, l.waveGrowth.min, l.waveGrowth.max, d.waveGrowth),
    tech: {
      weapon: Math.round(clamp(techSource.weapon, l.tech.min, l.tech.max, d.tech.weapon)),
      shield: Math.round(clamp(techSource.shield, l.tech.min, l.tech.max, d.tech.shield)),
      armor: Math.round(clamp(techSource.armor, l.tech.min, l.tech.max, d.tech.armor)),
    },
    regenPercentPerHour: clamp(stored.regenPercentPerHour, l.regenPercentPerHour.min, l.regenPercentPerHour.max, d.regenPercentPerHour),
    waveLoot: readLoot(stored.waveLoot, d.waveLoot),
    finalLoot: readLoot(stored.finalLoot, d.finalLoot),
    rewardProductionBonus: clamp(stored.rewardProductionBonus, l.rewardProductionBonus.min, l.rewardProductionBonus.max, d.rewardProductionBonus),
    rewardDays: Math.round(clamp(stored.rewardDays, l.rewardDays.min, l.rewardDays.max, d.rewardDays)),
  };
}

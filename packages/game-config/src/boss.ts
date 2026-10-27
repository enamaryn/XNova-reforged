// Boss galactiques : une flotte monstrueuse unique, cachée en position 16 (espace profond) d'un système au hasard.
// Elle n'attaque jamais de planète. Les joueurs la combattent par une attaque normale vers sa position ; elle peut
// aussi intercepter une expédition qui arrive dans son système. Ses dégâts persistent entre les combats (elle se
// régénère lentement) ; à sa mort, un butin est partagé au prorata des dégâts et elle réapparaît ailleurs après un délai.
// Tous les réglages sont modifiables depuis la console admin et validés par `parseBossConfig`.
import { MARKET_REFERENCE_VALUE, MARKET_RESOURCES, type MarketResource } from './market';
import { SHIPS } from './ships';

export interface BossConfig {
  /** Le boss apparaît et se bat. Désactivé par défaut : l'administrateur règle puis active. */
  enabled: boolean;
  /** Jours entre la mort du boss et sa réapparition, à un endroit tiré au hasard. */
  respawnDays: number;
  /** Probabilité qu'il intercepte une expédition qui arrive dans son système (0 = jamais, 1 = toujours). */
  aggroChance: number;
  /** Part de sa flotte maximale qu'il regagne chaque heure (en %, 0 = aucune régénération). */
  regenPercentPerHour: number;
  /** Flotte maximale du boss (identifiant de vaisseau → nombre). */
  ships: Record<number, number>;
  /** Niveaux de technologie du boss (armes, bouclier, coque). */
  tech: { weapon: number; shield: number; armor: number };
  /** Butin partagé à sa mort, au prorata des dégâts infligés. */
  loot: Record<MarketResource, number>;
}

export const BOSS_DEFAULTS: BossConfig = {
  enabled: false,
  respawnDays: 7,
  aggroChance: 0.5,
  regenPercentPerHour: 2,
  ships: { 204: 5000, 205: 2000, 206: 1000, 207: 300 },
  tech: { weapon: 5, shield: 5, armor: 5 },
  loot: { metal: 20_000_000, crystal: 10_000_000, deuterium: 5_000_000 },
};

export const BOSS_CONFIG_KEY = 'boss.config';

export const BOSS_LIMITS = {
  respawnDays: { min: 1, max: 60 },
  aggroChance: { min: 0, max: 1 },
  regenPercentPerHour: { min: 0, max: 100 },
  shipCount: { min: 1, max: 100_000_000 },
  tech: { min: 0, max: 30 },
  loot: { min: 0, max: 1_000_000_000_000 },
} as const;

/** Nombre de noms de boss traduits (`boss.names.1` à `boss.names.N`) : un nom est tiré à chaque apparition. */
export const BOSS_NAME_COUNT = 5;

/** Le satellite solaire ne combat pas : il ne peut pas faire partie de la flotte du boss. */
export function isBossShip(shipId: number): boolean {
  return Number.isInteger(shipId) && shipId in SHIPS && shipId !== 212;
}

/** Coût d'une flotte (valeur équivalent métal des coûts du chantier spatial). */
export function fleetValue(ships: Record<number, number>): number {
  let total = 0;
  for (const [id, count] of Object.entries(ships)) {
    const ship = SHIPS[Number(id)];
    if (!ship || !(count > 0)) continue;
    for (const resource of MARKET_RESOURCES) total += ship.cost[resource] * MARKET_REFERENCE_VALUE[resource] * count;
  }
  return total;
}

/** Nombre total de vaisseaux d'une flotte. */
export function shipTotal(ships: Record<number, number>): number {
  return Object.values(ships).reduce((sum, count) => sum + Math.max(0, Math.floor(Number(count) || 0)), 0);
}

/** Part restante de la flotte maximale, en valeur (0 à 1). */
export function bossHealthRatio(current: Record<number, number>, max: Record<number, number>): number {
  const maxValue = fleetValue(max);
  return maxValue > 0 ? Math.min(1, fleetValue(current) / maxValue) : 0;
}

/** Date de réapparition : `respawnDays` jours après la mort. */
export function bossRespawnAt(diedAt: Date, respawnDays: number): Date {
  return new Date(diedAt.getTime() + respawnDays * 86_400_000);
}

/**
 * Régénération : chaque type de vaisseau regagne `pourcentage × heures` de son effectif maximal (arrondi au-dessus,
 * jamais au-delà du maximum). Un type entièrement détruit revient donc aussi, progressivement.
 */
export function regenerateBossFleet(
  current: Record<number, number>,
  max: Record<number, number>,
  hours: number,
  percentPerHour: number,
): Record<number, number> {
  const result: Record<number, number> = {};
  const factor = Math.max(0, hours) * Math.max(0, percentPerHour) / 100;
  for (const [id, maxCount] of Object.entries(max)) {
    const now = Math.max(0, Math.floor(Number(current[Number(id)]) || 0));
    const regained = factor > 0 ? Math.ceil(maxCount * factor) : 0;
    const value = Math.min(maxCount, now + regained);
    if (value > 0) result[Number(id)] = value;
  }
  return result;
}

/** L'expédition est-elle interceptée ? `roll` est un tirage uniforme dans [0, 1[. */
export function bossIntercepts(roll: number, aggroChance: number): boolean {
  return aggroChance > 0 && roll < aggroChance;
}

/**
 * Partage du butin au prorata des dégâts (arrondi vers le bas : jamais plus que le butin). Les dégâts nuls ou
 * négatifs ne reçoivent rien.
 */
export function splitBossLoot(
  loot: Record<MarketResource, number>,
  damages: Array<{ key: string; damage: number }>,
): Record<string, Record<MarketResource, number>> {
  const positive = damages.filter((entry) => entry.damage > 0);
  const total = positive.reduce((sum, entry) => sum + entry.damage, 0);
  const result: Record<string, Record<MarketResource, number>> = {};
  for (const entry of positive) {
    const share = total > 0 ? entry.damage / total : 0;
    result[entry.key] = {
      metal: Math.floor(loot.metal * share),
      crystal: Math.floor(loot.crystal * share),
      deuterium: Math.floor(loot.deuterium * share),
    };
  }
  return result;
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

export type BossParse = { ok: true; config: BossConfig } | { ok: false; errors: string[] };

/** Valide un réglage complet envoyé par la console admin (rien n'est corrigé en silence). */
export function parseBossConfig(input: unknown): BossParse {
  const errors: string[] = [];
  const source = asRecord(input);
  const l = BOSS_LIMITS;
  if (typeof source.enabled !== 'boolean') errors.push('enabled doit être un booléen');
  const respawnDays = strictNumber(source.respawnDays, l.respawnDays.min, l.respawnDays.max, 'respawnDays', errors, true);
  const aggroChance = strictNumber(source.aggroChance, l.aggroChance.min, l.aggroChance.max, 'aggroChance', errors);
  const regenPercentPerHour = strictNumber(source.regenPercentPerHour, l.regenPercentPerHour.min, l.regenPercentPerHour.max, 'regenPercentPerHour', errors);

  const ships: Record<number, number> = {};
  const shipSource = asRecord(source.ships);
  if (Object.keys(shipSource).length === 0) errors.push('ships doit contenir au moins un vaisseau');
  for (const [key, count] of Object.entries(shipSource)) {
    const id = Number(key);
    if (!isBossShip(id)) {
      errors.push(`ships contient un vaisseau inconnu ou impossible : ${key}`);
      continue;
    }
    ships[id] = strictNumber(count, l.shipCount.min, l.shipCount.max, `ships.${key}`, errors, true);
  }

  const techSource = asRecord(source.tech);
  const tech = {
    weapon: strictNumber(techSource.weapon, l.tech.min, l.tech.max, 'tech.weapon', errors, true),
    shield: strictNumber(techSource.shield, l.tech.min, l.tech.max, 'tech.shield', errors, true),
    armor: strictNumber(techSource.armor, l.tech.min, l.tech.max, 'tech.armor', errors, true),
  };
  const lootSource = asRecord(source.loot);
  const loot = {} as Record<MarketResource, number>;
  for (const resource of MARKET_RESOURCES) {
    loot[resource] = strictNumber(lootSource[resource], l.loot.min, l.loot.max, `loot.${resource}`, errors, true);
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    config: { enabled: source.enabled as boolean, respawnDays, aggroChance, regenPercentPerHour, ships, tech, loot },
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(Math.max(number, min), max);
}

/** Relit un réglage stocké : valeur absente ou invalide → défaut (un enregistrement corrompu ne bloque rien). */
export function readBossConfig(raw: string | null | undefined): BossConfig {
  if (!raw) return BOSS_DEFAULTS;
  let stored: Record<string, unknown>;
  try {
    stored = asRecord(JSON.parse(raw));
  } catch {
    return BOSS_DEFAULTS;
  }
  const d = BOSS_DEFAULTS;
  const l = BOSS_LIMITS;
  const ships: Record<number, number> = {};
  for (const [key, count] of Object.entries(asRecord(stored.ships))) {
    const id = Number(key);
    if (isBossShip(id) && typeof count === 'number' && Number.isFinite(count) && count >= 1) {
      ships[id] = Math.min(Math.floor(count), l.shipCount.max);
    }
  }
  const techSource = asRecord(stored.tech);
  const lootSource = asRecord(stored.loot);
  const loot = {} as Record<MarketResource, number>;
  for (const resource of MARKET_RESOURCES) loot[resource] = Math.floor(clamp(lootSource[resource], l.loot.min, l.loot.max, d.loot[resource]));
  return {
    enabled: typeof stored.enabled === 'boolean' ? stored.enabled : d.enabled,
    respawnDays: Math.round(clamp(stored.respawnDays, l.respawnDays.min, l.respawnDays.max, d.respawnDays)),
    aggroChance: clamp(stored.aggroChance, l.aggroChance.min, l.aggroChance.max, d.aggroChance),
    regenPercentPerHour: clamp(stored.regenPercentPerHour, l.regenPercentPerHour.min, l.regenPercentPerHour.max, d.regenPercentPerHour),
    ships: Object.keys(ships).length > 0 ? ships : d.ships,
    tech: {
      weapon: Math.round(clamp(techSource.weapon, l.tech.min, l.tech.max, d.tech.weapon)),
      shield: Math.round(clamp(techSource.shield, l.tech.min, l.tech.max, d.tech.shield)),
      armor: Math.round(clamp(techSource.armor, l.tech.min, l.tech.max, d.tech.armor)),
    },
    loot,
  };
}

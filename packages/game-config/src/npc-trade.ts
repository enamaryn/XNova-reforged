// Commerce avec un PNJ : échange instantané de ressources et achat de vaisseaux à un marchand de la galaxie.
// Les taux varient chaque jour (variation déterministe) et selon la saison (UTC) ; tous les réglages sont
// modifiables depuis la console admin et validés par `parseNpcTradeConfig`.
import { MARKET_REFERENCE_VALUE, MARKET_RESOURCES, type MarketResource } from './market';
import { SHIPS } from './ships';

export const NPC_SEASONS = ['winter', 'spring', 'summer', 'autumn'] as const;
export type NpcSeason = (typeof NPC_SEASONS)[number];

export interface NpcSeasonSettings {
  /** Valeur que le marchand donne à chaque ressource cette saison (multiplie la valeur de référence). */
  values: Record<MarketResource, number>;
  /** Part de la marge du marchand supprimée cette saison (0,25 = marge réduite d'un quart). */
  spreadReduction: number;
  /** Remise sur le prix des vaisseaux cette saison (0,1 = 10 % moins cher). */
  shipDiscount: number;
}

export interface NpcTradeConfig {
  enabled: boolean;
  /** Marge du marchand sur un échange de ressources (0,15 = le joueur reçoit 15 % de moins que la parité). */
  spread: number;
  /** Amplitude de la variation quotidienne des valeurs et du prix des vaisseaux (0,1 = ± 10 %). */
  dailyVariation: number;
  /** Plafond quotidien par joueur, en valeur équivalent métal des ressources données. */
  exchangeDailyCap: number;
  /** Plafond quotidien par joueur, en valeur équivalent métal du prix des vaisseaux achetés. */
  shipDailyCap: number;
  /** Prix d'un vaisseau chez le marchand, en multiple de son coût au chantier spatial. */
  shipPriceMultiplier: number;
  /** Vaisseaux proposés (identifiants). Aucun prérequis de recherche ou de bâtiment n'est exigé. */
  ships: number[];
  seasons: Record<NpcSeason, NpcSeasonSettings>;
}

export const NPC_TRADE_DEFAULTS: NpcTradeConfig = {
  enabled: true,
  spread: 0.15,
  dailyVariation: 0.1,
  exchangeDailyCap: 20_000_000,
  shipDailyCap: 20_000_000,
  shipPriceMultiplier: 1.5,
  ships: [202, 203, 204, 209, 210],
  seasons: {
    winter: { values: { metal: 1, crystal: 1, deuterium: 1.15 }, spreadReduction: 0.1, shipDiscount: 0.05 },
    spring: { values: { metal: 1, crystal: 1, deuterium: 1 }, spreadReduction: 0.25, shipDiscount: 0 },
    summer: { values: { metal: 1, crystal: 1.1, deuterium: 0.9 }, spreadReduction: 0, shipDiscount: 0.1 },
    autumn: { values: { metal: 1.1, crystal: 1, deuterium: 1 }, spreadReduction: 0.2, shipDiscount: 0 },
  },
};

/** Clé de stockage du réglage dans `GameConfig`. */
export const NPC_TRADE_CONFIG_KEY = 'npcTrade.config';

/** Bornes acceptées pour les réglages admin. */
export const NPC_TRADE_LIMITS = {
  spread: { min: 0, max: 0.5 },
  dailyVariation: { min: 0, max: 0.5 },
  cap: { min: 0, max: 1_000_000_000_000 },
  shipPriceMultiplier: { min: 0.5, max: 10 },
  seasonValue: { min: 0.25, max: 4 },
  fraction: { min: 0, max: 1 },
} as const;

/** Quantité maximale par opération (exclut les valeurs absurdes ou imprécises en virgule flottante). */
export const NPC_TRADE_MAX_AMOUNT = 1_000_000_000_000;

/** Le satellite solaire modifie l'énergie à l'arrivée : il reste réservé au chantier spatial. */
export const NPC_TRADE_EXCLUDED_SHIPS: readonly number[] = [212];

export function isNpcSellableShip(shipId: number): boolean {
  return Number.isInteger(shipId) && shipId in SHIPS && !NPC_TRADE_EXCLUDED_SHIPS.includes(shipId);
}

export function seasonOf(date: Date): NpcSeason {
  const month = date.getUTCMonth() + 1;
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'autumn';
}

/** Jour UTC au format AAAA-MM-JJ. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Début du jour UTC (le plafond quotidien se remet à zéro à ce moment). */
export function dayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Bruit déterministe dans [-1 ; 1] pour un jour et une étiquette (même valeur pour tous les joueurs). */
export function dailyNoise(day: string, label: string): number {
  const text = `${day}|${label}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash / 0xffffffff) * 2 - 1;
}

/** Valeur d'une unité de ressource chez le marchand ce jour-là. */
export function npcResourceValue(resource: MarketResource, date: Date, config: NpcTradeConfig): number {
  const season = config.seasons[seasonOf(date)];
  const variation = 1 + config.dailyVariation * dailyNoise(dayKey(date), resource);
  return MARKET_REFERENCE_VALUE[resource] * season.values[resource] * variation;
}

/** Marge effective : réglage de base, réduite par la saison puis par l'éventuel événement du monde. */
export function effectiveSpread(config: NpcTradeConfig, date: Date, eventReduction = 0): number {
  const season = config.seasons[seasonOf(date)];
  const reduction = Math.min(Math.max(eventReduction, 0), 1);
  return config.spread * (1 - season.spreadReduction) * (1 - reduction);
}

export interface NpcQuote {
  give: MarketResource;
  want: MarketResource;
  /** Unités de `want` reçues pour une unité de `give`, marge comprise. */
  rate: number;
}

export function exchangeRate(
  give: MarketResource,
  want: MarketResource,
  date: Date,
  config: NpcTradeConfig,
  eventReduction = 0,
): number {
  const parity = npcResourceValue(give, date, config) / npcResourceValue(want, date, config);
  return parity * (1 - effectiveSpread(config, date, eventReduction));
}

/** Quantité reçue pour `amount` donnés (arrondie vers le bas, jamais en faveur du joueur). */
export function exchangeReceive(
  give: MarketResource,
  want: MarketResource,
  amount: number,
  date: Date,
  config: NpcTradeConfig,
  eventReduction = 0,
): number {
  return Math.floor(amount * exchangeRate(give, want, date, config, eventReduction));
}

/** Valeur équivalent métal (valeurs de référence, stables) d'un coût en ressources. */
export function metalValue(cost: Record<MarketResource, number>): number {
  return MARKET_RESOURCES.reduce((sum, resource) => sum + cost[resource] * MARKET_REFERENCE_VALUE[resource], 0);
}

/** Facteur de prix des vaisseaux ce jour-là (multiplicateur, saison et variation quotidienne). */
export function shipPriceFactor(date: Date, config: NpcTradeConfig): number {
  const season = config.seasons[seasonOf(date)];
  return (
    config.shipPriceMultiplier * (1 - season.shipDiscount) * (1 + config.dailyVariation * dailyNoise(dayKey(date), 'ships'))
  );
}

/**
 * Prix d'un vaisseau : coût du chantier spatial (déjà multiplié par le coefficient du serveur) × facteur du jour,
 * arrondi à l'unité supérieure.
 */
export function shipUnitPrice(
  baseCost: Record<MarketResource, number>,
  date: Date,
  config: NpcTradeConfig,
): Record<MarketResource, number> {
  const factor = shipPriceFactor(date, config);
  return {
    metal: Math.ceil(baseCost.metal * factor),
    crystal: Math.ceil(baseCost.crystal * factor),
    deuterium: Math.ceil(baseCost.deuterium * factor),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(Math.max(number, min), max);
}

function strictNumber(value: unknown, min: number, max: number, label: string, errors: string[]): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    errors.push(`${label} doit être compris entre ${min} et ${max}`);
    return min;
  }
  return value;
}

export type NpcTradeParse = { ok: true; config: NpcTradeConfig } | { ok: false; errors: string[] };

/** Valide un réglage complet envoyé par la console admin (rien n'est corrigé en silence). */
export function parseNpcTradeConfig(input: unknown): NpcTradeParse {
  const errors: string[] = [];
  const source = asRecord(input);
  const limits = NPC_TRADE_LIMITS;

  if (typeof source.enabled !== 'boolean') errors.push('enabled doit être un booléen');
  const spread = strictNumber(source.spread, limits.spread.min, limits.spread.max, 'spread', errors);
  const dailyVariation = strictNumber(
    source.dailyVariation,
    limits.dailyVariation.min,
    limits.dailyVariation.max,
    'dailyVariation',
    errors,
  );
  const exchangeDailyCap = strictNumber(source.exchangeDailyCap, limits.cap.min, limits.cap.max, 'exchangeDailyCap', errors);
  const shipDailyCap = strictNumber(source.shipDailyCap, limits.cap.min, limits.cap.max, 'shipDailyCap', errors);
  const shipPriceMultiplier = strictNumber(
    source.shipPriceMultiplier,
    limits.shipPriceMultiplier.min,
    limits.shipPriceMultiplier.max,
    'shipPriceMultiplier',
    errors,
  );

  let ships: number[] = [];
  if (!Array.isArray(source.ships)) {
    errors.push('ships doit être une liste');
  } else {
    const list = source.ships as unknown[];
    const valid = list.every((id) => typeof id === 'number' && isNpcSellableShip(id));
    if (!valid || new Set(list).size !== list.length) {
      errors.push('ships contient un vaisseau inconnu, non vendable ou en double');
    } else {
      ships = list as number[];
    }
  }

  const seasons = {} as Record<NpcSeason, NpcSeasonSettings>;
  for (const season of NPC_SEASONS) {
    const entry = asRecord(asRecord(source.seasons)[season]);
    const values = {} as Record<MarketResource, number>;
    for (const resource of MARKET_RESOURCES) {
      values[resource] = strictNumber(
        asRecord(entry.values)[resource],
        limits.seasonValue.min,
        limits.seasonValue.max,
        `seasons.${season}.values.${resource}`,
        errors,
      );
    }
    seasons[season] = {
      values,
      spreadReduction: strictNumber(
        entry.spreadReduction,
        limits.fraction.min,
        limits.fraction.max,
        `seasons.${season}.spreadReduction`,
        errors,
      ),
      shipDiscount: strictNumber(
        entry.shipDiscount,
        limits.fraction.min,
        limits.fraction.max,
        `seasons.${season}.shipDiscount`,
        errors,
      ),
    };
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    config: {
      enabled: source.enabled as boolean,
      spread,
      dailyVariation,
      exchangeDailyCap,
      shipDailyCap,
      shipPriceMultiplier,
      ships: [...ships].sort((a, b) => a - b),
      seasons,
    },
  };
}

/**
 * Relit un réglage stocké (JSON texte) : toute valeur absente ou invalide retombe sur la valeur par défaut,
 * pour qu'un enregistrement ancien ou corrompu ne bloque jamais le commerce.
 */
export function readNpcTradeConfig(raw: string | null | undefined): NpcTradeConfig {
  if (!raw) return NPC_TRADE_DEFAULTS;
  let stored: Record<string, unknown>;
  try {
    stored = asRecord(JSON.parse(raw));
  } catch {
    return NPC_TRADE_DEFAULTS;
  }
  const d = NPC_TRADE_DEFAULTS;
  const l = NPC_TRADE_LIMITS;
  const seasons = {} as Record<NpcSeason, NpcSeasonSettings>;
  for (const season of NPC_SEASONS) {
    const fallback = d.seasons[season];
    const entry = asRecord(asRecord(stored.seasons)[season]);
    const values = {} as Record<MarketResource, number>;
    for (const resource of MARKET_RESOURCES) {
      values[resource] = clampNumber(asRecord(entry.values)[resource], l.seasonValue.min, l.seasonValue.max, fallback.values[resource]);
    }
    seasons[season] = {
      values,
      spreadReduction: clampNumber(entry.spreadReduction, l.fraction.min, l.fraction.max, fallback.spreadReduction),
      shipDiscount: clampNumber(entry.shipDiscount, l.fraction.min, l.fraction.max, fallback.shipDiscount),
    };
  }
  const ships = Array.isArray(stored.ships)
    ? [...new Set((stored.ships as unknown[]).filter((id): id is number => typeof id === 'number' && isNpcSellableShip(id)))]
    : d.ships;
  return {
    enabled: typeof stored.enabled === 'boolean' ? stored.enabled : d.enabled,
    spread: clampNumber(stored.spread, l.spread.min, l.spread.max, d.spread),
    dailyVariation: clampNumber(stored.dailyVariation, l.dailyVariation.min, l.dailyVariation.max, d.dailyVariation),
    exchangeDailyCap: clampNumber(stored.exchangeDailyCap, l.cap.min, l.cap.max, d.exchangeDailyCap),
    shipDailyCap: clampNumber(stored.shipDailyCap, l.cap.min, l.cap.max, d.shipDailyCap),
    shipPriceMultiplier: clampNumber(
      stored.shipPriceMultiplier,
      l.shipPriceMultiplier.min,
      l.shipPriceMultiplier.max,
      d.shipPriceMultiplier,
    ),
    ships,
    seasons,
  };
}

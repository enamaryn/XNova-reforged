import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_LOCALE, GAME_CONSTANTS, isSupportedLocale, type SupportedLocale } from '@xnova/game-config';
import { type ResourceConfig } from '@xnova/game-engine';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';

export interface ServerConfigValues {
  gameSpeed: number;
  fleetSpeed: number;
  resourceMultiplier: number;
  buildingCostMultiplier: number;
  researchCostMultiplier: number;
  shipCostMultiplier: number;
  planetSize: number;
  maxBuildingLevel: number;
  maxTechnologyLevel: number;
  baseMetal: number;
  baseCrystal: number;
  baseDeuterium: number;
  /** Langue du serveur : langue par défaut du jeu, des emails et de l'interface (choisie à l'installation). */
  language: SupportedLocale;
}

/** Clé de la langue du serveur dans GameConfig (valeur texte, hors réglages numériques). */
export const SERVER_LANGUAGE_KEY = 'server.language';

const CONFIG_KEYS: Record<Exclude<keyof ServerConfigValues, 'language'>, string> = {
  gameSpeed: 'gameSpeed',
  fleetSpeed: 'fleetSpeed',
  resourceMultiplier: 'resourceMultiplier',
  buildingCostMultiplier: 'buildingCostMultiplier',
  researchCostMultiplier: 'researchCostMultiplier',
  shipCostMultiplier: 'shipCostMultiplier',
  planetSize: 'planetSize',
  maxBuildingLevel: 'maxBuildingLevel',
  maxTechnologyLevel: 'maxTechnologyLevel',
  baseMetal: 'baseMetal',
  baseCrystal: 'baseCrystal',
  baseDeuterium: 'baseDeuterium',
};

@Injectable()
export class ServerConfigService {
  private cache: { value: ServerConfigValues; loadedAt: number } | null = null;
  private readonly cacheTtlMs = 30_000;
  private readonly cacheTtlSeconds = 30;
  private readonly cacheKey = 'xnova:server-config';

  constructor(
    private readonly database: DatabaseService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async getConfig(force = false): Promise<ServerConfigValues> {
    if (!force && this.cache && Date.now() - this.cache.loadedAt < this.cacheTtlMs) {
      return this.cache.value;
    }

    if (!force) {
      const cached = await this.redis.getJson<ServerConfigValues>(this.cacheKey);
      if (cached && cached.language) {
        this.cache = { value: cached, loadedAt: Date.now() };
        return cached;
      }
    }

    const defaults = this.getDefaults();
    const entries = await this.database.gameConfig.findMany({
      where: {
        key: { in: [...Object.values(CONFIG_KEYS), SERVER_LANGUAGE_KEY] },
      },
    });
    const storedLanguage = entries.find((entry) => entry.key === SERVER_LANGUAGE_KEY)?.value;

    const fromDb: Record<string, number> = entries.reduce((acc, entry) => {
      if (entry.key === SERVER_LANGUAGE_KEY) return acc;
      const parsed = Number(entry.value);
      if (!Number.isNaN(parsed)) {
        acc[entry.key] = parsed;
      }
      return acc;
    }, {} as Record<string, number>);

    const config: ServerConfigValues = {
      gameSpeed: fromDb[CONFIG_KEYS.gameSpeed] ?? defaults.gameSpeed,
      fleetSpeed: fromDb[CONFIG_KEYS.fleetSpeed] ?? defaults.fleetSpeed,
      resourceMultiplier: fromDb[CONFIG_KEYS.resourceMultiplier] ?? defaults.resourceMultiplier,
      buildingCostMultiplier:
        fromDb[CONFIG_KEYS.buildingCostMultiplier] ?? defaults.buildingCostMultiplier,
      researchCostMultiplier:
        fromDb[CONFIG_KEYS.researchCostMultiplier] ?? defaults.researchCostMultiplier,
      shipCostMultiplier: fromDb[CONFIG_KEYS.shipCostMultiplier] ?? defaults.shipCostMultiplier,
      planetSize: fromDb[CONFIG_KEYS.planetSize] ?? defaults.planetSize,
      maxBuildingLevel: fromDb[CONFIG_KEYS.maxBuildingLevel] ?? defaults.maxBuildingLevel,
      maxTechnologyLevel: fromDb[CONFIG_KEYS.maxTechnologyLevel] ?? defaults.maxTechnologyLevel,
      baseMetal: fromDb[CONFIG_KEYS.baseMetal] ?? defaults.baseMetal,
      baseCrystal: fromDb[CONFIG_KEYS.baseCrystal] ?? defaults.baseCrystal,
      baseDeuterium: fromDb[CONFIG_KEYS.baseDeuterium] ?? defaults.baseDeuterium,
      language: isSupportedLocale(storedLanguage) ? storedLanguage : defaults.language,
    };

    this.cache = { value: config, loadedAt: Date.now() };
    await this.redis.setJson(this.cacheKey, config, this.cacheTtlSeconds);
    return config;
  }

  async updateConfig(
    userId: string,
    updates: Partial<ServerConfigValues>,
  ): Promise<ServerConfigValues> {
    return this.writeConfig(updates, userId);
  }

  /** Écrit les réglages sans journal d'audit : parcours d'installation, avant l'existence de tout compte. */
  async applyConfig(updates: Partial<ServerConfigValues>): Promise<ServerConfigValues> {
    return this.writeConfig(updates, null);
  }

  private async writeConfig(
    updates: Partial<ServerConfigValues>,
    auditUserId: string | null,
  ): Promise<ServerConfigValues> {
    const current = await this.getConfig();
    const { language, ...numeric } = updates;
    const entries = Object.entries(numeric).filter(([, value]) => value !== undefined);
    const languageChange =
      language !== undefined && isSupportedLocale(language) && language !== current.language ? language : null;

    if (entries.length === 0 && !languageChange) {
      return current;
    }

    const before: Record<string, number | string> = {};
    const after: Record<string, number | string> = {};
    if (languageChange) {
      before.language = current.language;
      after.language = languageChange;
    }

    entries.forEach(([key, value]) => {
      const typedKey = key as keyof ServerConfigValues;
      before[typedKey] = current[typedKey as Exclude<keyof ServerConfigValues, 'language'>];
      after[typedKey] = value as number;
    });

    await this.database.$transaction([
      ...(languageChange
        ? [
            this.database.gameConfig.upsert({
              where: { key: SERVER_LANGUAGE_KEY },
              create: { key: SERVER_LANGUAGE_KEY, value: languageChange },
              update: { value: languageChange },
            }),
          ]
        : []),
      ...entries.map(([key, value]) =>
        this.database.gameConfig.upsert({
          where: { key },
          create: { key, value: String(value) },
          update: { value: String(value) },
        }),
      ),
      ...(auditUserId
        ? [
            this.database.adminAuditLog.create({
              data: {
                userId: auditUserId,
                action: 'update_config',
                changes: {
                  before,
                  after,
                },
              },
            }),
          ]
        : []),
    ]);

    this.cache = null;
    await this.redis.del(this.cacheKey);
    return this.getConfig(true);
  }

  async getResourceConfig(): Promise<ResourceConfig> {
    const config = await this.getConfig();
    return {
      baseIncome: {
        metal: config.baseMetal,
        crystal: config.baseCrystal,
        deuterium: config.baseDeuterium,
      },
      resourceMultiplier: config.resourceMultiplier,
      gameSpeed: config.gameSpeed,
      storageBase: 1_000_000,
      storageFactor: 1.5,
      storageOverflow: 1.1,
    };
  }

  private getDefaults(): ServerConfigValues {
    return {
      gameSpeed: this.getEnvNumber('GAME_SPEED', 1),
      fleetSpeed: this.getEnvNumber('FLEET_SPEED', 1),
      resourceMultiplier: this.getEnvNumber('RESOURCE_MULTIPLIER', 1),
      buildingCostMultiplier: this.getEnvNumber('BUILDING_COST_MULTIPLIER', 1),
      researchCostMultiplier: this.getEnvNumber('RESEARCH_COST_MULTIPLIER', 1),
      shipCostMultiplier: this.getEnvNumber('SHIP_COST_MULTIPLIER', 1),
      planetSize: GAME_CONSTANTS.INITIAL_FIELDS,
      maxBuildingLevel: this.getEnvNumber('MAX_BUILDING_LEVEL', 100),
      maxTechnologyLevel: this.getEnvNumber('MAX_TECH_LEVEL', 100),
      baseMetal: 20,
      baseCrystal: 10,
      baseDeuterium: 0,
      language: this.getDefaultLanguage(),
    };
  }

  /** Langue par défaut avant tout choix : variable DEFAULT_LANGUAGE (si valide), sinon le français. */
  private getDefaultLanguage(): SupportedLocale {
    const raw = this.configService.get<string>('DEFAULT_LANGUAGE');
    return isSupportedLocale(raw) ? raw : DEFAULT_LOCALE;
  }

  /** Langue du serveur (jamais lue depuis le cache de requête : voir getConfig). */
  async getLanguage(): Promise<SupportedLocale> {
    return (await this.getConfig()).language;
  }

  private getEnvNumber(key: string, fallback: number) {
    const rawValue = this.configService.get<string>(key);
    if (!rawValue) return fallback;
    const parsed = Number(rawValue);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
}

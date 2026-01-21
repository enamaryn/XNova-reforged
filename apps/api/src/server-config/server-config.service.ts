import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GAME_CONSTANTS } from '@xnova/game-config';
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
}

const CONFIG_KEYS: Record<keyof ServerConfigValues, string> = {
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
      if (cached) {
        this.cache = { value: cached, loadedAt: Date.now() };
        return cached;
      }
    }

    const defaults = this.getDefaults();
    const entries = await this.database.gameConfig.findMany({
      where: {
        key: { in: Object.values(CONFIG_KEYS) },
      },
    });

    const fromDb: Record<string, number> = entries.reduce((acc, entry) => {
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
    };

    this.cache = { value: config, loadedAt: Date.now() };
    await this.redis.setJson(this.cacheKey, config, this.cacheTtlSeconds);
    return config;
  }

  async updateConfig(
    userId: string,
    updates: Partial<ServerConfigValues>,
  ): Promise<ServerConfigValues> {
    const current = await this.getConfig();
    const entries = Object.entries(updates).filter(([, value]) => value !== undefined);

    if (entries.length === 0) {
      return current;
    }

    const before: Record<string, number> = {};
    const after: Record<string, number> = {};

    entries.forEach(([key, value]) => {
      const typedKey = key as keyof ServerConfigValues;
      before[typedKey] = current[typedKey];
      after[typedKey] = value as number;
    });

    await this.database.$transaction([
      ...entries.map(([key, value]) =>
        this.database.gameConfig.upsert({
          where: { key },
          create: { key, value: String(value) },
          update: { value: String(value) },
        }),
      ),
      this.database.adminAuditLog.create({
        data: {
          userId,
          action: 'update_config',
          changes: {
            before,
            after,
          },
        },
      }),
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
    };
  }

  private getEnvNumber(key: string, fallback: number) {
    const rawValue = this.configService.get<string>(key);
    if (!rawValue) return fallback;
    const parsed = Number(rawValue);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
}

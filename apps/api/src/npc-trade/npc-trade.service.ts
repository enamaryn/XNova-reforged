import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MARKET_REFERENCE_VALUE,
  MARKET_RESOURCES,
  NPC_SEASONS,
  NPC_TRADE_CONFIG_KEY,
  NPC_TRADE_DEFAULTS,
  NPC_TRADE_EXCLUDED_SHIPS,
  NPC_TRADE_LIMITS,
  SHIPS,
  dayStart,
  effectiveSpread,
  exchangeRate,
  exchangeReceive,
  isMarketResource,
  isNpcSellableShip,
  metalValue,
  npcResourceValue,
  parseNpcTradeConfig,
  readNpcTradeConfig,
  seasonOf,
  shipPriceFactor,
  shipUnitPrice,
  type MarketResource,
  type NpcTradeConfig,
} from '@xnova/game-config';
import { Prisma } from '@prisma/client';
import { debitResources, lockPlanet, lockUser } from '../common/atomic';
import { DatabaseService } from '../database/database.service';
import { ServerConfigService } from '../server-config/server-config.service';
import { EventModifiersService } from '../world-events/event-modifiers.service';
import { BuyShipsDto, ExchangeDto } from './dto/npc-trade.dto';

type Tx = Prisma.TransactionClient;
type Cost = Record<MarketResource, number>;

@Injectable()
export class NpcTradeService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
    private readonly eventModifiers: EventModifiersService,
  ) {}

  /** Horloge du service (surchargée par les tests). */
  protected now(): Date {
    return new Date();
  }

  async config(): Promise<NpcTradeConfig> {
    const row = await this.database.gameConfig.findUnique({ where: { key: NPC_TRADE_CONFIG_KEY } });
    return readNpcTradeConfig(row?.value);
  }

  /** Coût unitaire au chantier spatial, coefficient du serveur compris (même arrondi que le chantier). */
  private async baseCost(shipId: number): Promise<Cost> {
    const ship = SHIPS[shipId];
    const { shipCostMultiplier } = await this.serverConfig.getConfig();
    const factor = shipCostMultiplier > 0 ? shipCostMultiplier : 1;
    return {
      metal: Math.floor(ship.cost.metal * factor),
      crystal: Math.floor(ship.cost.crystal * factor),
      deuterium: Math.floor(ship.cost.deuterium * factor),
    };
  }

  private async usedToday(client: Pick<Tx, 'npcTrade'>, userId: string, kind: 'EXCHANGE' | 'SHIP', now: Date) {
    const sum = await client.npcTrade.aggregate({
      where: { userId, kind, createdAt: { gte: dayStart(now) } },
      _sum: { value: true },
    });
    return sum._sum.value ?? 0;
  }

  /** État du jour : taux, prix, plafonds restants. Lisible par tout joueur connecté. */
  async state(userId: string) {
    const config = await this.config();
    const now = this.now();
    const { marketTaxReduction } = await this.eventModifiers.effects();
    const rates: Array<{ give: MarketResource; want: MarketResource; rate: number }> = [];
    for (const give of MARKET_RESOURCES) {
      for (const want of MARKET_RESOURCES) {
        if (give !== want) rates.push({ give, want, rate: exchangeRate(give, want, now, config, marketTaxReduction) });
      }
    }
    const ships = [];
    for (const id of config.ships) {
      if (!SHIPS[id]) continue;
      const price = shipUnitPrice(await this.baseCost(id), now, config);
      ships.push({ id, price, value: metalValue(price) });
    }
    const [exchangeUsed, shipUsed] = await Promise.all([
      this.usedToday(this.database, userId, 'EXCHANGE', now),
      this.usedToday(this.database, userId, 'SHIP', now),
    ]);
    const resetsAt = new Date(dayStart(now).getTime() + 86_400_000);
    return {
      enabled: config.enabled,
      season: seasonOf(now),
      day: dayStart(now).toISOString().slice(0, 10),
      spread: effectiveSpread(config, now, marketTaxReduction),
      values: Object.fromEntries(MARKET_RESOURCES.map((r) => [r, npcResourceValue(r, now, config)])),
      shipPriceFactor: shipPriceFactor(now, config),
      rates,
      ships,
      caps: {
        exchange: { cap: config.exchangeDailyCap, used: exchangeUsed },
        ship: { cap: config.shipDailyCap, used: shipUsed },
      },
      resetsAt,
    };
  }

  private async ownedPlanet(userId: string, planetId: string) {
    const planet = await this.database.planet.findUnique({ where: { id: planetId }, select: { userId: true } });
    if (!planet || planet.userId !== userId) throw new NotFoundException('Planete introuvable');
  }

  private ensureOpen(config: NpcTradeConfig) {
    if (!config.enabled) throw new BadRequestException("Le marchand n'est pas present en ce moment");
  }

  async exchange(userId: string, dto: ExchangeDto) {
    if (!isMarketResource(dto.give) || !isMarketResource(dto.want)) throw new BadRequestException('Ressource inconnue');
    if (dto.give === dto.want) throw new BadRequestException('Choisissez deux ressources differentes');
    const give = dto.give;
    const want = dto.want;
    const config = await this.config();
    this.ensureOpen(config);
    await this.ownedPlanet(userId, dto.planetId);
    const now = this.now();
    const { marketTaxReduction } = await this.eventModifiers.effects();
    const receive = exchangeReceive(give, want, dto.amount, now, config, marketTaxReduction);
    if (receive < 1) throw new BadRequestException("La quantite est trop faible pour etre echangee");
    const value = dto.amount * MARKET_REFERENCE_VALUE[give];

    return this.database.$transaction(async (tx) => {
      // Le verrou du joueur sérialise les échanges simultanés : le plafond quotidien ne peut pas être dépassé en parallèle.
      await lockUser(tx, userId);
      await lockPlanet(tx, dto.planetId);
      const used = await this.usedToday(tx, userId, 'EXCHANGE', now);
      if (used + value > config.exchangeDailyCap) {
        throw new BadRequestException(
          `Plafond quotidien atteint : ${Math.max(0, Math.floor(config.exchangeDailyCap - used))} de valeur restante aujourd'hui`,
        );
      }
      await debitResources(tx, dto.planetId, { metal: 0, crystal: 0, deuterium: 0, [give]: dto.amount });
      await tx.planet.update({ where: { id: dto.planetId }, data: { [want]: { increment: receive } } });
      await tx.npcTrade.create({
        data: {
          userId,
          planetId: dto.planetId,
          kind: 'EXCHANGE',
          giveResource: give,
          wantResource: want,
          giveAmount: dto.amount,
          receiveAmount: receive,
          rate: receive / dto.amount,
          value,
          createdAt: now,
        },
      });
      return { give, want, given: dto.amount, received: receive, rate: receive / dto.amount };
    });
  }

  async buyShips(userId: string, dto: BuyShipsDto) {
    const config = await this.config();
    this.ensureOpen(config);
    if (!isNpcSellableShip(dto.shipId) || !config.ships.includes(dto.shipId)) {
      throw new BadRequestException("Ce vaisseau n'est pas propose par le marchand");
    }
    await this.ownedPlanet(userId, dto.planetId);
    const now = this.now();
    const unit = shipUnitPrice(await this.baseCost(dto.shipId), now, config);
    const total: Cost = {
      metal: unit.metal * dto.amount,
      crystal: unit.crystal * dto.amount,
      deuterium: unit.deuterium * dto.amount,
    };
    const value = metalValue(total);

    return this.database.$transaction(async (tx) => {
      await lockUser(tx, userId);
      await lockPlanet(tx, dto.planetId);
      const used = await this.usedToday(tx, userId, 'SHIP', now);
      if (used + value > config.shipDailyCap) {
        throw new BadRequestException(
          `Plafond quotidien atteint : ${Math.max(0, Math.floor(config.shipDailyCap - used))} de valeur restante aujourd'hui`,
        );
      }
      await debitResources(tx, dto.planetId, total);
      await tx.ship.upsert({
        where: { planetId_shipId: { planetId: dto.planetId, shipId: dto.shipId } },
        update: { amount: { increment: dto.amount } },
        create: { planetId: dto.planetId, shipId: dto.shipId, amount: dto.amount },
      });
      await tx.npcTrade.create({
        data: {
          userId,
          planetId: dto.planetId,
          kind: 'SHIP',
          shipId: dto.shipId,
          shipAmount: dto.amount,
          giveAmount: value,
          value,
          createdAt: now,
        },
      });
      return { shipId: dto.shipId, amount: dto.amount, paid: total, unit };
    });
  }

  // ===== Console d'administration =====

  /** Réglage courant, valeurs par défaut, bornes et vaisseaux que l'on peut proposer. */
  async adminOverview() {
    const config = await this.config();
    return {
      config,
      defaults: NPC_TRADE_DEFAULTS,
      limits: NPC_TRADE_LIMITS,
      seasons: NPC_SEASONS,
      sellableShips: Object.values(SHIPS)
        .filter((ship) => !NPC_TRADE_EXCLUDED_SHIPS.includes(ship.id))
        .map((ship) => ({ id: ship.id, name: ship.name, cost: ship.cost })),
      season: seasonOf(this.now()),
    };
  }

  async updateConfig(actorId: string, input: unknown) {
    const parsed = parseNpcTradeConfig(input);
    if (parsed.ok === false) throw new BadRequestException(parsed.errors.join(' ; '));
    const before = await this.config();
    await this.database.$transaction([
      this.database.gameConfig.upsert({
        where: { key: NPC_TRADE_CONFIG_KEY },
        create: { key: NPC_TRADE_CONFIG_KEY, value: JSON.stringify(parsed.config) },
        update: { value: JSON.stringify(parsed.config) },
      }),
      this.database.adminAuditLog.create({
        data: {
          userId: actorId,
          action: 'update_npc_trade',
          changes: { before, after: parsed.config } as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
    return this.adminOverview();
  }

  /** Remise aux valeurs par défaut (supprime le réglage stocké). */
  async resetConfig(actorId: string) {
    const before = await this.config();
    await this.database.$transaction([
      this.database.gameConfig.deleteMany({ where: { key: NPC_TRADE_CONFIG_KEY } }),
      this.database.adminAuditLog.create({
        data: {
          userId: actorId,
          action: 'reset_npc_trade',
          changes: { before, after: NPC_TRADE_DEFAULTS } as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
    return this.adminOverview();
  }
}

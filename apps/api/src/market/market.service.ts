import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MARKET_MAX_ACTIVE_OFFERS,
  MARKET_OFFER_HOURS,
  MARKET_RATE_FACTOR,
  effectiveTaxRate,
  isMarketResource,
  isRateAllowed,
  normalizeRate,
  paymentFor,
  rateBounds,
  taxOf,
  type MarketResource,
} from '@xnova/game-config';
import { debitResources, lockPlanet, lockUser } from '../common/atomic';
import { DatabaseService } from '../database/database.service';
import { EventModifiersService } from '../world-events/event-modifiers.service';
import { MultiAccountService } from '../multi-account/multi-account.service';
import { BuyOfferDto, CreateOfferDto } from './dto/market.dto';

type Tx = Prisma.TransactionClient;
type Offer = Prisma.MarketOfferGetPayload<object>;

@Injectable()
export class MarketService {
  constructor(
    private readonly database: DatabaseService,
    private readonly eventModifiers: EventModifiersService,
    private readonly multiAccount: MultiAccountService,
  ) {}

  /** Constantes affichées par la page (taxe, durée, limites, bornes de taux par paire). */
  private async rules() {
    const { marketTaxReduction } = await this.eventModifiers.effects();
    return {
      taxRate: effectiveTaxRate(marketTaxReduction),
      offerHours: MARKET_OFFER_HOURS,
      maxActiveOffers: MARKET_MAX_ACTIVE_OFFERS,
      rateFactor: MARKET_RATE_FACTOR,
    };
  }

  private toView(offer: Offer & { seller?: { username: string } }, userId: string) {
    return {
      id: offer.id,
      seller: offer.seller?.username ?? null,
      mine: offer.sellerId === userId,
      give: offer.giveResource,
      want: offer.wantResource,
      amount: offer.amount,
      remaining: offer.remaining,
      minAmount: Math.min(offer.minAmount, offer.remaining),
      rate: offer.rate,
      active: offer.active,
      createdAt: offer.createdAt,
      expiresAt: offer.expiresAt,
    };
  }

  /** Offres en cours, les moins chères d'abord (filtre optionnel par paire). */
  async listOffers(userId: string, give?: string, want?: string, limit = 50) {
    if (give !== undefined && !isMarketResource(give)) throw new BadRequestException('Ressource inconnue');
    if (want !== undefined && !isMarketResource(want)) throw new BadRequestException('Ressource inconnue');
    const offers = await this.database.marketOffer.findMany({
      where: {
        active: true,
        remaining: { gt: 0 },
        expiresAt: { gt: new Date() },
        ...(give ? { giveResource: give } : {}),
        ...(want ? { wantResource: want } : {}),
      },
      orderBy: [{ rate: 'asc' }, { createdAt: 'asc' }],
      take: Math.min(100, Math.max(1, limit)),
      include: { seller: { select: { username: true } } },
    });
    return { rules: await this.rules(), offers: offers.map((offer) => this.toView(offer, userId)) };
  }

  /** Mes offres actives et mes dernières ventes (en tant que vendeur ou acheteur). */
  async mine(userId: string) {
    const [offers, trades] = await Promise.all([
      this.database.marketOffer.findMany({
        where: { sellerId: userId, active: true },
        orderBy: { createdAt: 'desc' },
        include: { seller: { select: { username: true } } },
      }),
      this.database.marketTrade.findMany({
        where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return {
      rules: await this.rules(),
      offers: offers.map((offer) => this.toView(offer, userId)),
      trades: trades.map((trade) => ({
        id: trade.id,
        role: trade.sellerId === userId ? 'seller' : 'buyer',
        give: trade.giveResource,
        want: trade.wantResource,
        amount: trade.amount,
        rate: trade.rate,
        payment: trade.payment,
        tax: trade.tax,
        received: trade.sellerId === userId ? trade.payment - trade.tax : trade.amount,
        createdAt: trade.createdAt,
      })),
    };
  }

  /** Historique des prix d'une paire : dernières ventes, dernier taux et taux moyen pondéré. */
  async history(give: string, want: string) {
    if (!isMarketResource(give) || !isMarketResource(want) || give === want) {
      throw new BadRequestException('Paire de ressources invalide');
    }
    const trades = await this.database.marketTrade.findMany({
      where: { giveResource: give, wantResource: want },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { amount: true, rate: true, createdAt: true },
    });
    const recent = trades.slice(0, 10);
    const volume = recent.reduce((sum, trade) => sum + trade.amount, 0);
    const weighted = volume > 0 ? recent.reduce((sum, trade) => sum + trade.rate * trade.amount, 0) / volume : null;
    return {
      give,
      want,
      bounds: rateBounds(give, want),
      lastRate: trades[0]?.rate ?? null,
      averageRate: weighted === null ? null : normalizeRate(weighted),
      trades,
    };
  }

  /** Met `amount` de la ressource proposée en séquestre et publie l'offre. */
  async createOffer(userId: string, dto: CreateOfferDto) {
    if (!isMarketResource(dto.give) || !isMarketResource(dto.want)) {
      throw new BadRequestException('Ressource inconnue');
    }
    if (dto.give === dto.want) throw new BadRequestException('La ressource demandee doit differer de celle proposee');
    if (!isRateAllowed(dto.give, dto.want, dto.rate)) {
      const { min, max } = rateBounds(dto.give, dto.want);
      throw new BadRequestException(
        `Taux hors limites : entre ${normalizeRate(min)} et ${normalizeRate(max)} ${dto.want} par ${dto.give}`,
      );
    }
    const minAmount = dto.minAmount ?? 1;
    if (minAmount > dto.amount) throw new BadRequestException('La quantite minimale depasse la quantite proposee');
    const planet = await this.database.planet.findUnique({ where: { id: dto.planetId }, select: { userId: true } });
    if (!planet || planet.userId !== userId) throw new NotFoundException('Planete introuvable');

    const offer = await this.database.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const active = await tx.marketOffer.count({ where: { sellerId: userId, active: true } });
      if (active >= MARKET_MAX_ACTIVE_OFFERS) {
        throw new BadRequestException(`Nombre maximal d'offres actives atteint (${MARKET_MAX_ACTIVE_OFFERS})`);
      }
      await lockPlanet(tx, dto.planetId);
      await this.escrow(tx, dto.planetId, dto.give as MarketResource, dto.amount);
      return tx.marketOffer.create({
        data: {
          sellerId: userId,
          planetId: dto.planetId,
          giveResource: dto.give,
          wantResource: dto.want,
          amount: dto.amount,
          remaining: dto.amount,
          minAmount,
          rate: normalizeRate(dto.rate),
          expiresAt: new Date(Date.now() + MARKET_OFFER_HOURS * 3_600_000),
        },
        include: { seller: { select: { username: true } } },
      });
    });
    return this.toView(offer, userId);
  }

  /**
   * Achat (total ou partiel) d'une offre, en une transaction : l'offre est verrouillée puis les deux planètes
   * (dans l'ordre des identifiants). L'acheteur paie, reçoit la ressource du séquestre ; le vendeur reçoit le
   * paiement moins la taxe, qui est détruite. Rien d'autre ne crée ni ne détruit de ressources.
   */
  async buy(userId: string, offerId: string, dto: BuyOfferDto) {
    const buyerPlanet = await this.database.planet.findUnique({ where: { id: dto.planetId }, select: { userId: true } });
    if (!buyerPlanet || buyerPlanet.userId !== userId) throw new NotFoundException('Planete introuvable');

    return this.database.$transaction(async (tx) => {
      await this.lockOffer(tx, offerId);
      const offer = await tx.marketOffer.findUnique({ where: { id: offerId } });
      if (!offer) throw new NotFoundException('Offre introuvable');
      if (!offer.active || offer.expiresAt.getTime() <= Date.now() || offer.remaining <= 0) {
        throw new ConflictException("Cette offre n'est plus disponible");
      }
      if (offer.sellerId === userId) throw new BadRequestException('Vous ne pouvez pas acheter votre propre offre');
      // Doubles comptes : le marché ne sert pas à transférer des ressources entre deux comptes liés
      await this.multiAccount.assertTransferAllowed(userId, offer.sellerId);
      if (dto.amount > offer.remaining) {
        throw new BadRequestException(`Quantite disponible : ${offer.remaining}`);
      }
      const minimum = Math.min(offer.minAmount, offer.remaining);
      if (dto.amount < minimum) throw new BadRequestException(`Achat minimal : ${minimum}`);

      const sellerPlanetId = await this.sellerPlanet(tx, offer);
      for (const id of [...new Set([dto.planetId, sellerPlanetId])].sort()) await lockPlanet(tx, id);

      const give = offer.giveResource as MarketResource;
      const want = offer.wantResource as MarketResource;
      const payment = paymentFor(dto.amount, offer.rate);
      const tax = taxOf(payment, (await this.eventModifiers.effects()).marketTaxReduction);

      try {
        await debitResources(tx, dto.planetId, this.cost(want, payment));
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw new BadRequestException(`Ressources insuffisantes : ${payment} ${want} requis sur cette planete`);
        }
        throw error;
      }
      const remaining = offer.remaining - dto.amount;
      await tx.marketOffer.update({ where: { id: offer.id }, data: { remaining, active: remaining > 0 } });
      await this.credit(tx, dto.planetId, give, dto.amount);
      await this.credit(tx, sellerPlanetId, want, payment - tax);
      const trade = await tx.marketTrade.create({
        data: {
          offerId: offer.id,
          buyerId: userId,
          sellerId: offer.sellerId,
          giveResource: give,
          wantResource: want,
          amount: dto.amount,
          rate: offer.rate,
          payment,
          tax,
        },
      });
      return { tradeId: trade.id, received: dto.amount, give, paid: payment, want, tax, remaining };
    });
  }

  /** Retire une offre et rend le séquestre restant à la planète du vendeur. */
  async cancel(userId: string, offerId: string) {
    await this.database.$transaction(async (tx) => {
      await this.lockOffer(tx, offerId);
      const offer = await tx.marketOffer.findUnique({ where: { id: offerId } });
      if (!offer || offer.sellerId !== userId) throw new NotFoundException('Offre introuvable');
      if (!offer.active) throw new ConflictException("Cette offre n'est plus active");
      await this.closeAndRefund(tx, offer);
    });
    return this.mine(userId);
  }

  /** Tâche planifiée : les offres expirées sont fermées et leur séquestre rendu. Retourne le nombre traité. */
  async expireDue(now = new Date()) {
    const due = await this.database.marketOffer.findMany({
      where: { active: true, expiresAt: { lte: now } },
      select: { id: true },
      take: 200,
    });
    let closed = 0;
    for (const { id } of due) {
      await this.database.$transaction(async (tx) => {
        await this.lockOffer(tx, id);
        const offer = await tx.marketOffer.findUnique({ where: { id } });
        if (!offer || !offer.active) return;
        await this.closeAndRefund(tx, offer);
        closed += 1;
      });
    }
    return closed;
  }

  // ---- aides ----

  private async closeAndRefund(tx: Tx, offer: Offer) {
    const planetId = await this.sellerPlanet(tx, offer);
    await lockPlanet(tx, planetId);
    await tx.marketOffer.update({ where: { id: offer.id }, data: { active: false, remaining: 0 } });
    if (offer.remaining > 0) {
      await this.credit(tx, planetId, offer.giveResource as MarketResource, offer.remaining);
    }
  }

  /** Planète du vendeur qui reçoit paiements et remboursements : l'origine, sinon sa première planète. */
  private async sellerPlanet(tx: Tx, offer: Offer): Promise<string> {
    if (offer.planetId) {
      const origin = await tx.planet.findFirst({ where: { id: offer.planetId, userId: offer.sellerId }, select: { id: true } });
      if (origin) return origin.id;
    }
    const other = await tx.planet.findFirst({
      where: { userId: offer.sellerId },
      orderBy: [{ isMoon: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    if (!other) throw new ConflictException('Le vendeur ne possede plus de planete');
    return other.id;
  }

  private cost(resource: MarketResource, amount: number) {
    return {
      metal: resource === 'metal' ? amount : 0,
      crystal: resource === 'crystal' ? amount : 0,
      deuterium: resource === 'deuterium' ? amount : 0,
    };
  }

  private async escrow(tx: Tx, planetId: string, resource: MarketResource, amount: number) {
    try {
      await debitResources(tx, planetId, this.cost(resource, amount));
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException(`Ressources insuffisantes : ${amount} ${resource} requis sur cette planete`);
      }
      throw error;
    }
  }

  private async credit(tx: Tx, planetId: string, resource: MarketResource, amount: number) {
    if (!(amount > 0)) return;
    await tx.planet.update({ where: { id: planetId }, data: { [resource]: { increment: amount } } });
  }

  private async lockOffer(tx: Tx, offerId: string) {
    await tx.$queryRaw`SELECT "id" FROM "MarketOffer" WHERE "id" = ${offerId} FOR UPDATE`;
  }
}

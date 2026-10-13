import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  WORLD_EVENT_TEMPLATES,
  combineWorldEventEffects,
  getWorldEventTemplate,
  occurrenceKey,
  templateOccurrence,
} from '@xnova/game-config';
import { updateResources } from '@xnova/game-engine';
import { ENERGY_SOURCES_INCLUDE, energySourcesOf } from '../common/energy';
import { DatabaseService } from '../database/database.service';
import { persistResourceRefresh } from '../resources/resource-refresh';
import { ServerConfigService } from '../server-config/server-config.service';
import { EventModifiersService } from './event-modifiers.service';
import { LaunchCustomEventDto, LaunchTemplateEventDto } from './dto/world-events.dto';

type EventRow = Prisma.WorldEventGetPayload<object>;

const DAY_MS = 86_400_000;
const SETTLE_BATCH = 200;

@Injectable()
export class WorldEventsService {
  private readonly logger = new Logger(WorldEventsService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
    private readonly modifiers: EventModifiersService,
  ) {}

  private toView(event: EventRow) {
    return {
      id: event.id,
      kind: event.kind,
      templateId: event.templateId,
      name: event.customName,
      status: event.status,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      endedAt: event.endedAt,
      auto: event.auto,
      effects: { productionBonus: event.productionBonus, marketTaxReduction: event.marketTaxReduction },
    };
  }

  /** Événements en cours, visibles de tous les joueurs (bannière), et leurs effets cumulés. */
  async active() {
    const rows = await this.database.worldEvent.findMany({ where: { status: 'ACTIVE' }, orderBy: { endsAt: 'asc' } });
    return { events: rows.map((row) => this.toView(row)), effects: combineWorldEventEffects(rows) };
  }

  /** Vue de la console : événements en cours, historique récent et calendrier des modèles avec rappels. */
  async adminOverview(now = new Date()) {
    const [active, history, settings, keyed] = await Promise.all([
      this.database.worldEvent.findMany({ where: { status: 'ACTIVE' }, orderBy: { endsAt: 'asc' } }),
      this.database.worldEvent.findMany({
        where: { status: { not: 'ACTIVE' } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.database.worldEventSetting.findMany(),
      this.database.worldEvent.findMany({ where: { occurrenceKey: { not: null } }, select: { occurrenceKey: true } }),
    ]);
    const autoByTemplate = new Map(settings.map((setting) => [setting.templateId, setting.auto]));
    const taken = new Set(keyed.map((row) => row.occurrenceKey));

    const templates = WORLD_EVENT_TEMPLATES.map((template) => {
      const occurrence = templateOccurrence(template, now);
      const launched = taken.has(occurrenceKey(template.id, occurrence));
      return {
        id: template.id,
        kind: template.kind,
        effects: template.effects,
        auto: autoByTemplate.get(template.id) ?? false,
        phase: occurrence.phase,
        year: occurrence.year,
        startsAt: occurrence.startsAt,
        endsAt: occurrence.endsAt,
        launched,
        // Rappel : fenêtre en cours ou proche, et rien de lancé pour cette occurrence
        reminder: !launched && occurrence.phase !== 'later',
      };
    }).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

    return {
      active: active.map((row) => this.toView(row)),
      history: history.map((row) => this.toView(row)),
      templates,
      reminders: templates.filter((template) => template.reminder).length,
    };
  }

  private async audit(actorId: string | null, action: string, changes: Prisma.InputJsonValue) {
    if (!actorId) return;
    await this.database.adminAuditLog.create({ data: { userId: actorId, action, changes } });
  }

  /**
   * Règle la production de TOUTES les planètes jusqu'à maintenant avec les bonus encore en vigueur. À appeler avant
   * tout changement de statut : le temps déjà écoulé n'est jamais recalculé avec d'autres bonus (même principe que
   * le règlement avant un changement d'énergie).
   */
  async settleAllPlanets(now = new Date()): Promise<number> {
    this.modifiers.invalidate();
    const config = await this.serverConfig.getResourceConfig();
    let settled = 0;
    let cursor: string | undefined;
    for (;;) {
      const batch = await this.database.planet.findMany({
        take: SETTLE_BATCH,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: ENERGY_SOURCES_INCLUDE,
      });
      if (batch.length === 0) break;
      for (const planet of batch) {
        const calculation = updateResources({
          resources: planet,
          levels: { ...planet, ...energySourcesOf(planet) },
          lastUpdate: planet.lastUpdate,
          now,
          config,
        });
        if (await persistResourceRefresh(this.database, planet, calculation)) settled += 1;
      }
      cursor = batch[batch.length - 1].id;
    }
    return settled;
  }

  /** Règle les compteurs, applique le changement de statut, puis vide le cache des effets. */
  private async withSettlement<T>(change: () => Promise<T>): Promise<T> {
    await this.settleAllPlanets();
    try {
      return await change();
    } finally {
      this.modifiers.invalidate();
    }
  }

  private async create(data: Prisma.WorldEventUncheckedCreateInput): Promise<EventRow> {
    // Doublon évident : inutile de régler toute la production pour le constater (la contrainte reste l'arbitre)
    if (data.occurrenceKey) {
      const taken = await this.database.worldEvent.findUnique({ where: { occurrenceKey: data.occurrenceKey }, select: { id: true } });
      if (taken) throw new ConflictException('Cet événement a déjà été lancé pour cette période');
    }
    try {
      return await this.withSettlement(() => this.database.worldEvent.create({ data }));
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Cet événement a déjà été lancé pour cette période');
      }
      throw error;
    }
  }

  async launchTemplate(actorId: string | null, dto: LaunchTemplateEventDto, options: { auto?: boolean; now?: Date } = {}) {
    const template = getWorldEventTemplate(dto.templateId);
    if (!template) throw new NotFoundException('Modèle d\'événement inconnu');
    const now = options.now ?? new Date();
    const occurrence = templateOccurrence(template, now);
    const windowDays = Math.round((occurrence.endsAt.getTime() - occurrence.startsAt.getTime()) / DAY_MS);
    // Dans la fenêtre : jusqu'à sa fin. Avant : la durée de la fenêtre, à partir de maintenant.
    const endsAt =
      dto.days !== undefined
        ? new Date(now.getTime() + dto.days * DAY_MS)
        : occurrence.phase === 'active'
          ? occurrence.endsAt
          : new Date(now.getTime() + windowDays * DAY_MS);
    const event = await this.create({
      kind: template.kind,
      templateId: template.id,
      occurrenceKey: occurrenceKey(template.id, occurrence),
      status: 'ACTIVE',
      startsAt: now,
      endsAt,
      productionBonus: template.effects.productionBonus,
      marketTaxReduction: template.effects.marketTaxReduction,
      auto: options.auto ?? false,
      launchedById: actorId,
    });
    await this.audit(actorId, 'world_event_launch', { eventId: event.id, templateId: template.id, endsAt });
    return this.toView(event);
  }

  async launchCustom(actorId: string, dto: LaunchCustomEventDto) {
    const effects = combineWorldEventEffects([dto]);
    if (effects.productionBonus === 0 && effects.marketTaxReduction === 0) {
      throw new BadRequestException('Un événement doit avoir au moins un effet');
    }
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Le nom est obligatoire');
    const now = new Date();
    const event = await this.create({
      kind: 'SEASONAL',
      customName: name,
      status: 'ACTIVE',
      startsAt: now,
      endsAt: new Date(now.getTime() + dto.days * DAY_MS),
      productionBonus: effects.productionBonus,
      marketTaxReduction: effects.marketTaxReduction,
      launchedById: actorId,
    });
    await this.audit(actorId, 'world_event_launch', { eventId: event.id, custom: name, days: dto.days, ...effects });
    return this.toView(event);
  }

  /** Termine un événement tout de suite (annulation) : la production est réglée avant le retrait du bonus. */
  async end(actorId: string | null, id: string, status: 'ENDED' | 'CANCELLED' = 'CANCELLED') {
    const event = await this.database.worldEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Événement introuvable');
    if (event.status !== 'ACTIVE') throw new ConflictException('Cet événement est déjà terminé');
    const updated = await this.withSettlement(async () => {
      const result = await this.database.worldEvent.updateMany({
        where: { id, status: 'ACTIVE' },
        data: { status, endedAt: new Date() },
      });
      return result.count === 1;
    });
    if (!updated) throw new ConflictException('Cet événement est déjà terminé');
    await this.audit(actorId, status === 'CANCELLED' ? 'world_event_cancel' : 'world_event_end', { eventId: id });
    return this.toView((await this.database.worldEvent.findUnique({ where: { id } })) as EventRow);
  }

  /** Case « automatique » d'un modèle (décochée par défaut). */
  async setAuto(actorId: string, templateId: string, auto: boolean) {
    const template = getWorldEventTemplate(templateId);
    if (!template) throw new NotFoundException('Modèle d\'événement inconnu');
    await this.database.worldEventSetting.upsert({
      where: { templateId },
      create: { templateId, auto, updatedById: actorId },
      update: { auto, updatedById: actorId },
    });
    await this.audit(actorId, 'world_event_auto', { templateId, auto });
    return { templateId, auto };
  }

  /**
   * Tâche périodique : termine les événements échus (après règlement de la production), puis lance les occurrences
   * des modèles dont la case « automatique » est cochée et dont la fenêtre est en cours.
   */
  async tick(now = new Date()): Promise<{ ended: number; launched: number }> {
    let ended = 0;
    const due = await this.database.worldEvent.findMany({
      where: { status: 'ACTIVE', endsAt: { lte: now } },
      select: { id: true },
    });
    for (const { id } of due) {
      try {
        await this.end(null, id, 'ENDED');
        ended += 1;
      } catch (error) {
        if (!(error instanceof ConflictException)) this.logger.error(`Fin de l'événement ${id} : ${(error as Error).message}`);
      }
    }

    let launched = 0;
    const autos = await this.database.worldEventSetting.findMany({ where: { auto: true } });
    for (const setting of autos) {
      const template = getWorldEventTemplate(setting.templateId);
      if (!template) continue;
      const occurrence = templateOccurrence(template, now);
      if (occurrence.phase !== 'active') continue;
      const taken = await this.database.worldEvent.findUnique({
        where: { occurrenceKey: occurrenceKey(template.id, occurrence) },
        select: { id: true },
      });
      if (taken) continue;
      try {
        await this.launchTemplate(null, { templateId: template.id }, { auto: true, now });
        launched += 1;
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
      }
    }
    return { ended, launched };
  }
}


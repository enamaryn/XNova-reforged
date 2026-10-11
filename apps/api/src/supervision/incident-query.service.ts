import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { INCIDENT_LEVELS, INCIDENT_SOURCES, INCIDENT_STATUSES, type IncidentStatus } from './incident-sink';

export const PERIODS = { '1h': 3_600_000, '24h': 86_400_000, '7d': 604_800_000, '30d': 2_592_000_000 } as const;
export type Period = keyof typeof PERIODS | 'all';

export interface IncidentFilters {
  period?: Period;
  level?: string;
  source?: string;
  status?: string;
  q?: string;
  sort?: 'lastSeen' | 'occurrences';
  page?: number;
  pageSize?: number;
}

/** Champs de la liste : jamais la trace ni le contexte (réservés au détail). */
const LIST_SELECT = {
  id: true,
  level: true,
  source: true,
  message: true,
  errorType: true,
  operation: true,
  httpStatus: true,
  firstSeen: true,
  lastSeen: true,
  occurrences: true,
  status: true,
} satisfies Prisma.IncidentSelect;

export const EXPORT_LIMIT = 5000;

@Injectable()
export class IncidentQueryService {
  constructor(private readonly database: DatabaseService) {}

  private where(filters: IncidentFilters): Prisma.IncidentWhereInput {
    const where: Prisma.IncidentWhereInput = {};
    if (filters.period && filters.period !== 'all') {
      const ms = PERIODS[filters.period];
      if (!ms) throw new BadRequestException('Période invalide');
      where.lastSeen = { gte: new Date(Date.now() - ms) };
    }
    if (filters.level) {
      if (!(INCIDENT_LEVELS as readonly string[]).includes(filters.level)) throw new BadRequestException('Niveau invalide');
      where.level = filters.level;
    }
    if (filters.source) {
      if (!(INCIDENT_SOURCES as readonly string[]).includes(filters.source)) throw new BadRequestException('Origine invalide');
      where.source = filters.source;
    }
    if (filters.status) {
      if (filters.status === 'open') where.status = { in: ['new', 'seen'] };
      else if ((INCIDENT_STATUSES as readonly string[]).includes(filters.status)) where.status = filters.status;
      else throw new BadRequestException('Statut invalide');
    }
    const q = filters.q?.trim().slice(0, 100);
    if (q) {
      where.OR = [
        { message: { contains: q, mode: 'insensitive' } },
        { operation: { contains: q, mode: 'insensitive' } },
        { errorType: { contains: q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  async list(filters: IncidentFilters) {
    const pageSize = Math.min(50, Math.max(1, Math.floor(filters.pageSize ?? 20)));
    const page = Math.max(1, Math.floor(filters.page ?? 1));
    const where = this.where(filters);
    const orderBy: Prisma.IncidentOrderByWithRelationInput[] =
      filters.sort === 'occurrences' ? [{ occurrences: 'desc' }, { lastSeen: 'desc' }] : [{ lastSeen: 'desc' }];
    const [total, items] = await Promise.all([
      this.database.incident.count({ where }),
      this.database.incident.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, select: LIST_SELECT }),
    ]);
    return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async get(id: string) {
    const incident = await this.database.incident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incident introuvable');
    return incident;
  }

  /** Change le statut ; `new` rouvre l'incident, `resolved` consigne la date et l'administrateur. */
  async setStatus(id: string, status: IncidentStatus, actorId: string) {
    if (!(INCIDENT_STATUSES as readonly string[]).includes(status)) throw new BadRequestException('Statut invalide');
    const existing = await this.database.incident.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Incident introuvable');
    const resolved = status === 'resolved';
    return this.database.incident.update({
      where: { id },
      data: {
        status,
        resolvedAt: resolved ? new Date() : null,
        resolvedById: resolved ? actorId : null,
      },
    });
  }

  /** Synthèse : incidents ouverts, dernières 24 h, erreurs les plus fréquentes, répartition. */
  async stats() {
    const since = new Date(Date.now() - PERIODS['24h']);
    const [open, last24h, occurrences24h, byLevel, bySource, top, total] = await Promise.all([
      this.database.incident.count({ where: { status: { in: ['new', 'seen'] } } }),
      this.database.incident.count({ where: { lastSeen: { gte: since } } }),
      this.database.incident.aggregate({ _sum: { occurrences: true }, where: { lastSeen: { gte: since } } }),
      this.database.incident.groupBy({ by: ['level'], _count: { _all: true }, where: { status: { in: ['new', 'seen'] } } }),
      this.database.incident.groupBy({ by: ['source'], _count: { _all: true }, where: { status: { in: ['new', 'seen'] } } }),
      this.database.incident.findMany({
        where: { status: { in: ['new', 'seen'] } },
        orderBy: [{ occurrences: 'desc' }, { lastSeen: 'desc' }],
        take: 5,
        select: LIST_SELECT,
      }),
      this.database.incident.count(),
    ]);
    return {
      open,
      total,
      last24h,
      occurrences24h: occurrences24h._sum.occurrences ?? 0,
      byLevel: Object.fromEntries(byLevel.map((row) => [row.level, row._count._all])),
      bySource: Object.fromEntries(bySource.map((row) => [row.source, row._count._all])),
      top,
    };
  }

  /** Purge manuelle : incidents plus anciens que `olderThanDays` (tous statuts, ou seulement clos). */
  async purge(olderThanDays: number, onlyClosed: boolean): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
    const result = await this.database.incident.deleteMany({
      where: { lastSeen: { lt: cutoff }, ...(onlyClosed ? { status: { in: ['resolved', 'ignored'] } } : {}) },
    });
    return result.count;
  }

  async purgeByRetention(days: number): Promise<number> {
    return this.purge(days, false);
  }

  /** Export filtré, borné à EXPORT_LIMIT lignes ; champs déjà filtrés à l'enregistrement. */
  async export(filters: IncidentFilters) {
    return this.database.incident.findMany({
      where: this.where(filters),
      orderBy: { lastSeen: 'desc' },
      take: EXPORT_LIMIT,
      select: { ...LIST_SELECT, userId: true, planetId: true, version: true, commit: true, resolvedAt: true },
    });
  }
}

/** Cellule CSV : guillemets doublés, et neutralisation des formules (=, +, -, @) pour les tableurs. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  const columns = ['id', 'level', 'source', 'status', 'occurrences', 'firstSeen', 'lastSeen', 'httpStatus', 'errorType', 'operation', 'message', 'userId', 'planetId', 'version', 'commit', 'resolvedAt'];
  return `${columns.join(',')}\n${rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')).join('\n')}${rows.length ? '\n' : ''}`;
}

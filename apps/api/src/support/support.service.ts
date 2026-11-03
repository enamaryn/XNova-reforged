import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SUPPORT_LIMITS, type SupportStatus } from '@xnova/game-config';
import { DatabaseService } from '../database/database.service';
import { lockUser } from '../common/atomic';
import type { CreateSupportReportDto } from './dto/support.dto';

const PAGE_SIZE = 25;

/** Retours à la ligne et tabulation conservés ; les autres caractères de contrôle sont retirés (journaux, affichage). */
const isAllowed = (char: string) => {
  const code = char.charCodeAt(0);
  return code >= 32 ? code !== 127 : code === 9 || code === 10 || code === 13;
};
const clean = (value: string | undefined, max: number) =>
  value === undefined ? null : Array.from(value).filter(isAllowed).join('').trim().slice(0, max) || null;

@Injectable()
export class SupportService {
  constructor(private readonly database: DatabaseService) {}

  /** Enregistre un signalement ; au plus `maxOpenPerUser` en attente par joueur (verrou : pas de dépassement en parallèle). */
  async create(userId: string, dto: CreateSupportReportDto, userAgent: string | undefined) {
    return this.database.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const open = await tx.supportReport.count({ where: { userId, status: { in: ['new', 'seen'] } } });
      if (open >= SUPPORT_LIMITS.maxOpenPerUser) {
        throw new ConflictException(
          `Vous avez déjà ${SUPPORT_LIMITS.maxOpenPerUser} signalements en attente : patientez le temps qu'ils soient traités`,
        );
      }
      const report = await tx.supportReport.create({
        data: {
          userId,
          kind: dto.kind,
          subject: clean(dto.subject, SUPPORT_LIMITS.subjectMax) ?? '',
          body: clean(dto.body, SUPPORT_LIMITS.bodyMax) ?? '',
          pagePath: clean(dto.pagePath, 200),
          appVersion: clean(dto.appVersion, 60),
          userAgent: clean(userAgent, 300),
        },
        select: { id: true, createdAt: true },
      });
      return report;
    });
  }

  /** Signalements récents du joueur, avec leur statut (il voit qu'ils sont traités). */
  mine(userId: string) {
    return this.database.supportReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: SUPPORT_LIMITS.mineLimit,
      select: { id: true, kind: true, subject: true, status: true, createdAt: true },
    });
  }

  /** Console admin : liste paginée, filtre par statut, plus ancien non traité d'abord pour « new ». */
  async adminList(status: SupportStatus | undefined, page: number) {
    const where = status ? { status } : {};
    const [total, items, newCount] = await Promise.all([
      this.database.supportReport.count({ where }),
      this.database.supportReport.findMany({
        where,
        orderBy: { createdAt: status === 'new' ? 'asc' : 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { user: { select: { id: true, username: true, email: true } } },
      }),
      this.database.supportReport.count({ where: { status: 'new' } }),
    ]);
    return {
      page,
      pageSize: PAGE_SIZE,
      total,
      newCount,
      items: items.map((r) => ({
        id: r.id,
        kind: r.kind,
        subject: r.subject,
        body: r.body,
        pagePath: r.pagePath,
        appVersion: r.appVersion,
        userAgent: r.userAgent,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        user: r.user,
      })),
    };
  }

  /** Change le statut d'un signalement et journalise l'action de l'administrateur. */
  async setStatus(actorId: string, id: string, status: SupportStatus) {
    const existing = await this.database.supportReport.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw new NotFoundException('Signalement introuvable');
    const done = status === 'resolved' || status === 'ignored';
    await this.database.$transaction([
      this.database.supportReport.update({
        where: { id },
        data: { status, resolvedAt: done ? new Date() : null, resolvedById: done ? actorId : null },
      }),
      this.database.adminAuditLog.create({
        data: { userId: actorId, action: 'support.setStatus', changes: { id, before: existing.status, after: status } },
      }),
    ]);
    return { id, status };
  }
}

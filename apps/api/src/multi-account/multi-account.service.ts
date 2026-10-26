import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MULTI_ACCOUNT_CONFIG_KEY,
  MULTI_ACCOUNT_DEFAULTS,
  MULTI_ACCOUNT_LIMITS,
  normalizeIp,
  pairKey,
  parseMultiAccountConfig,
  readMultiAccountConfig,
  type MultiAccountConfig,
} from '@xnova/game-config';
import { DatabaseService } from '../database/database.service';

type Reason = { type: 'ip'; value: string } | { type: 'email'; value: string };

const DAY_MS = 86_400_000;
/** Une adresse déjà connue n'est réécrite qu'une fois par heure (rafraîchissements fréquents). */
const TOUCH_INTERVAL_MS = 3_600_000;

@Injectable()
export class MultiAccountService {
  private readonly logger = new Logger(MultiAccountService.name);

  constructor(private readonly database: DatabaseService) {}

  /** Horloge du service (surchargée par les tests). */
  protected now(): Date {
    return new Date();
  }

  async config(): Promise<MultiAccountConfig> {
    const row = await this.database.gameConfig.findUnique({ where: { key: MULTI_ACCOUNT_CONFIG_KEY } });
    const config = readMultiAccountConfig(row?.value);
    // Interrupteur réservé aux environnements de test (tous les comptes y partagent la même adresse IP)
    if (process.env.MULTI_ACCOUNT_CHECKS === 'off') {
      return { ...config, enforceRegistration: false, blockLinkedTransfers: false };
    }
    return config;
  }

  // ===== Enregistrement des adresses IP =====

  /** Mémorise l'adresse vue pour ce compte ; ne lève jamais (la connexion ne dépend pas de ce suivi). */
  async touchIp(userId: string, rawIp: string | null | undefined): Promise<void> {
    try {
      const ip = normalizeIp(rawIp);
      if (!ip) return;
      const now = this.now();
      const known = await this.database.accountIp.findUnique({ where: { userId_ip: { userId, ip } } });
      if (!known) {
        await this.database.accountIp
          .create({ data: { userId, ip, firstSeenAt: now, lastSeenAt: now } })
          .catch(async (error) => {
            // Deux requêtes simultanées : la seconde met simplement à jour la ligne de la première
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
              await this.database.accountIp.update({
                where: { userId_ip: { userId, ip } },
                data: { lastSeenAt: now, hits: { increment: 1 } },
              });
              return;
            }
            throw error;
          });
      } else if (now.getTime() - known.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) {
        await this.database.accountIp.update({
          where: { userId_ip: { userId, ip } },
          data: { lastSeenAt: now, hits: { increment: 1 } },
        });
      }
    } catch (error) {
      this.logger.warn(`Adresse IP non enregistrée : ${(error as Error).message}`);
    }
  }

  // ===== Contrôles =====

  /**
   * Inscription : refuse quand l'adresse IP a déjà trop de comptes distincts sur la fenêtre (hors exemptions).
   * L'email canonique est contrôlé par le service d'inscription, dans sa transaction.
   */
  async assertCanRegister(rawIp: string | null | undefined): Promise<void> {
    const config = await this.config();
    if (!config.enforceRegistration || config.maxAccountsPerIp <= 0) return;
    const ip = normalizeIp(rawIp);
    if (!ip) return;
    const since = new Date(this.now().getTime() - config.ipWindowDays * DAY_MS);
    const rows = await this.database.accountIp.findMany({
      where: { ip, lastSeenAt: { gte: since } },
      select: { userId: true },
    });
    const users = [...new Set(rows.map((row) => row.userId))];
    // Un compte déclaré légitime avec un autre compte du même foyer ne compte pas comme un compte en plus
    const counted = await this.countWithoutExemptions(users);
    if (counted >= config.maxAccountsPerIp) {
      throw new ForbiddenException(
        'Trop de comptes ont deja ete crees depuis cette adresse. Contactez un administrateur si vous partagez une connexion (foyer, ecole).',
      );
    }
  }

  /** Nombre de comptes à compter : chaque groupe de comptes mutuellement exemptés ne compte que pour un. */
  private async countWithoutExemptions(userIds: string[]): Promise<number> {
    if (userIds.length <= 1) return userIds.length;
    const exemptions = await this.database.accountLinkExemption.findMany({
      where: { userA: { in: userIds }, userB: { in: userIds } },
    });
    const parent = new Map(userIds.map((id) => [id, id]));
    const find = (id: string): string => {
      let root = id;
      while (parent.get(root) !== root) root = parent.get(root)!;
      parent.set(id, root);
      return root;
    };
    for (const e of exemptions) parent.set(find(e.userA), find(e.userB));
    return new Set(userIds.map(find)).size;
  }

  async isExempt(a: string, b: string): Promise<boolean> {
    const [userA, userB] = pairKey(a, b);
    return (await this.database.accountLinkExemption.findUnique({ where: { userA_userB: { userA, userB } } })) !== null;
  }

  /** Raisons qui lient deux comptes (IP vue sur la fenêtre, email canonique) ; vide si aucun lien. */
  async linkReasons(a: string, b: string): Promise<Reason[]> {
    if (a === b) return [];
    const config = await this.config();
    const since = new Date(this.now().getTime() - config.ipWindowDays * DAY_MS);
    const reasons: Reason[] = [];
    const [ipsA, ipsB, users] = await Promise.all([
      this.database.accountIp.findMany({ where: { userId: a, lastSeenAt: { gte: since } }, select: { ip: true } }),
      this.database.accountIp.findMany({ where: { userId: b, lastSeenAt: { gte: since } }, select: { ip: true } }),
      this.database.user.findMany({ where: { id: { in: [a, b] } }, select: { emailCanonical: true } }),
    ]);
    const shared = new Set(ipsB.map((row) => row.ip));
    for (const row of ipsA) if (shared.has(row.ip)) reasons.push({ type: 'ip', value: row.ip });
    if (users.length === 2 && users[0].emailCanonical && users[0].emailCanonical === users[1].emailCanonical) {
      reasons.push({ type: 'email', value: users[0].emailCanonical });
    }
    return reasons;
  }

  async areLinked(a: string, b: string): Promise<boolean> {
    if ((await this.linkReasons(a, b)).length === 0) return false;
    return !(await this.isExempt(a, b));
  }

  /** Refuse un transfert de ressources ou une attaque entre deux comptes liés (marché, transport, attaque) quand le réglage est actif. */
  async assertTransferAllowed(a: string, b: string): Promise<void> {
    if (a === b) return;
    const config = await this.config();
    if (!config.blockLinkedTransfers) return;
    if (await this.areLinked(a, b)) {
      throw new ForbiddenException(
        'Action refusee : ces deux comptes semblent appartenir a la meme personne (meme adresse IP ou meme email). Contactez un administrateur si c\'est une erreur.',
      );
    }
  }

  // ===== Console d'administration =====

  async adminOverview() {
    const config = await this.config();
    const since = new Date(this.now().getTime() - config.ipWindowDays * DAY_MS);

    // Adresses partagées par au moins deux comptes sur la fenêtre
    const sharedIps = await this.database.accountIp.groupBy({
      by: ['ip'],
      where: { lastSeenAt: { gte: since } },
      having: { userId: { _count: { gt: 1 } } },
    });
    const ipRows = sharedIps.length
      ? await this.database.accountIp.findMany({
          where: { ip: { in: sharedIps.map((row) => row.ip) }, lastSeenAt: { gte: since } },
          select: { userId: true, ip: true },
        })
      : [];
    const sharedEmails = await this.database.user.groupBy({
      by: ['emailCanonical'],
      where: { emailCanonical: { not: null } },
      having: { id: { _count: { gt: 1 } } },
    });
    const emailRows = sharedEmails.length
      ? await this.database.user.findMany({
          where: { emailCanonical: { in: sharedEmails.map((row) => row.emailCanonical as string) } },
          select: { id: true, emailCanonical: true },
        })
      : [];

    // Raisons par paire de comptes
    const pairs = new Map<string, { a: string; b: string; reasons: Reason[] }>();
    const addReason = (x: string, y: string, reason: Reason) => {
      const [a, b] = pairKey(x, y);
      const key = `${a}|${b}`;
      const entry = pairs.get(key) ?? { a, b, reasons: [] };
      if (!entry.reasons.some((r) => r.type === reason.type && r.value === reason.value)) entry.reasons.push(reason);
      pairs.set(key, entry);
    };
    const byIp = new Map<string, string[]>();
    for (const row of ipRows) byIp.set(row.ip, [...(byIp.get(row.ip) ?? []), row.userId]);
    for (const [ip, ids] of byIp) {
      for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) addReason(ids[i], ids[j], { type: 'ip', value: ip });
    }
    const byEmail = new Map<string, string[]>();
    for (const row of emailRows) byEmail.set(row.emailCanonical as string, [...(byEmail.get(row.emailCanonical as string) ?? []), row.id]);
    for (const [email, ids] of byEmail) {
      for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) addReason(ids[i], ids[j], { type: 'email', value: email });
    }

    const userIds = [...new Set([...pairs.values()].flatMap((p) => [p.a, p.b]))];
    const [users, exemptions] = await Promise.all([
      this.database.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, email: true, role: true, createdAt: true, lastActive: true, bannedUntil: true },
      }),
      userIds.length
        ? this.database.accountLinkExemption.findMany({ where: { userA: { in: userIds }, userB: { in: userIds } } })
        : Promise.resolve([]),
    ]);
    const exemptionOf = new Map(exemptions.map((e) => [`${e.userA}|${e.userB}`, e]));

    // Groupes = composantes connexes des paires
    const parent = new Map(userIds.map((id) => [id, id]));
    const find = (id: string): string => {
      let root = id;
      while (parent.get(root) !== root) root = parent.get(root)!;
      parent.set(id, root);
      return root;
    };
    for (const p of pairs.values()) parent.set(find(p.a), find(p.b));
    const groups = new Map<string, { users: typeof users; pairs: Array<Record<string, unknown>> }>();
    const userById = new Map(users.map((u) => [u.id, u]));
    for (const id of userIds) {
      const root = find(id);
      const group = groups.get(root) ?? { users: [], pairs: [] };
      group.users.push(userById.get(id)!);
      groups.set(root, group);
    }
    for (const p of pairs.values()) {
      const exemption = exemptionOf.get(`${p.a}|${p.b}`);
      groups.get(find(p.a))!.pairs.push({
        a: p.a,
        b: p.b,
        reasons: p.reasons,
        exempt: Boolean(exemption),
        exemptionReason: exemption?.reason ?? null,
      });
    }
    const list = [...groups.values()]
      .map((group) => ({ ...group, open: group.pairs.some((pair) => !pair.exempt) }))
      .sort((x, y) => Number(y.open) - Number(x.open) || y.users.length - x.users.length)
      .slice(0, 200);

    return {
      config,
      defaults: MULTI_ACCOUNT_DEFAULTS,
      limits: MULTI_ACCOUNT_LIMITS,
      groups: list,
      openGroups: list.filter((group) => group.open).length,
    };
  }

  async addExemption(actorId: string, a: string, b: string, reason: string) {
    if (a === b) throw new BadRequestException('Choisissez deux comptes differents');
    const found = await this.database.user.count({ where: { id: { in: [a, b] } } });
    if (found !== 2) throw new BadRequestException('Compte introuvable');
    const [userA, userB] = pairKey(a, b);
    await this.database.$transaction([
      this.database.accountLinkExemption.upsert({
        where: { userA_userB: { userA, userB } },
        create: { userA, userB, reason, createdById: actorId },
        update: { reason, createdById: actorId },
      }),
      this.database.adminAuditLog.create({ data: { userId: actorId, action: 'add_account_exemption', changes: { userA, userB, reason } } }),
    ]);
    return this.adminOverview();
  }

  async removeExemption(actorId: string, a: string, b: string) {
    const [userA, userB] = pairKey(a, b);
    await this.database.$transaction([
      this.database.accountLinkExemption.deleteMany({ where: { userA, userB } }),
      this.database.adminAuditLog.create({ data: { userId: actorId, action: 'remove_account_exemption', changes: { userA, userB } } }),
    ]);
    return this.adminOverview();
  }

  async updateConfig(actorId: string, input: unknown) {
    const parsed = parseMultiAccountConfig(input);
    if (parsed.ok === false) throw new BadRequestException(parsed.errors.join(' ; '));
    const before = await this.config();
    await this.database.$transaction([
      this.database.gameConfig.upsert({
        where: { key: MULTI_ACCOUNT_CONFIG_KEY },
        create: { key: MULTI_ACCOUNT_CONFIG_KEY, value: JSON.stringify(parsed.config) },
        update: { value: JSON.stringify(parsed.config) },
      }),
      this.database.adminAuditLog.create({
        data: { userId: actorId, action: 'update_multi_account', changes: { before, after: parsed.config } as unknown as Prisma.InputJsonValue },
      }),
    ]);
    return this.adminOverview();
  }

  async resetConfig(actorId: string) {
    const before = await this.config();
    await this.database.$transaction([
      this.database.gameConfig.deleteMany({ where: { key: MULTI_ACCOUNT_CONFIG_KEY } }),
      this.database.adminAuditLog.create({
        data: { userId: actorId, action: 'reset_multi_account', changes: { before, after: MULTI_ACCOUNT_DEFAULTS } as unknown as Prisma.InputJsonValue },
      }),
    ]);
    return this.adminOverview();
  }

  /** Purge quotidienne des adresses IP plus anciennes que la durée de conservation. */
  async purgeOldIps(): Promise<number> {
    const config = await this.config();
    const before = new Date(this.now().getTime() - config.retentionDays * DAY_MS);
    const result = await this.database.accountIp.deleteMany({ where: { lastSeenAt: { lt: before } } });
    return result.count;
  }
}

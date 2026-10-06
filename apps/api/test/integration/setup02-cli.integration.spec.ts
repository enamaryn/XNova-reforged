import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { run as runCreateAdmin } from '../../src/cli/create-admin';
import { run as runResetPassword } from '../../src/cli/reset-password';
import { run as runSetupReset } from '../../src/cli/setup-reset';
import { run as runSetupToken } from '../../src/cli/setup-token';
import { CliDeps, CliError, parseArgs } from '../../src/cli/common';
import {
  SetupDb,
  isSetupCompleted,
  markSetupCompleted,
  verifySetupToken,
} from '../../src/setup/setup-core';
import { useIsolatedSchema } from './helpers';

/**
 * SETUP-01 — commandes terminal : code d'installation, réarmement, super admin de secours, mot de passe perdu.
 * Schéma PostgreSQL dédié (l'état d'installation est global à la base).
 */
describe('Commandes terminal (SETUP-01)', () => {
  let isolated: Awaited<ReturnType<typeof useIsolatedSchema>>;
  let db: PrismaClient;
  let setupDb: SetupDb;

  const makeIo = (answers: string[] = []) => {
    const out: string[] = [];
    const err: string[] = [];
    const asked: Array<{ question: string; hidden?: boolean }> = [];
    return {
      out,
      err,
      asked,
      io: {
        out: (m: string) => out.push(m),
        err: (m: string) => err.push(m),
        ask: async (question: string, options?: { hidden?: boolean }) => {
          asked.push({ question, hidden: options?.hidden });
          return answers.shift() ?? '';
        },
      },
    };
  };
  const deps = (io: CliDeps['io'], env: NodeJS.ProcessEnv = {}): CliDeps => ({ db, io, env });
  const bannerToken = (lines: string[]) => lines.join('\n').match(/Code d'installation : ([A-Z0-9-]+)/)![1];

  beforeAll(async () => {
    isolated = await useIsolatedSchema('setup_cli');
    db = new PrismaClient({ datasources: { db: { url: isolated.url } } });
    setupDb = db as unknown as SetupDb;
  }, 120_000);

  afterAll(async () => {
    await db?.$disconnect();
    await isolated?.drop();
  });

  describe('arguments', () => {
    it('--cle valeur, --cle=valeur et drapeaux', () => {
      expect(parseArgs(['--username', 'a', '--email=b@c.d', '--yes'])).toEqual({
        username: 'a',
        email: 'b@c.d',
        yes: true,
      });
    });
  });

  describe('setup:token', () => {
    it('affiche un code valable pour le parcours ; le précédent devient invalide', async () => {
      const first = makeIo();
      expect(await runSetupToken(deps(first.io))).toBe(0);
      const code1 = bannerToken(first.out);
      expect(await verifySetupToken(setupDb, code1)).toBe(true);

      const second = makeIo();
      await runSetupToken(deps(second.io));
      const code2 = bannerToken(second.out);
      expect(code2).not.toBe(code1);
      expect(await verifySetupToken(setupDb, code1)).toBe(false);
      expect(await verifySetupToken(setupDb, code2)).toBe(true);
    });

    it('refusé quand l\'installation est terminée, avec l\'indication du réarmement', async () => {
      await markSetupCompleted(setupDb);
      const { io, err } = makeIo();
      expect(await runSetupToken(deps(io))).toBe(1);
      expect(err.join('\n')).toMatch(/verrouillé/);
      expect(err.join('\n')).toContain('npm run setup:reset');
      expect(await isSetupCompleted(setupDb)).toBe(true);
    });
  });

  describe('setup:reset', () => {
    it('sans confirmation : rien ne change', async () => {
      const { io, err } = makeIo(['non']);
      expect(await runSetupReset(deps(io), [])).toBe(1);
      expect(err.join('\n')).toMatch(/Annulé/);
      expect(await isSetupCompleted(setupDb)).toBe(true);
    });

    it('avec la confirmation RESET : parcours rouvert et nouveau code affiché', async () => {
      const { io, out } = makeIo(['RESET']);
      expect(await runSetupReset(deps(io), [])).toBe(0);
      expect(await isSetupCompleted(setupDb)).toBe(false);
      expect(await verifySetupToken(setupDb, bannerToken(out))).toBe(true);
    });

    it('--yes : sans question', async () => {
      await markSetupCompleted(setupDb);
      const { io, out, asked } = makeIo();
      expect(await runSetupReset(deps(io), ['--yes'])).toBe(0);
      expect(asked).toHaveLength(0);
      expect(await verifySetupToken(setupDb, bannerToken(out))).toBe(true);
    });
  });

  describe('setup:create-admin', () => {
    it('crée un super admin confirmé, avec sa planète, mot de passe lu dans une variable d\'environnement', async () => {
      const { io, out } = makeIo();
      const code = await runCreateAdmin(
        deps(io, { MON_MDP: 'Secours12345' }),
        ['--username', 'secours', '--email', 'secours@example.test', '--password-env', 'MON_MDP'],
      );
      expect(code).toBe(0);
      expect(out.join('\n')).toMatch(/Super admin « secours » créé/);

      const user = await db.user.findUniqueOrThrow({ where: { username: 'secours' } });
      expect(user.role).toBe('SUPER_ADMIN');
      expect(user.emailVerifiedAt).not.toBeNull();
      expect(await argon2.verify(user.password, 'Secours12345')).toBe(true);
      expect(await db.planet.count({ where: { userId: user.id } })).toBe(1);
    });

    it('saisie masquée du mot de passe, deux fois ; deux saisies différentes : refus', async () => {
      const ok = makeIo(['Saisie12345', 'Saisie12345']);
      await runCreateAdmin(deps(ok.io), ['--username', 'saisie', '--email', 'saisie@example.test']);
      expect(ok.asked.map((a) => a.hidden)).toEqual([true, true]);
      expect((await db.user.findUniqueOrThrow({ where: { username: 'saisie' } })).role).toBe('SUPER_ADMIN');

      const bad = makeIo(['Saisie12345', 'Autre12345a']);
      await expect(
        runCreateAdmin(deps(bad.io), ['--username', 'saisie2', '--email', 'saisie2@example.test']),
      ).rejects.toThrow(/ne correspondent pas/);
      expect(await db.user.count({ where: { username: 'saisie2' } })).toBe(0);
    });

    it('promeut un compte existant : super admin, adresse confirmée, mot de passe remplacé, sessions révoquées', async () => {
      const player = await db.user.create({
        data: { username: 'joueur', email: 'joueur@example.test', password: await argon2.hash('Ancien12345') },
      });
      const session = await db.session.create({
        data: { userId: player.id, refreshHash: 'x', expiresAt: new Date(Date.now() + 3600_000) },
      });
      const { io } = makeIo();
      await runCreateAdmin(deps(io, { M: 'Nouveau12345' }), ['--username', 'joueur', '--password-env', 'M']);

      const after = await db.user.findUniqueOrThrow({ where: { id: player.id } });
      expect(after.role).toBe('SUPER_ADMIN');
      expect(after.emailVerifiedAt).not.toBeNull();
      expect(await argon2.verify(after.password, 'Nouveau12345')).toBe(true);
      expect((await db.session.findUniqueOrThrow({ where: { id: session.id } })).revokedAt).not.toBeNull();
    });

    it('refuse : identifiant invalide, adresse manquante ou déjà prise, mot de passe faible, variable absente', async () => {
      const env = { P: 'Valide12345', FAIBLE: 'faible' };
      const attempts: Array<[string[], RegExp]> = [
        [['--username', 'a', '--email', 'x@example.test', '--password-env', 'P'], /--username est requis/],
        [['--username', 'nouveau1', '--password-env', 'P'], /--email est requis/],
        [['--username', 'nouveau2', '--email', 'secours@example.test', '--password-env', 'P'], /déjà utilisée/],
        [['--username', 'nouveau3', '--email', 'n3@example.test', '--password-env', 'FAIBLE'], /minuscule, une majuscule/],
        [['--username', 'nouveau4', '--email', 'n4@example.test', '--password-env', 'ABSENTE'], /ABSENTE/],
      ];
      for (const [argv, message] of attempts) {
        await expect(runCreateAdmin(deps(makeIo().io, env), argv)).rejects.toThrow(message);
        await expect(runCreateAdmin(deps(makeIo().io, env), argv)).rejects.toBeInstanceOf(CliError);
      }
      expect(await db.user.count({ where: { username: { startsWith: 'nouveau' } } })).toBe(0);
    });
  });

  describe('admin:reset-password', () => {
    it('remplace le mot de passe, révoque les sessions et invalide les liens de réinitialisation', async () => {
      const user = await db.user.create({
        data: { username: 'oublieux', email: 'oublieux@example.test', password: await argon2.hash('Perdu12345') },
      });
      const session = await db.session.create({
        data: { userId: user.id, refreshHash: 'y', expiresAt: new Date(Date.now() + 3600_000) },
      });
      const link = await db.emailToken.create({
        data: {
          userId: user.id,
          type: 'reset_password',
          tokenHash: 'h'.repeat(64),
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });

      const { io, out } = makeIo();
      expect(await runResetPassword(deps(io, { M: 'Retrouve12345' }), ['--username', 'oublieux', '--password-env', 'M'])).toBe(0);
      expect(out.join('\n')).toMatch(/remplacé/);

      const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(await argon2.verify(after.password, 'Retrouve12345')).toBe(true);
      expect(await argon2.verify(after.password, 'Perdu12345')).toBe(false);
      expect((await db.session.findUniqueOrThrow({ where: { id: session.id } })).revokedAt).not.toBeNull();
      expect((await db.emailToken.findUniqueOrThrow({ where: { id: link.id } })).usedAt).not.toBeNull();
    });

    it('refuse : compte inconnu, identifiant absent, mot de passe faible (rien n\'est modifié)', async () => {
      await expect(runResetPassword(deps(makeIo().io, { M: 'Valide12345' }), ['--password-env', 'M'])).rejects.toThrow(/--username est requis/);
      await expect(
        runResetPassword(deps(makeIo().io, { M: 'Valide12345' }), ['--username', 'fantome', '--password-env', 'M']),
      ).rejects.toThrow(/Aucun compte/);
      const before = (await db.user.findUniqueOrThrow({ where: { username: 'oublieux' } })).password;
      await expect(
        runResetPassword(deps(makeIo().io, { M: 'faible' }), ['--username', 'oublieux', '--password-env', 'M']),
      ).rejects.toThrow(/minuscule, une majuscule/);
      expect((await db.user.findUniqueOrThrow({ where: { username: 'oublieux' } })).password).toBe(before);
    });
  });
});

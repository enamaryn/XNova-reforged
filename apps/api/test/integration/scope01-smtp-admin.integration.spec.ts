import { INestApplication } from '@nestjs/common';
import { createServer, Server, Socket } from 'net';
import request from 'supertest';
import { DatabaseService } from '../../src/database/database.service';
import { decryptSecret, encryptSecret } from '../../src/common/security/secret-box';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

/**
 * SCOPE-01 (comptes par email) — configuration SMTP réservée au super admin : accès, validation,
 * mot de passe jamais renvoyé et chiffré en base, journal sans secret, envoi de test réel.
 */
describe('API integration - Configuration SMTP (administration)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const usernames: string[] = [];

  type Account = { token: string; userId: string; email: string };
  let superAdmin: Account;
  let admin: Account;
  let player: Account;

  const server = () => app.getHttpServer();
  const auth = (a: Account) => ({ Authorization: `Bearer ${a.token}` });

  const signUp = async (role: 'PLAYER' | 'ADMIN' | 'SUPER_ADMIN'): Promise<Account> => {
    const user = buildTestUser();
    usernames.push(user.username);
    const { accessToken } = await registerAndLogin(app, user);
    const row = await database.user.update({
      where: { username: user.username },
      data: { role },
      select: { id: true, email: true },
    });
    return { token: accessToken, userId: row.id, email: row.email };
  };

  const getSmtp = (a: Account) => request(server()).get('/admin/smtp').set(auth(a));
  const putSmtp = (a: Account, body: Record<string, unknown>) =>
    request(server()).put('/admin/smtp').set(auth(a)).send(body);

  // --- Faux serveur SMTP : enregistre les messages reçus ---
  let smtp: Server;
  let smtpPort = 0;
  const received: Array<{ commands: string[]; data: string; authLine?: string }> = [];

  const startFakeSmtp = () =>
    new Promise<void>((resolve) => {
      smtp = createServer((socket: Socket) => {
        const session = { commands: [] as string[], data: '', authLine: undefined as string | undefined };
        let inData = false;
        let buffer = '';
        socket.write('220 fake.smtp ESMTP\r\n');
        socket.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          let index: number;
          while ((index = buffer.indexOf('\r\n')) >= 0) {
            const line = buffer.slice(0, index);
            buffer = buffer.slice(index + 2);
            if (inData) {
              if (line === '.') {
                inData = false;
                socket.write('250 OK queued\r\n');
              } else {
                session.data += `${line}\n`;
              }
              continue;
            }
            session.commands.push(line);
            const upper = line.toUpperCase();
            if (upper.startsWith('EHLO')) socket.write('250-fake.smtp\r\n250 AUTH PLAIN LOGIN\r\n');
            else if (upper.startsWith('AUTH PLAIN')) {
              session.authLine = line;
              socket.write('235 OK\r\n');
            } else if (upper.startsWith('MAIL FROM') || upper.startsWith('RCPT TO')) socket.write('250 OK\r\n');
            else if (upper === 'DATA') {
              inData = true;
              socket.write('354 go\r\n');
            } else if (upper === 'QUIT') {
              socket.write('221 bye\r\n');
              socket.end();
            } else socket.write('250 OK\r\n');
          }
        });
        socket.on('close', () => received.push(session));
        socket.on('error', () => undefined);
      });
      smtp.listen(0, '127.0.0.1', () => {
        smtpPort = (smtp.address() as { port: number }).port;
        resolve();
      });
    });

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    superAdmin = await signUp('SUPER_ADMIN');
    admin = await signUp('ADMIN');
    player = await signUp('PLAYER');
    await startFakeSmtp();
  });

  beforeEach(async () => {
    await database.gameConfig.deleteMany({ where: { key: { startsWith: 'smtp.' } } });
    received.length = 0;
  });

  afterAll(async () => {
    await new Promise((resolve) => smtp?.close(resolve));
    await database.gameConfig.deleteMany({ where: { key: { startsWith: 'smtp.' } } });
    for (const username of usernames) await cleanupTestUser(database, username);
    if (app) await app.close();
  });

  describe('contrôle d\'accès', () => {
    it('refuse sans authentification, aux joueurs et aux administrateurs simples', async () => {
      await request(server()).get('/admin/smtp').expect(401);
      for (const account of [player, admin]) {
        await getSmtp(account).expect(403);
        await putSmtp(account, { host: 'smtp.example.org' }).expect(403);
        await request(server()).post('/admin/smtp/test').set(auth(account)).send({}).expect(403);
      }
      expect(await database.gameConfig.count({ where: { key: { startsWith: 'smtp.' } } })).toBe(0);
    });

    it('le super admin lit la configuration par défaut (désactivée, sans mot de passe)', async () => {
      const res = await getSmtp(superAdmin).expect(200);
      expect(res.body).toMatchObject({
        enabled: false,
        host: '',
        port: 587,
        secure: false,
        passwordSet: false,
        passwordUnreadable: false,
      });
      expect(res.body).not.toHaveProperty('password');
    });
  });

  describe('enregistrement', () => {
    const valid = {
      enabled: true,
      host: 'smtp.example.org',
      port: 465,
      secure: true,
      username: 'mailer',
      fromEmail: 'jeu@example.org',
      fromName: 'XNova',
      password: 'tres-secret-123',
    };

    it('enregistre, ne renvoie jamais le mot de passe et le chiffre en base', async () => {
      const res = await putSmtp(superAdmin, valid).expect(200);
      const { password: _password, ...visible } = valid;
      expect(res.body).toMatchObject({ ...visible, passwordSet: true });
      expect(res.body).not.toHaveProperty('password');
      expect(JSON.stringify(res.body)).not.toContain(valid.password);

      const row = await database.gameConfig.findUniqueOrThrow({ where: { key: 'smtp.password' } });
      expect(row.value.startsWith('enc:v1:')).toBe(true);
      expect(row.value).not.toContain(valid.password);
      expect(decryptSecret(row.value)).toBe(valid.password);

      const again = await getSmtp(superAdmin).expect(200);
      expect(again.body).toMatchObject({ host: valid.host, port: 465, secure: true, passwordSet: true });
      expect(JSON.stringify(again.body)).not.toContain(valid.password);
    });

    it('une mise à jour sans mot de passe le conserve ; clearPassword le supprime', async () => {
      await putSmtp(superAdmin, valid).expect(200);
      const kept = await putSmtp(superAdmin, { port: 25, secure: false }).expect(200);
      expect(kept.body).toMatchObject({ port: 25, secure: false, passwordSet: true });
      expect(decryptSecret((await database.gameConfig.findUniqueOrThrow({ where: { key: 'smtp.password' } })).value)).toBe(
        valid.password,
      );

      const cleared = await putSmtp(superAdmin, { clearPassword: true }).expect(200);
      expect(cleared.body.passwordSet).toBe(false);
      expect(await database.gameConfig.count({ where: { key: 'smtp.password' } })).toBe(0);
    });

    it('refuse les valeurs invalides sans rien enregistrer', async () => {
      const invalid: Array<Record<string, unknown>> = [
        { port: 0 },
        { port: 70000 },
        { port: 25.5 },
        { host: 'smtp example.org' },
        { host: 'smtp.example.org; rm -rf' },
        { fromEmail: 'pas-un-email' },
        { fromName: 'Jeu\r\nBcc: autre@example.org' },
        { enabled: 'oui' },
        { unknownField: 'x' },
      ];
      for (const body of invalid) {
        await putSmtp(superAdmin, body).expect(400);
      }
      expect(await database.gameConfig.count({ where: { key: { startsWith: 'smtp.' } } })).toBe(0);
    });

    it('refuse l\'activation sans hôte ou sans adresse d\'expédition', async () => {
      await putSmtp(superAdmin, { enabled: true }).expect(400);
      await putSmtp(superAdmin, { enabled: true, host: 'smtp.example.org' }).expect(400);
      expect(await database.gameConfig.count({ where: { key: 'smtp.enabled' } })).toBe(0);
    });

    it('journalise les champs modifiés sans aucune valeur secrète', async () => {
      await putSmtp(superAdmin, valid).expect(200);
      const logs = await database.adminAuditLog.findMany({
        where: { userId: superAdmin.userId, action: 'update_smtp' },
        orderBy: { createdAt: 'desc' },
      });
      expect(logs.length).toBeGreaterThan(0);
      const serialized = JSON.stringify(logs[0].changes);
      expect(serialized).toContain('password');
      expect(serialized).not.toContain(valid.password);
      expect(serialized).not.toContain(valid.username);
    });
  });

  describe('chiffrement des secrets', () => {
    it('aller-retour, valeurs distinctes à chaque chiffrement, altération détectée', () => {
      const a = encryptSecret('motdepasse');
      const b = encryptSecret('motdepasse');
      expect(a).not.toBe(b);
      expect(decryptSecret(a)).toBe('motdepasse');
      expect(decryptSecret(a.slice(0, -4) + 'AAAA')).toBeNull();
      expect(decryptSecret('en clair')).toBeNull();
      expect(decryptSecret(null)).toBeNull();
    });

    it('un mot de passe illisible (clé changée) est signalé sans planter', async () => {
      await database.gameConfig.create({ data: { key: 'smtp.password', value: 'enc:v1:AAAA:BBBB:CCCC' } });
      const res = await getSmtp(superAdmin).expect(200);
      expect(res.body).toMatchObject({ passwordSet: false, passwordUnreadable: true });
    });
  });

  describe('envoi de test', () => {
    it('refuse tant que la configuration est désactivée', async () => {
      const res = await request(server()).post('/admin/smtp/test').set(auth(superAdmin)).send({}).expect(503);
      expect(res.body.message).toMatch(/pas configuré/);
    });

    it('envoie réellement un message au destinataire demandé, avec authentification', async () => {
      await putSmtp(superAdmin, {
        enabled: true,
        host: '127.0.0.1',
        port: smtpPort,
        secure: false,
        username: 'mailer',
        fromEmail: 'jeu@example.org',
        fromName: 'XNova',
        password: 'tres-secret-123',
      }).expect(200);

      const res = await request(server())
        .post('/admin/smtp/test')
        .set(auth(superAdmin))
        .send({ to: 'dest@example.org' })
        .expect(201);
      expect(res.body).toEqual({ success: true, to: 'dest@example.org' });

      await new Promise((resolve) => setTimeout(resolve, 200));
      const session = received.at(-1)!;
      expect(session.commands.join('\n')).toMatch(/RCPT TO:<dest@example.org>/i);
      expect(session.commands.join('\n')).toMatch(/MAIL FROM:<jeu@example.org>/i);
      expect(session.data).toMatch(/Subject: XNova Reforged/);
      expect(session.data).toMatch(/configuration SMTP fonctionne/);
      expect(Buffer.from(session.authLine!.split(' ')[2], 'base64').toString()).toBe('\0mailer\0tres-secret-123');
    });

    it('sans destinataire, écrit au super admin lui-même', async () => {
      await putSmtp(superAdmin, {
        enabled: true,
        host: '127.0.0.1',
        port: smtpPort,
        fromEmail: 'jeu@example.org',
      }).expect(200);
      const res = await request(server()).post('/admin/smtp/test').set(auth(superAdmin)).send({}).expect(201);
      expect(res.body.to).toBe(superAdmin.email);
    });

    it('serveur injoignable : erreur 400 lisible, sans fuite du mot de passe', async () => {
      await putSmtp(superAdmin, {
        enabled: true,
        host: '127.0.0.1',
        port: 1,
        fromEmail: 'jeu@example.org',
        username: 'mailer',
        password: 'tres-secret-123',
      }).expect(200);
      const res = await request(server()).post('/admin/smtp/test').set(auth(superAdmin)).send({}).expect(400);
      expect(res.body.message).toMatch(/Échec de l'envoi/);
      expect(JSON.stringify(res.body)).not.toContain('tres-secret-123');
    });

    it('refuse une adresse de destination invalide', async () => {
      await request(server())
        .post('/admin/smtp/test')
        .set(auth(superAdmin))
        .send({ to: 'pas-un-email' })
        .expect(400);
    });
  });
});

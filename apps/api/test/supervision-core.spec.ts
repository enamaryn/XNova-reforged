import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { describeDsn, isValidDsn, parseDsn, sendSentryTestEvent } from '../src/supervision/dsn';
import { computeFingerprint, stableMessage } from '../src/supervision/fingerprint';
import { csvCell, toCsv } from '../src/supervision/incident-query.service';
import { MASK, normalizeRoute, redactString, redactValue } from '../src/supervision/redact';
import { cronRegistry, MonitoredCron } from '../src/supervision/cron-registry';
import { scrubSentryEvent } from '../src/monitoring/sentry';

// DSN fictif assemblé à l'exécution : le test « aucun DSN versionné » analyse les fichiers suivis par Git
const DSN = ['https://', 'abcdef0123456789abcdef0123456789', '@o1.ingest.sentry', '.io/4501'].join('');
const json = (value: unknown) => JSON.stringify(value);

describe('Supervision — masquage', () => {
  it('masque mots de passe, jetons et en-têtes à tous les niveaux d’imbrication', () => {
    const out = json(
      redactValue({
        body: { password: 'hunter2', nested: { deep: { refreshToken: 'r-123', authorization: 'Bearer abc.def.ghi' } } },
        headers: { cookie: 'session=zzz', Authorization: 'Bearer abcdefgh' },
        smtp: { pass: 'smtp-secret' },
        list: [{ jwt: 'x' }, { apiKey: 'k' }],
        ok: 'visible',
      }),
    );
    for (const leak of ['hunter2', 'r-123', 'abc.def.ghi', 'session=zzz', 'smtp-secret', 'abcdefgh']) {
      expect(out).not.toContain(leak);
    }
    expect(out).toContain('visible');
    expect(out).toContain(MASK);
  });

  it('masque JWT, DSN, URL à identifiants, emails, valeurs chiffrées et code d’installation dans les chaînes', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghij';
    const text = redactString(
      `jwt=${jwt} dsn=${DSN} db=postgresql://admin:pw0rd@localhost:5432/x mail=joueur@example.com enc:v1:AAAA+bbb/cc== code ABCD-EFGH-JKMN-PQRS ?token=hello`,
    );
    for (const leak of [jwt, DSN, 'pw0rd', 'joueur@example.com', 'AAAA+bbb', 'ABCD-EFGH-JKMN-PQRS', 'hello']) {
      expect(text).not.toContain(leak);
    }
  });

  it('masque le contenu des messages privés et les emails par clé', () => {
    const out = json(redactValue({ content: 'salut en privé', email: 'a@b.fr', to: 'c@d.fr', message: 'x', planetId: 'p1' }));
    expect(out).not.toContain('salut en privé');
    expect(out).not.toContain('a@b.fr');
    expect(out).toContain('p1');
  });

  it('survit aux cycles et borne profondeur et taille', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(() => redactValue(cyclic)).not.toThrow();
    const big = Array.from({ length: 500 }, (_, i) => i);
    expect((redactValue(big) as unknown[]).length).toBeLessThanOrEqual(21);
    expect(redactString('x'.repeat(10000)).length).toBeLessThan(2100);
  });

  it('normalise les routes (identifiants et paramètres retirés)', () => {
    const route = normalizeRoute('/api/planets/3f2c0a8e-1111-4222-8333-444455556666/buildings?token=abc');
    expect(route).not.toContain('abc');
    expect(route).not.toContain('3f2c0a8e');
  });

  it('le nettoyage Sentry masque aussi les événements sortants', () => {
    const event = scrubSentryEvent({
      message: `échec ${DSN}`,
      request: { headers: { authorization: 'Bearer secretsecret' }, cookies: { a: 'b' }, data: { password: 'p' } },
    } as never);
    const out = json(event);
    expect(out).not.toContain('secretsecret');
    expect(out).not.toContain(DSN);
    expect(out).not.toContain('"password":"p"');
  });
});

describe('Supervision — empreinte', () => {
  const base = { source: 'api', level: 'error', errorType: 'TypeError', operation: 'GET /planets/:id', httpStatus: 500 };

  it('regroupe les erreurs identiques malgré identifiants et nombres variables', () => {
    const a = computeFingerprint({ ...base, message: 'planète 12345 introuvable pour 3f2c0a8e-1111-4222-8333-444455556666' });
    const b = computeFingerprint({ ...base, message: 'planète 98765 introuvable pour aaaaaaaa-1111-4222-8333-444455556666' });
    expect(a).toBe(b);
    expect(stableMessage('a  12345   b')).toBe('a <n> b');
  });

  it('distingue origine, type ou message différents', () => {
    const a = computeFingerprint({ ...base, message: 'boom' });
    expect(computeFingerprint({ ...base, source: 'cron', message: 'boom' })).not.toBe(a);
    expect(computeFingerprint({ ...base, errorType: 'RangeError', message: 'boom' })).not.toBe(a);
    expect(computeFingerprint({ ...base, message: 'autre' })).not.toBe(a);
  });
});

describe('Supervision — DSN et test Sentry', () => {
  it('valide le format et ne décrit jamais la clé', () => {
    expect(isValidDsn(DSN)).toBe(true);
    expect(isValidDsn('pas un dsn')).toBe(false);
    expect(isValidDsn('ftp://x@y/1')).toBe(false);
    expect(parseDsn(DSN)).toMatchObject({ host: 'o1.ingest.sentry.io', projectId: '4501' });
    expect(describeDsn(DSN)).not.toContain('abcdef0123');
  });

  describe('contre un faux serveur HTTP', () => {
    let server: Server;
    let status = 200;
    let received: { url?: string; auth?: string; body: string } | null = null;

    beforeAll(async () => {
      server = createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          received = { url: req.url, auth: String(req.headers['x-sentry-auth']), body };
          if (status === -1) return; // ne répond jamais
          res.statusCode = status;
          res.end('{}');
        });
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    });
    afterAll(() => new Promise<void>((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }));

    const dsn = () => `http://abcdef0123456789@127.0.0.1:${(server.address() as AddressInfo).port}/77`;

    it.each([
      [200, true, 'accepted'],
      [401, false, 'rejected_key'],
      [403, false, 'rejected_key'],
      [404, false, 'project_not_found'],
      [429, false, 'rate_limited'],
      [500, false, 'server_error'],
    ])('HTTP %i → %s', async (code, ok, expected) => {
      status = code;
      const result = await sendSentryTestEvent(dsn(), 'production');
      expect(result).toMatchObject({ ok, code: expected });
    });

    it('envoie un événement identifiable à la bonne route avec la clé publique', async () => {
      status = 200;
      await sendSentryTestEvent(dsn(), 'staging');
      expect(received?.url).toBe('/api/77/envelope/');
      expect(received?.auth).toContain('sentry_key=abcdef0123456789');
      expect(received?.body).toContain('xnova_test');
      expect(received?.body).toContain('staging');
    });

    it('timeout propre quand Sentry ne répond pas', async () => {
      status = -1;
      const result = await sendSentryTestEvent(dsn(), 'production', { timeoutMs: 150 });
      expect(result).toMatchObject({ ok: false, code: 'timeout' });
    });
  });

  it('injoignable et DSN invalide ne lèvent jamais', async () => {
    const down = await sendSentryTestEvent('http://abcdef0123456789@127.0.0.1:1/5', 'production', { timeoutMs: 500 });
    expect(down).toMatchObject({ ok: false });
    expect(['unreachable', 'timeout']).toContain(down.code);
    expect(await sendSentryTestEvent('nope', 'production')).toMatchObject({ ok: false, code: 'invalid_dsn' });
  });
});

describe('Supervision — export CSV', () => {
  it('neutralise les formules et échappe les guillemets', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell(null)).toBe('');
    expect(toCsv([{ id: '1', message: '@cmd' }]).split('\n')[1]).toContain("'@cmd");
  });
});

describe('Supervision — registre des tâches planifiées', () => {
  beforeEach(() => cronRegistry.reset());

  it('enregistre un battement par exécution et relaie les erreurs sans changer le comportement', async () => {
    class Job {
      @MonitoredCron('job-ok', 1000) async ok() { return 42; }
      @MonitoredCron('job-ko', 1000) async ko() { throw new Error('boum'); }
    }
    const job = new Job();
    expect(await job.ok()).toBe(42);
    await expect(job.ko()).rejects.toThrow('boum');
    const beats = Object.fromEntries(cronRegistry.snapshot().map((b) => [b.name, b]));
    expect(beats['job-ok'].runs).toBeGreaterThanOrEqual(1);
    expect(beats['job-ko'].lastError).toBe('boum');
  });
});

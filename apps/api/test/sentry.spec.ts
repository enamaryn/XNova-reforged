import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const init = jest.fn();
jest.mock('@sentry/node', () => ({ init: (...args: unknown[]) => init(...args) }));
jest.mock('@sentry/profiling-node', () => ({ nodeProfilingIntegration: () => ({ name: 'profiling' }) }));

import { initSentry } from '../src/monitoring/sentry';

describe('Sentry (API)', () => {
  beforeEach(() => init.mockClear());

  it('sans DSN : aucune initialisation, aucune erreur', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => initSentry('', 'production')).not.toThrow();
    expect(init).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('avec DSN : initialise avec le DSN reçu, des taux réduits en production et le profilage', () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    initSentry('https://cle@example.invalid/1', 'production');
    expect(init).toHaveBeenCalledTimes(1);
    const options = init.mock.calls[0][0];
    expect(options).toMatchObject({
      dsn: 'https://cle@example.invalid/1',
      environment: 'production',
      tracesSampleRate: 0.1,
      profileSessionSampleRate: 0.1,
      profileLifecycle: 'trace',
    });
    expect(options.integrations).toHaveLength(1);
  });

  it('hors production : échantillonnage complet', () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    initSentry('https://cle@example.invalid/1', 'development');
    expect(init.mock.calls[0][0]).toMatchObject({ tracesSampleRate: 1, profileSessionSampleRate: 1 });
  });
});

describe('Aucun DSN réel versionné', () => {
  it('aucun fichier suivi par Git ne contient de DSN Sentry', () => {
    const root = join(__dirname, '..', '..', '..');
    const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter((file) => file && !file.endsWith('package-lock.json') && !/\.(png|jpe?g|webp|ico|svg|woff2?|gz|zip)$/i.test(file));
    // DSN : https://<clé hexadécimale>@<hôte>.sentry.io/<projet> ou ingest.*.sentry.io
    const dsn = /https:\/\/[0-9a-f]{16,}(:[0-9a-f]+)?@[a-z0-9.-]*sentry\.io\/\d+/i;
    const offenders = files.filter((file) => {
      try {
        return dsn.test(readFileSync(join(root, file), 'utf8'));
      } catch {
        return false;
      }
    });
    expect(offenders).toEqual([]);
  });
});

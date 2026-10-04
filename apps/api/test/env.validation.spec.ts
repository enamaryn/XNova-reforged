import { resolveAllowedOrigins, validateEnv } from '../src/config/env.validation';

const strong = 'a'.repeat(16) + 'B'.repeat(16) + '1234';
const validProd = {
  NODE_ENV: 'production',
  JWT_SECRET: strong,
  JWT_REFRESH_SECRET: 'z'.repeat(40),
  DATABASE_URL: 'postgresql://u:p@db:5432/xnova',
  WEB_ORIGINS: 'https://jeu.example.test',
};

describe('validateEnv (SEC-04)', () => {
  it('reste permissif hors production', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => validateEnv({})).not.toThrow();
  });

  it('accepte une configuration de production complète', () => {
    expect(() => validateEnv(validProd)).not.toThrow();
  });

  it.each(['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'WEB_ORIGINS'])(
    'refuse la production sans %s',
    (key) => {
      const env: Record<string, unknown> = { ...validProd };
      delete env[key];
      expect(() => validateEnv(env)).toThrow(/Configuration invalide/);
    },
  );

  it('refuse les secrets d\'exemple, trop courts ou identiques', () => {
    expect(() => validateEnv({ ...validProd, JWT_SECRET: 'change-me' })).toThrow(/JWT_SECRET/);
    expect(() => validateEnv({ ...validProd, JWT_REFRESH_SECRET: 'court' })).toThrow(
      /JWT_REFRESH_SECRET/,
    );
    expect(() => validateEnv({ ...validProd, JWT_REFRESH_SECRET: strong })).toThrow(/distincts/);
    expect(() =>
      validateEnv({ ...validProd, JWT_SECRET: 'change-me-' + 'x'.repeat(40) }),
    ).toThrow(/JWT_SECRET/);
  });

  it('refuse un CORS générique en production', () => {
    expect(() => validateEnv({ ...validProd, WEB_ORIGINS: '*' })).toThrow(/WEB_ORIGINS/);
  });
});

describe('resolveAllowedOrigins (SEC-04)', () => {
  it('ne s\'ouvre jamais en production, même sans origines', () => {
    expect(resolveAllowedOrigins({ NODE_ENV: 'production' } as any)).toEqual([]);
    expect(
      resolveAllowedOrigins({ NODE_ENV: 'production', WEB_ORIGINS: 'https://a.test, https://b.test' } as any),
    ).toEqual(['https://a.test', 'https://b.test']);
  });

  it('autorise tout en développement sans configuration', () => {
    expect(resolveAllowedOrigins({ NODE_ENV: 'development' } as any)).toBe(true);
    expect(resolveAllowedOrigins({ WEB_ORIGIN: 'http://localhost:3000' } as any)).toEqual([
      'http://localhost:3000',
    ]);
  });
});

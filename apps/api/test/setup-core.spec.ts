import {
  SETUP_KEYS,
  SETUP_TOKEN_IDLE_MS,
  SetupDb,
  clearProgressFlag,
  generateSetupToken,
  isSetupCompleted,
  issueSetupToken,
  markSetupCompleted,
  normalizeSetupToken,
  readProgressFlags,
  resetSetup,
  verifySetupToken,
  writeProgressFlag,
} from '../src/setup/setup-core';

/** Faux client minimal : `GameConfig` en mémoire. */
function fakeDb(): SetupDb & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return {
    rows,
    gameConfig: {
      findUnique: async ({ where }) => (rows.has(where.key) ? { key: where.key, value: rows.get(where.key)! } : null),
      findMany: async ({ where }) =>
        [...rows.entries()]
          .filter(([key]) => key.startsWith(where.key.startsWith))
          .map(([key, value]) => ({ key, value })),
      upsert: async ({ where, create, update }) => {
        rows.set(where.key, rows.has(where.key) ? update.value : create.value);
      },
      deleteMany: async ({ where }) => {
        const keys = where.key as { in?: string[]; startsWith?: string };
        for (const key of [...rows.keys()]) {
          if (keys.in?.includes(key) || (keys.startsWith && key.startsWith(keys.startsWith))) rows.delete(key);
        }
      },
    },
  };
}

describe('Code d\'installation (SETUP-01)', () => {
  it('génère des codes lisibles, uniques et sans caractères ambigus', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const token = generateSetupToken();
      expect(token).toMatch(/^[A-HJKMNP-Z2-9]{4}(-[A-HJKMNP-Z2-9]{4}){3}$/);
      seen.add(token);
    }
    expect(seen.size).toBe(200);
  });

  it('normalise : casse, espaces et tirets sont ignorés', () => {
    expect(normalizeSetupToken(' abcd-efgh 2345 ')).toBe('ABCDEFGH2345');
    expect(normalizeSetupToken('')).toBe('');
  });

  it('émet, stocke seulement l\'empreinte, puis vérifie', async () => {
    const db = fakeDb();
    const token = await issueSetupToken(db);
    expect(JSON.stringify([...db.rows.values()])).not.toContain(normalizeSetupToken(token));
    expect(await verifySetupToken(db, token)).toBe(true);
    expect(await verifySetupToken(db, token.toLowerCase().replace(/-/g, ' '))).toBe(true);
    expect(await verifySetupToken(db, 'AAAA-AAAA-AAAA-AAAA')).toBe(false);
    expect(await verifySetupToken(db, '')).toBe(false);
    expect(await verifySetupToken(db, undefined)).toBe(false);
  });

  it('un nouveau code invalide le précédent', async () => {
    const db = fakeDb();
    const first = await issueSetupToken(db);
    const second = await issueSetupToken(db);
    expect(await verifySetupToken(db, first)).toBe(false);
    expect(await verifySetupToken(db, second)).toBe(true);
  });

  it('expire après l\'inactivité maximale ; une requête valide repousse l\'échéance', async () => {
    const db = fakeDb();
    const t0 = new Date('2026-10-06T10:00:00Z');
    const token = await issueSetupToken(db, { now: t0 });

    const t1 = new Date(t0.getTime() + SETUP_TOKEN_IDLE_MS - 60_000);
    expect(await verifySetupToken(db, token, t1)).toBe(true); // repousse jusqu'à t1 + 2 h

    const t2 = new Date(t1.getTime() + SETUP_TOKEN_IDLE_MS - 60_000);
    expect(await verifySetupToken(db, token, t2)).toBe(true);

    const t3 = new Date(t2.getTime() + SETUP_TOKEN_IDLE_MS + 1000);
    expect(await verifySetupToken(db, token, t3)).toBe(false);
  });

  it('un code fixe (SETUP_TOKEN) est accepté, jamais stocké en clair', async () => {
    const db = fakeDb();
    await issueSetupToken(db, { fixedToken: 'mon-code-de-test' });
    expect(await verifySetupToken(db, 'MON-CODE-DE-TEST')).toBe(true);
    expect(JSON.stringify([...db.rows.values()])).not.toContain('MONCODEDETEST');
  });

  it('l\'installation terminée refuse tout code et efface le code et la progression', async () => {
    const db = fakeDb();
    const token = await issueSetupToken(db);
    await writeProgressFlag(db, SETUP_KEYS.smtpTestedAt, 'x');
    await writeProgressFlag(db, SETUP_KEYS.adminId, 'admin-1');
    expect(await isSetupCompleted(db)).toBe(false);

    await markSetupCompleted(db);
    expect(await isSetupCompleted(db)).toBe(true);
    expect(await verifySetupToken(db, token)).toBe(false);
    expect([...db.rows.keys()]).toEqual([SETUP_KEYS.completedAt]);
  });

  it('résultat de la réinitialisation : rouvre le parcours avec un nouveau code, sans effacer le reste', async () => {
    const db = fakeDb();
    db.rows.set('gameSpeed', '10');
    const old = await issueSetupToken(db);
    await markSetupCompleted(db);

    const fresh = await resetSetup(db);
    expect(await isSetupCompleted(db)).toBe(false);
    expect(await verifySetupToken(db, old)).toBe(false);
    expect(await verifySetupToken(db, fresh)).toBe(true);
    expect(db.rows.get('gameSpeed')).toBe('10');
  });

  it('progression : lecture, écriture et effacement des indicateurs', async () => {
    const db = fakeDb();
    expect(await readProgressFlags(db)).toEqual({ smtpTestedAt: null, settingsSavedAt: null, adminId: null });
    await writeProgressFlag(db, SETUP_KEYS.settingsSavedAt, '2026');
    await writeProgressFlag(db, SETUP_KEYS.adminId, 'u1');
    expect(await readProgressFlags(db)).toEqual({ smtpTestedAt: null, settingsSavedAt: '2026', adminId: 'u1' });
    await clearProgressFlag(db, 'adminId');
    expect((await readProgressFlags(db)).adminId).toBeNull();
  });
});

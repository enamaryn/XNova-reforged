import {
  MULTI_ACCOUNT_DEFAULTS,
  canonicalizeEmail,
  normalizeIp,
  pairKey,
  parseMultiAccountConfig,
  readMultiAccountConfig,
} from '@xnova/game-config';

describe('doubles comptes - email canonique', () => {
  it('ignore la casse, les espaces et la partie +étiquette', () => {
    expect(canonicalizeEmail('  Joueur+jeu@Example.COM ')).toBe('joueur@example.com');
    expect(canonicalizeEmail('a+b+c@example.org')).toBe('a@example.org');
  });

  it('ignore les points chez Gmail et ramène googlemail.com à gmail.com', () => {
    expect(canonicalizeEmail('j.o.u.e.u.r@gmail.com')).toBe('joueur@gmail.com');
    expect(canonicalizeEmail('Joueur.Un+x@googlemail.com')).toBe('joueurun@gmail.com');
  });

  it('garde les points des autres domaines', () => {
    expect(canonicalizeEmail('jean.dupont@example.com')).toBe('jean.dupont@example.com');
    expect(canonicalizeEmail('jean.dupont@example.com')).not.toBe(canonicalizeEmail('jeandupont@example.com'));
  });

  it('laisse une valeur sans arobase telle quelle (minuscules)', () => {
    expect(canonicalizeEmail('Pas-Un-Email')).toBe('pas-un-email');
    expect(canonicalizeEmail('@example.com')).toBe('@example.com');
  });
});

describe('doubles comptes - adresse IP', () => {
  it('garde une IPv4 valide et ramène l’IPv4 mappée en IPv6', () => {
    expect(normalizeIp('203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIp(' 10.0.0.1 ')).toBe('10.0.0.1');
  });

  it('réduit une IPv6 à son préfixe /64 (même foyer, autre adresse)', () => {
    const a = normalizeIp('2001:db8:abcd:12:1:2:3:4');
    const b = normalizeIp('2001:0db8:abcd:0012:ffff:ffff:ffff:ffff');
    expect(a).toBe('2001:db8:abcd:12::/64');
    expect(b).toBe(a);
    expect(normalizeIp('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(normalizeIp('2001:db8:1:2::')).toBe('2001:db8:1:2::/64');
    expect(normalizeIp('::1')).toBe('0:0:0:0::/64');
  });

  it('refuse une valeur vide ou illisible', () => {
    expect(normalizeIp(undefined)).toBeNull();
    expect(normalizeIp('')).toBeNull();
    expect(normalizeIp('300.1.1.1')).toBeNull();
    expect(normalizeIp('pas une ip')).toBeNull();
    expect(normalizeIp('1:2:3:4:5:6:7:8:9')).toBeNull();
    expect(normalizeIp('12345::1')).toBeNull();
  });

  it('ordonne une paire de comptes', () => {
    expect(pairKey('b', 'a')).toEqual(['a', 'b']);
    expect(pairKey('a', 'b')).toEqual(['a', 'b']);
  });
});

describe('doubles comptes - réglages', () => {
  const valid = () => JSON.parse(JSON.stringify(MULTI_ACCOUNT_DEFAULTS));

  it('accepte les valeurs par défaut', () => {
    const parsed = parseMultiAccountConfig(valid());
    expect(parsed.ok).toBe(true);
    if (parsed.ok === true) expect(parsed.config).toEqual(MULTI_ACCOUNT_DEFAULTS);
  });

  it('refuse sans rien corriger en silence', () => {
    const bad = (patch: Record<string, unknown>) => parseMultiAccountConfig({ ...valid(), ...patch });
    expect(bad({ maxAccountsPerIp: -1 }).ok).toBe(false);
    expect(bad({ maxAccountsPerIp: 1.5 }).ok).toBe(false);
    expect(bad({ maxAccountsPerIp: '3' }).ok).toBe(false);
    expect(bad({ ipWindowDays: 0 }).ok).toBe(false);
    expect(bad({ enforceRegistration: 'oui' }).ok).toBe(false);
    expect(bad({ blockLinkedTransfers: undefined }).ok).toBe(false);
    expect(bad({ ipWindowDays: 120, retentionDays: 90 }).ok).toBe(false); // fenêtre plus longue que la conservation
    expect(parseMultiAccountConfig(null).ok).toBe(false);
  });

  it('accepte 0 compte par IP (illimité)', () => {
    expect(parseMultiAccountConfig({ ...valid(), maxAccountsPerIp: 0 }).ok).toBe(true);
  });

  it('relit un réglage stocké : défaut si absent ou corrompu, bornes appliquées', () => {
    expect(readMultiAccountConfig(null)).toEqual(MULTI_ACCOUNT_DEFAULTS);
    expect(readMultiAccountConfig('pas du json')).toEqual(MULTI_ACCOUNT_DEFAULTS);
    expect(readMultiAccountConfig('42')).toEqual(MULTI_ACCOUNT_DEFAULTS);
    const partial = readMultiAccountConfig(JSON.stringify({ maxAccountsPerIp: 500, retentionDays: 20, ipWindowDays: 60, enforceRegistration: 'x' }));
    expect(partial.maxAccountsPerIp).toBe(100);
    expect(partial.retentionDays).toBe(20);
    expect(partial.ipWindowDays).toBe(20); // jamais plus long que la conservation
    expect(partial.enforceRegistration).toBe(MULTI_ACCOUNT_DEFAULTS.enforceRegistration);
  });
});

import { resolveApiBaseUrl, resolveSocketTarget } from '../../web/lib/api/base-url';

const page = { protocol: 'https:', hostname: 'xnova.exemple.fr' };

describe('Adresse de l\'API vue par le navigateur (web)', () => {
  it('adresse absolue (sous-domaine dédié) : conservée, barre finale retirée', () => {
    expect(resolveApiBaseUrl('https://api.exemple.fr', page)).toBe('https://api.exemple.fr');
    expect(resolveApiBaseUrl('https://api.exemple.fr/', page)).toBe('https://api.exemple.fr');
  });

  it('chemin relatif (même origine) : conservé', () => {
    expect(resolveApiBaseUrl('/api', page)).toBe('/api');
    expect(resolveApiBaseUrl('/api/', page)).toBe('/api');
  });

  it('localhost : remplacé par le nom d\'hôte de la page (développement en réseau local), pas côté serveur', () => {
    expect(resolveApiBaseUrl('http://localhost:3001', { protocol: 'http:', hostname: '192.168.1.5' })).toBe(
      'http://192.168.1.5:3001',
    );
    expect(resolveApiBaseUrl('http://localhost:3001')).toBe('http://localhost:3001');
  });

  it('non défini : port 3001 de l\'hôte de la page, ou localhost côté serveur', () => {
    expect(resolveApiBaseUrl(undefined, page)).toBe('https://xnova.exemple.fr:3001');
    expect(resolveApiBaseUrl('', undefined)).toBe('http://localhost:3001');
  });
});

describe('Cible Socket.io', () => {
  it('sous-domaine : espace de noms /game sur l\'origine de l\'API, chemin par défaut', () => {
    expect(resolveSocketTarget('https://api.exemple.fr', 'https://xnova.exemple.fr')).toEqual({
      url: 'https://api.exemple.fr/game',
      path: '/socket.io',
    });
  });

  it('préfixe relatif /api : même origine, le préfixe devient le chemin du transport', () => {
    expect(resolveSocketTarget('/api', 'https://xnova.exemple.fr')).toEqual({
      url: 'https://xnova.exemple.fr/game',
      path: '/api/socket.io',
    });
  });

  it('préfixe absolu avec barre finale', () => {
    expect(resolveSocketTarget('https://xnova.exemple.fr/api/', 'https://xnova.exemple.fr')).toEqual({
      url: 'https://xnova.exemple.fr/game',
      path: '/api/socket.io',
    });
  });

  it('adresse avec port', () => {
    expect(resolveSocketTarget('http://192.168.1.5:3001', 'http://192.168.1.5:3000')).toEqual({
      url: 'http://192.168.1.5:3001/game',
      path: '/socket.io',
    });
  });
});

import type { ConfigService } from '@nestjs/config';
import { MonitoringService } from '../src/monitoring/monitoring.service';

const fake = {
  isOpen: true,
  connect: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
  ping: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};
jest.mock('redis', () => ({ createClient: jest.fn(() => fake) }));

import { RedisService } from '../src/redis/redis.service';

const config = (url?: string) => ({ get: () => url }) as unknown as ConfigService;

describe('RedisService', () => {
  beforeEach(() => {
    Object.values(fake).forEach((value) => typeof value === 'function' && (value as jest.Mock).mockReset());
    fake.isOpen = true;
  });

  it('sans REDIS_URL : désactivé, aucune opération ne lève', async () => {
    const service = new RedisService(config(undefined));
    await service.onModuleInit();
    expect(await service.ping()).toBe('disabled');
    expect(await service.get('k')).toBeNull();
    await expect(service.set('k', 'v')).resolves.toBeUndefined();
    await expect(service.del('k')).resolves.toBeUndefined();
    expect(await service.getJson('k')).toBeNull();
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('connecté : ping, get/set (avec et sans TTL), JSON, suppression, arrêt propre', async () => {
    const service = new RedisService(config('redis://x'));
    fake.connect.mockResolvedValue(undefined);
    await service.onModuleInit();
    fake.ping.mockResolvedValue('PONG');
    expect(await service.ping()).toBe('up');
    fake.get.mockResolvedValue('{"a":1}');
    expect(await service.getJson<{ a: number }>('k')).toEqual({ a: 1 });
    await service.set('k', 'v');
    await service.set('k', 'v', 30);
    expect(fake.set).toHaveBeenNthCalledWith(1, 'k', 'v');
    expect(fake.set).toHaveBeenNthCalledWith(2, 'k', 'v', { EX: 30 });
    await service.setJson('j', { b: 2 }, 5);
    expect(fake.set).toHaveBeenLastCalledWith('j', '{"b":2}', { EX: 5 });
    await service.del('k');
    expect(fake.del).toHaveBeenCalledWith('k');
    await service.onModuleDestroy();
    expect(fake.quit).toHaveBeenCalled();
  });

  it('erreurs Redis : le jeu continue (valeurs neutres), état « down »', async () => {
    const service = new RedisService(config('redis://x'));
    fake.connect.mockResolvedValue(undefined);
    await service.onModuleInit();
    fake.ping.mockResolvedValue('NOPE');
    expect(await service.ping()).toBe('down');
    fake.ping.mockRejectedValue(new Error('boom'));
    expect(await service.ping()).toBe('down');
    fake.get.mockRejectedValue(new Error('boom'));
    expect(await service.get('k')).toBeNull();
    fake.set.mockRejectedValue(new Error('boom'));
    await expect(service.set('k', 'v')).resolves.toBeUndefined();
    fake.del.mockRejectedValue(new Error('boom'));
    await expect(service.del('k')).resolves.toBeUndefined();
    fake.get.mockResolvedValue('pas du json');
    expect(await service.getJson('k')).toBeNull();
    fake.isOpen = false;
    expect(await service.ping()).toBe('down');
  });

  it('connexion impossible au démarrage : cache désactivé sans exception', async () => {
    const service = new RedisService(config('redis://x'));
    fake.connect.mockRejectedValue(new Error('ECONNREFUSED'));
    await service.onModuleInit();
    expect(await service.ping()).toBe('disabled');
  });
});

describe('MonitoringService', () => {
  it('enregistre, filtre, agrège et borne les métriques', () => {
    const service = new MonitoringService();
    service.recordMetric('latence', 10, { route: '/a' });
    service.recordMetric('latence', 30);
    service.recordMetric('autre', 5);
    expect(service.getMetrics('latence')).toHaveLength(2);
    expect(service.getMetrics()).toHaveLength(3);
    expect(service.getAggregatedMetrics().latence).toEqual({ count: 2, sum: 40, avg: 20, min: 10, max: 30 });
    for (let i = 0; i < 1100; i += 1) service.recordMetric('flux', i);
    expect(service.getMetrics().length).toBe(1000);
    service.clearMetrics();
    expect(service.getMetrics()).toEqual([]);
  });
});

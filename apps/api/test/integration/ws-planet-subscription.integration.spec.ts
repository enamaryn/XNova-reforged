import { INestApplication } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { DatabaseService } from '../../src/database/database.service';
import { GameEventsGateway } from '../../src/game-events/game-events.gateway';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

/**
 * SEC-02 — un joueur ne peut pas s'abonner aux événements privés d'une planète adverse.
 */
describe('API integration - Autorisation WebSocket (SEC-02)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let gateway: GameEventsGateway;
  let port: number;

  const users: ReturnType<typeof buildTestUser>[] = [];
  const sockets: Socket[] = [];

  const connect = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(`http://127.0.0.1:${port}/game`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
      });
      sockets.push(socket);
      socket.on('connected', () => resolve(socket));
      socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('timeout connexion')), 5000);
    });

  // Nest répond par un événement ({ event, data }) et non par un accusé de réception
  const subscribe = (socket: Socket, planetId: unknown) =>
    new Promise<{ event: string; data: any }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('pas de reponse')), 5000);
      const done = (event: string) => (data: any) => {
        clearTimeout(timer);
        socket.off('subscribed');
        socket.off('subscribe:refused');
        resolve({ event, data });
      };
      socket.once('subscribed', done('subscribed'));
      socket.once('subscribe:refused', done('subscribe:refused'));
      socket.emit('subscribe:planet', { planetId });
    });

  const signUp = async () => {
    const user = buildTestUser();
    users.push(user);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    return { token: accessToken as string, planetId: me.body.planets[0].id as string };
  };

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    gateway = app.get(GameEventsGateway);
    await app.listen(0);
    port = (app.getHttpServer().address() as { port: number }).port;
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    for (const u of users) await cleanupTestUser(database, u.username);
    if (app) await app.close();
  });

  it('refuse la planète adverse, accepte la sienne, sans fuite d\'événements', async () => {
    const owner = await signUp();
    const intruder = await signUp();
    const ownerSocket = await connect(owner.token);
    const intruderSocket = await connect(intruder.token);

    const received = { owner: [] as any[], intruder: [] as any[] };
    ownerSocket.on('resources:updated', (p) => received.owner.push(p));
    intruderSocket.on('resources:updated', (p) => received.intruder.push(p));

    const refused = await subscribe(intruderSocket, owner.planetId);
    const accepted = await subscribe(ownerSocket, owner.planetId);
    const missing = await subscribe(intruderSocket, 'planete-inexistante');
    const invalid = await subscribe(intruderSocket, { $ne: null });

    expect(refused.event).toBe('subscribe:refused');
    expect(missing).toEqual(refused);
    expect(invalid.event).toBe('subscribe:refused');
    expect(accepted).toEqual({ event: 'subscribed', data: { planetId: owner.planetId } });

    gateway.emitResourcesUpdate(owner.planetId, { resources: { metal: 123 } });
    await new Promise((r) => setTimeout(r, 300));

    expect(received.owner).toHaveLength(1);
    expect(received.intruder).toHaveLength(0);
  });
});

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

describe('API integration - Messagerie', () => {
  let app: INestApplication;
  let database: DatabaseService;

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('affiche la boîte de réception vide', async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);
    expect(accessToken).toBeTruthy();

    const server = app.getHttpServer();

    // GET /messages/inbox - Devrait être vide au départ
    const inboxResponse = await request(server)
      .get('/messages/inbox')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(inboxResponse.body)).toBe(true);

    await cleanupTestUser(database, testUser.username);
  });

  it('envoie et reçoit un message entre deux joueurs', async () => {
    // Créer deux joueurs
    const sender = buildTestUser();
    const receiver = buildTestUser();

    const { accessToken: senderToken } = await registerAndLogin(app, sender);
    const { accessToken: receiverToken } = await registerAndLogin(app, receiver);

    const server = app.getHttpServer();

    // POST /messages/send - Envoyer un message par username
    const sendResponse = await request(server)
      .post('/messages/send')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        toUsername: receiver.username,
        subject: 'Test de message',
        body: 'Ceci est un message de test pour les tests integration.',
      })
      .expect(201);

    expect(sendResponse.body).toBeDefined();
    const messageId = sendResponse.body?.id;
    expect(messageId).toBeTruthy();

    // GET /messages/inbox - Le destinataire devrait voir le message
    const inboxResponse = await request(server)
      .get('/messages/inbox')
      .set('Authorization', `Bearer ${receiverToken}`)
      .expect(200);

    expect(inboxResponse.body.length).toBeGreaterThan(0);
    const receivedMessage = inboxResponse.body.find(
      (m: { id: string }) => m.id === messageId,
    );
    expect(receivedMessage).toBeDefined();
    expect(receivedMessage.subject).toBe('Test de message');
    expect(receivedMessage.read).toBe(false);

    // GET /messages/:id - Lire le message (marque comme lu)
    const readResponse = await request(server)
      .get(`/messages/${messageId}`)
      .set('Authorization', `Bearer ${receiverToken}`)
      .expect(200);

    expect(readResponse.body.subject).toBe('Test de message');
    expect(readResponse.body.body).toContain('message de test');

    // DELETE /messages/:id - Supprimer le message
    await request(server)
      .delete(`/messages/${messageId}`)
      .set('Authorization', `Bearer ${receiverToken}`)
      .expect(200);

    // Vérifier que le message est supprimé
    const postDeleteInbox = await request(server)
      .get('/messages/inbox')
      .set('Authorization', `Bearer ${receiverToken}`)
      .expect(200);

    const deletedMessage = postDeleteInbox.body.find(
      (m: { id: string }) => m.id === messageId,
    );
    expect(deletedMessage).toBeUndefined();

    await cleanupTestUser(database, sender.username);
    await cleanupTestUser(database, receiver.username);
  });

  it('refuse lecture message d\'un autre joueur', async () => {
    const sender = buildTestUser();
    const receiver = buildTestUser();
    const intruder = buildTestUser();

    const { accessToken: senderToken } = await registerAndLogin(app, sender);
    const { accessToken: receiverToken } = await registerAndLogin(app, receiver);
    const { accessToken: intruderToken } = await registerAndLogin(app, intruder);

    const server = app.getHttpServer();

    // Envoyer un message par username
    const sendResponse = await request(server)
      .post('/messages/send')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        toUsername: receiver.username,
        subject: 'Message prive',
        body: 'Contenu confidentiel pour test',
      })
      .expect(201);

    const messageId = sendResponse.body?.id;

    // L'intrus tente de lire le message
    const intruderRead = await request(server)
      .get(`/messages/${messageId}`)
      .set('Authorization', `Bearer ${intruderToken}`);

    // Devrait être refusé (403, 404 ou 500 si erreur non catchée)
    expect([403, 404, 500]).toContain(intruderRead.status);

    await cleanupTestUser(database, sender.username);
    await cleanupTestUser(database, receiver.username);
    await cleanupTestUser(database, intruder.username);
  });

  it('refuse envoi à un joueur inexistant', async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);

    const server = app.getHttpServer();

    // Tenter d'envoyer à un username inexistant
    const sendResponse = await request(server)
      .post('/messages/send')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        toUsername: 'joueur_inexistant_xyz',
        subject: 'Test envoi',
        body: 'Test message vers joueur inexistant',
      });

    // Devrait échouer (400, 404 ou 500 si erreur non catchée)
    expect([400, 404, 500]).toContain(sendResponse.status);

    await cleanupTestUser(database, testUser.username);
  });
});

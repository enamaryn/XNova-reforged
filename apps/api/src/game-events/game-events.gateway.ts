import { Logger, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Gateway WebSocket pour les événements de jeu en temps réel
 *
 * Événements émis par le serveur :
 * - resources:updated - Mise à jour des ressources d'une planète
 * - building:completed - Construction de bâtiment terminée
 * - research:completed - Recherche terminée
 * - fleet:arrived - Flotte arrivée à destination
 */
const webOrigins = (process.env.WEB_ORIGINS || process.env.WEB_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const isProd = process.env.NODE_ENV === 'production';

@WebSocketGateway({
  cors: {
    origin: isProd && webOrigins.length > 0 ? webOrigins : true,
    credentials: true,
  },
  namespace: '/game',
})
export class GameEventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameEventsGateway.name);

  // Map userId -> socketId pour envoyer des événements ciblés
  private userSockets = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      // Récupérer le token depuis le handshake
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: No token provided`);
        client.disconnect();
        return;
      }

      // Vérifier le token JWT
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync(token, { secret });

      if (!payload || !payload.sub) {
        this.logger.warn(`Client ${client.id} rejected: Invalid token`);
        client.disconnect();
        return;
      }

      // Stocker l'userId dans les données du socket
      client.data.userId = payload.sub;
      this.userSockets.set(payload.sub, client.id);

      this.logger.log(`Client ${client.id} connected (User: ${payload.sub})`);

      // Envoyer un événement de confirmation
      client.emit('connected', {
        message: 'Connexion WebSocket établie',
        userId: payload.sub,
      });
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}:`, error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.userSockets.delete(userId);
      this.logger.log(`Client ${client.id} disconnected (User: ${userId})`);
    } else {
      this.logger.log(`Client ${client.id} disconnected`);
    }
  }

  /**
   * Permet au client de s'abonner aux événements d'une planète spécifique
   */
  @SubscribeMessage('subscribe:planet')
  handleSubscribePlanet(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { planetId: string },
  ) {
    const room = `planet:${data.planetId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} joined room ${room}`);
    return { event: 'subscribed', data: { planetId: data.planetId } };
  }

  /**
   * Permet au client de se désabonner des événements d'une planète
   */
  @SubscribeMessage('unsubscribe:planet')
  handleUnsubscribePlanet(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { planetId: string },
  ) {
    const room = `planet:${data.planetId}`;
    client.leave(room);
    this.logger.debug(`Client ${client.id} left room ${room}`);
    return { event: 'unsubscribed', data: { planetId: data.planetId } };
  }

  /**
   * Émet une mise à jour de ressources pour une planète spécifique
   */
  emitResourcesUpdate(planetId: string, data: any) {
    const room = `planet:${planetId}`;
    this.server.to(room).emit('resources:updated', {
      planetId,
      timestamp: new Date().toISOString(),
      ...data,
    });
    this.logger.debug(`Emitted resources:updated to room ${room}`);
  }

  /**
   * Émet un événement de construction terminée
   */
  emitBuildingCompleted(planetId: string, data: any) {
    const room = `planet:${planetId}`;
    this.server.to(room).emit('building:completed', {
      planetId,
      timestamp: new Date().toISOString(),
      ...data,
    });
    this.logger.debug(`Emitted building:completed to room ${room}`);
  }

  /**
   * Émet un événement de recherche terminée
   */
  emitResearchCompleted(userId: string, data: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('research:completed', {
        timestamp: new Date().toISOString(),
        ...data,
      });
      this.logger.debug(`Emitted research:completed to user ${userId}`);
    }
  }

  /**
   * Émet un événement de flotte arrivée
   */
  emitFleetArrived(userId: string, data: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('fleet:arrived', {
        timestamp: new Date().toISOString(),
        ...data,
      });
      this.logger.debug(`Emitted fleet:arrived to user ${userId}`);
    }
  }

  /**
   * Émet un événement générique à un utilisateur
   */
  emitToUser(userId: string, event: string, data: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(event, {
        timestamp: new Date().toISOString(),
        ...data,
      });
      this.logger.debug(`Emitted ${event} to user ${userId}`);
    }
  }

  /**
   * Broadcast un événement à tous les clients connectés
   */
  broadcast(event: string, data: any) {
    this.server.emit(event, {
      timestamp: new Date().toISOString(),
      ...data,
    });
    this.logger.debug(`Broadcasted ${event} to all clients`);
  }

  /**
   * Émet un événement générique à une planète (room)
   */
  emitToPlanet(planetId: string, event: string, data: any) {
    const room = `planet:${planetId}`;
    this.server.to(room).emit(event, {
      planetId,
      timestamp: new Date().toISOString(),
      ...data,
    });
    this.logger.debug(`Emitted ${event} to room ${room}`);
  }
}

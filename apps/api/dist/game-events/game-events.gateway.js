"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var GameEventsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEventsGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
let GameEventsGateway = GameEventsGateway_1 = class GameEventsGateway {
    constructor(jwtService, configService) {
        this.jwtService = jwtService;
        this.configService = configService;
        this.logger = new common_1.Logger(GameEventsGateway_1.name);
        this.userSockets = new Map();
    }
    afterInit(server) {
        this.logger.log('WebSocket Gateway initialized');
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                this.logger.warn(`Client ${client.id} rejected: No token provided`);
                client.disconnect();
                return;
            }
            const secret = this.configService.get('JWT_SECRET');
            const payload = await this.jwtService.verifyAsync(token, { secret });
            if (!payload || !payload.sub) {
                this.logger.warn(`Client ${client.id} rejected: Invalid token`);
                client.disconnect();
                return;
            }
            client.data.userId = payload.sub;
            this.userSockets.set(payload.sub, client.id);
            this.logger.log(`Client ${client.id} connected (User: ${payload.sub})`);
            client.emit('connected', {
                message: 'Connexion WebSocket établie',
                userId: payload.sub,
            });
        }
        catch (error) {
            this.logger.error(`Connection error for client ${client.id}:`, error.message);
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        const userId = client.data.userId;
        if (userId) {
            this.userSockets.delete(userId);
            this.logger.log(`Client ${client.id} disconnected (User: ${userId})`);
        }
        else {
            this.logger.log(`Client ${client.id} disconnected`);
        }
    }
    handleSubscribePlanet(client, data) {
        const room = `planet:${data.planetId}`;
        client.join(room);
        this.logger.debug(`Client ${client.id} joined room ${room}`);
        return { event: 'subscribed', data: { planetId: data.planetId } };
    }
    handleUnsubscribePlanet(client, data) {
        const room = `planet:${data.planetId}`;
        client.leave(room);
        this.logger.debug(`Client ${client.id} left room ${room}`);
        return { event: 'unsubscribed', data: { planetId: data.planetId } };
    }
    emitResourcesUpdate(planetId, data) {
        const room = `planet:${planetId}`;
        this.server.to(room).emit('resources:updated', {
            planetId,
            timestamp: new Date().toISOString(),
            ...data,
        });
        this.logger.debug(`Emitted resources:updated to room ${room}`);
    }
    emitBuildingCompleted(planetId, data) {
        const room = `planet:${planetId}`;
        this.server.to(room).emit('building:completed', {
            planetId,
            timestamp: new Date().toISOString(),
            ...data,
        });
        this.logger.debug(`Emitted building:completed to room ${room}`);
    }
    emitResearchCompleted(userId, data) {
        const socketId = this.userSockets.get(userId);
        if (socketId) {
            this.server.to(socketId).emit('research:completed', {
                timestamp: new Date().toISOString(),
                ...data,
            });
            this.logger.debug(`Emitted research:completed to user ${userId}`);
        }
    }
    emitFleetArrived(userId, data) {
        const socketId = this.userSockets.get(userId);
        if (socketId) {
            this.server.to(socketId).emit('fleet:arrived', {
                timestamp: new Date().toISOString(),
                ...data,
            });
            this.logger.debug(`Emitted fleet:arrived to user ${userId}`);
        }
    }
    emitToUser(userId, event, data) {
        const socketId = this.userSockets.get(userId);
        if (socketId) {
            this.server.to(socketId).emit(event, {
                timestamp: new Date().toISOString(),
                ...data,
            });
            this.logger.debug(`Emitted ${event} to user ${userId}`);
        }
    }
    broadcast(event, data) {
        this.server.emit(event, {
            timestamp: new Date().toISOString(),
            ...data,
        });
        this.logger.debug(`Broadcasted ${event} to all clients`);
    }
    emitToPlanet(planetId, event, data) {
        const room = `planet:${planetId}`;
        this.server.to(room).emit(event, {
            planetId,
            timestamp: new Date().toISOString(),
            ...data,
        });
        this.logger.debug(`Emitted ${event} to room ${room}`);
    }
};
exports.GameEventsGateway = GameEventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], GameEventsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('subscribe:planet'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameEventsGateway.prototype, "handleSubscribePlanet", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('unsubscribe:planet'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameEventsGateway.prototype, "handleUnsubscribePlanet", null);
exports.GameEventsGateway = GameEventsGateway = GameEventsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
            credentials: true,
        },
        namespace: '/game',
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], GameEventsGateway);
//# sourceMappingURL=game-events.gateway.js.map
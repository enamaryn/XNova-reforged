import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
export declare class GameEventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly jwtService;
    private readonly configService;
    server: Server;
    private readonly logger;
    private userSockets;
    constructor(jwtService: JwtService, configService: ConfigService);
    afterInit(server: Server): void;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    handleSubscribePlanet(client: Socket, data: {
        planetId: string;
    }): {
        event: string;
        data: {
            planetId: string;
        };
    };
    handleUnsubscribePlanet(client: Socket, data: {
        planetId: string;
    }): {
        event: string;
        data: {
            planetId: string;
        };
    };
    emitResourcesUpdate(planetId: string, data: any): void;
    emitBuildingCompleted(planetId: string, data: any): void;
    emitResearchCompleted(userId: string, data: any): void;
    emitFleetArrived(userId: string, data: any): void;
    emitToUser(userId: string, event: string, data: any): void;
    broadcast(event: string, data: any): void;
    emitToPlanet(planetId: string, event: string, data: any): void;
}

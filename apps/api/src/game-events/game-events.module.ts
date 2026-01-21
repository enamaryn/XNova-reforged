import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GameEventsGateway } from './game-events.gateway';

@Module({
  imports: [
    // JWT pour l'authentification WebSocket
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
        },
      } as any),
    }),
  ],
  providers: [GameEventsGateway],
  exports: [GameEventsGateway], // Exporter pour utilisation dans d'autres modules
})
export class GameEventsModule {}

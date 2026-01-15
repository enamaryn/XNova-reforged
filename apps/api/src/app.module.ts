import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { ResourcesModule } from './resources/resources.module';
import { GameEventsModule } from './game-events/game-events.module';

@Module({
  imports: [
    // Configuration des variables d'environnement
    ConfigModule.forRoot({
      isGlobal: true, // Rend le ConfigService disponible partout
      envFilePath: '../../.env', // Chemin vers le .env à la racine du monorepo
    }),

    // Module de planification des tâches (cron jobs)
    ScheduleModule.forRoot(),

    // Module de base de données
    DatabaseModule,

    // Module d'authentification
    AuthModule,

    // Module ressources
    ResourcesModule,

    // Module événements WebSocket
    GameEventsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

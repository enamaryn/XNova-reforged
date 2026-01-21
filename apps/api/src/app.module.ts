import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { ResourcesModule } from './resources/resources.module';
import { GameEventsModule } from './game-events/game-events.module';
import { BuildingsModule } from './buildings/buildings.module';
import { CombatModule } from './combat/combat.module';
import { FleetModule } from './fleet/fleet.module';
import { GalaxyModule } from './galaxy/galaxy.module';
import { ResearchModule } from './research/research.module';
import { ShipyardModule } from './shipyard/shipyard.module';
import { SocialModule } from './social/social.module';
import { StatisticsModule } from './statistics/statistics.module';
import { AdminModule } from './admin/admin.module';
import { ServerConfigModule } from './server-config/server-config.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { MonitoringModule } from './monitoring/monitoring.module';

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

    // Module Redis (cache)
    RedisModule,

    // Module de vérification de santé
    HealthModule,

    // Module monitoring
    MonitoringModule,

    // Module d'authentification
    AuthModule,

    // Module ressources
    ResourcesModule,

    // Module événements WebSocket
    GameEventsModule,

    // Module batiments
    BuildingsModule,

    // Module combat
    CombatModule,

    // Module flotte
    FleetModule,

    // Module galaxie
    GalaxyModule,

    // Module recherche
    ResearchModule,

    // Module chantier spatial
    ShipyardModule,

    // Module social (messages + alliances)
    SocialModule,

    // Module statistiques
    StatisticsModule,

    // Module configuration serveur (partagé)
    ServerConfigModule,

    // Module administration
    AdminModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

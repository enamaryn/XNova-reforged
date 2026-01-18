"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const auth_module_1 = require("./auth/auth.module");
const database_module_1 = require("./database/database.module");
const resources_module_1 = require("./resources/resources.module");
const game_events_module_1 = require("./game-events/game-events.module");
const buildings_module_1 = require("./buildings/buildings.module");
const combat_module_1 = require("./combat/combat.module");
const fleet_module_1 = require("./fleet/fleet.module");
const galaxy_module_1 = require("./galaxy/galaxy.module");
const research_module_1 = require("./research/research.module");
const shipyard_module_1 = require("./shipyard/shipyard.module");
const social_module_1 = require("./social/social.module");
const statistics_module_1 = require("./statistics/statistics.module");
const admin_module_1 = require("./admin/admin.module");
const server_config_module_1 = require("./server-config/server-config.module");
const redis_module_1 = require("./redis/redis.module");
const core_1 = require("@nestjs/core");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '../../.env',
            }),
            schedule_1.ScheduleModule.forRoot(),
            database_module_1.DatabaseModule,
            redis_module_1.RedisModule,
            auth_module_1.AuthModule,
            resources_module_1.ResourcesModule,
            game_events_module_1.GameEventsModule,
            buildings_module_1.BuildingsModule,
            combat_module_1.CombatModule,
            fleet_module_1.FleetModule,
            galaxy_module_1.GalaxyModule,
            research_module_1.ResearchModule,
            shipyard_module_1.ShipyardModule,
            social_module_1.SocialModule,
            statistics_module_1.StatisticsModule,
            server_config_module_1.ServerConfigModule,
            admin_module_1.AdminModule,
        ],
        controllers: [],
        providers: [core_1.Reflector],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
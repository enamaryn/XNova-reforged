"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourcesModule = void 0;
const common_1 = require("@nestjs/common");
const resources_controller_1 = require("./resources.controller");
const resources_service_1 = require("./resources.service");
const resources_cron_service_1 = require("./resources-cron.service");
const game_events_module_1 = require("../game-events/game-events.module");
const server_config_module_1 = require("../server-config/server-config.module");
let ResourcesModule = class ResourcesModule {
};
exports.ResourcesModule = ResourcesModule;
exports.ResourcesModule = ResourcesModule = __decorate([
    (0, common_1.Module)({
        imports: [game_events_module_1.GameEventsModule, server_config_module_1.ServerConfigModule],
        controllers: [resources_controller_1.ResourcesController],
        providers: [resources_service_1.ResourcesService, resources_cron_service_1.ResourcesCronService],
        exports: [resources_service_1.ResourcesService],
    })
], ResourcesModule);
//# sourceMappingURL=resources.module.js.map
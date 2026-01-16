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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourcesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const resources_service_1 = require("./resources.service");
const colonize_planet_dto_1 = require("./dto/colonize-planet.dto");
const rename_planet_dto_1 = require("./dto/rename-planet.dto");
let ResourcesController = class ResourcesController {
    constructor(resourcesService) {
        this.resourcesService = resourcesService;
    }
    getPlanet(planetId, userId) {
        return this.resourcesService.getPlanet(planetId, userId);
    }
    getPlanetResources(planetId, userId) {
        return this.resourcesService.getPlanetResources(planetId, userId);
    }
    scanPlanet(planetId) {
        return this.resourcesService.scanPlanet(planetId);
    }
    colonizePlanet(dto, userId) {
        return this.resourcesService.colonizePlanet({
            userId,
            originPlanetId: dto.originPlanetId,
            galaxy: dto.galaxy,
            system: dto.system,
            position: dto.position,
            name: dto.name,
        });
    }
    renamePlanet(planetId, dto, userId) {
        return this.resourcesService.renamePlanet(planetId, userId, dto.name);
    }
};
exports.ResourcesController = ResourcesController;
__decorate([
    (0, common_1.Get)(':planetId'),
    __param(0, (0, common_1.Param)('planetId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "getPlanet", null);
__decorate([
    (0, common_1.Get)(':planetId/resources'),
    __param(0, (0, common_1.Param)('planetId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "getPlanetResources", null);
__decorate([
    (0, common_1.Get)('scan/:planetId'),
    __param(0, (0, common_1.Param)('planetId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "scanPlanet", null);
__decorate([
    (0, common_1.Post)('colonize'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [colonize_planet_dto_1.ColonizePlanetDto, String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "colonizePlanet", null);
__decorate([
    (0, common_1.Put)(':planetId'),
    __param(0, (0, common_1.Param)('planetId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, rename_planet_dto_1.RenamePlanetDto, String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "renamePlanet", null);
exports.ResourcesController = ResourcesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('planets'),
    __metadata("design:paramtypes", [resources_service_1.ResourcesService])
], ResourcesController);
//# sourceMappingURL=resources.controller.js.map
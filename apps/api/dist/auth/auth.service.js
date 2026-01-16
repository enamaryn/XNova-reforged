"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const argon2 = __importStar(require("argon2"));
const database_service_1 = require("../database/database.service");
const server_config_service_1 = require("../server-config/server-config.service");
let AuthService = class AuthService {
    constructor(database, jwtService, configService, serverConfig) {
        this.database = database;
        this.jwtService = jwtService;
        this.configService = configService;
        this.serverConfig = serverConfig;
    }
    async register(registerDto) {
        const { username, email, password } = registerDto;
        const existingUsername = await this.database.user.findUnique({
            where: { username },
        });
        if (existingUsername) {
            throw new common_1.ConflictException('Ce nom d\'utilisateur est déjà pris');
        }
        const existingEmail = await this.database.user.findUnique({
            where: { email },
        });
        if (existingEmail) {
            throw new common_1.ConflictException('Cet email est déjà utilisé');
        }
        const hashedPassword = await argon2.hash(password);
        const user = await this.database.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                points: 0,
                rank: 0,
            },
        });
        await this.createStarterPlanet(user.id);
        const tokens = await this.generateTokens(user.id, user.username);
        return {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                points: user.points,
                rank: user.rank,
                role: user.role,
                createdAt: user.createdAt,
            },
            tokens,
        };
    }
    async login(loginDto) {
        const { identifier, password } = loginDto;
        const user = await this.database.user.findFirst({
            where: {
                OR: [
                    { username: identifier },
                    { email: identifier },
                ],
            },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Identifiants incorrects');
        }
        const isPasswordValid = await argon2.verify(user.password, password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Identifiants incorrects');
        }
        await this.database.user.update({
            where: { id: user.id },
            data: { lastActive: new Date() },
        });
        const tokens = await this.generateTokens(user.id, user.username);
        return {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                points: user.points,
                rank: user.rank,
                role: user.role,
                createdAt: user.createdAt,
            },
            tokens,
        };
    }
    async refreshAccessToken(refreshToken) {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
            });
            const user = await this.database.user.findUnique({
                where: { id: payload.sub },
            });
            if (!user) {
                throw new common_1.UnauthorizedException('Utilisateur non trouvé');
            }
            const accessToken = this.jwtService.sign({
                sub: user.id,
                username: user.username,
            }, {
                secret: this.configService.get('JWT_SECRET'),
                expiresIn: this.configService.get('JWT_EXPIRES_IN'),
            });
            return { accessToken };
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Refresh token invalide ou expiré');
        }
    }
    async getMe(userId) {
        const user = await this.database.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                points: true,
                rank: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                planets: {
                    select: {
                        id: true,
                        name: true,
                        galaxy: true,
                        system: true,
                        position: true,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
            },
        });
        if (!user) {
            throw new common_1.NotFoundException('Utilisateur non trouvé');
        }
        return user;
    }
    async generateTokens(userId, username) {
        const payload = { sub: userId, username };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get('JWT_SECRET'),
                expiresIn: this.configService.get('JWT_EXPIRES_IN'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
                expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
            }),
        ]);
        return {
            accessToken,
            refreshToken,
        };
    }
    async createStarterPlanet(userId) {
        const galaxy = Math.floor(Math.random() * 9) + 1;
        const system = Math.floor(Math.random() * 499) + 1;
        const position = Math.floor(Math.random() * 15) + 1;
        const existingPlanet = await this.database.planet.findUnique({
            where: {
                galaxy_system_position: {
                    galaxy,
                    system,
                    position,
                },
            },
        });
        if (existingPlanet) {
            return this.createStarterPlanet(userId);
        }
        const config = await this.serverConfig.getConfig();
        await this.database.planet.create({
            data: {
                userId,
                name: 'Planète Mère',
                galaxy,
                system,
                position,
                planetType: 'normal',
                metal: 500,
                crystal: 500,
                deuterium: 0,
                fieldsMax: config.planetSize,
                fieldsUsed: 0,
            },
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        jwt_1.JwtService,
        config_1.ConfigService,
        server_config_service_1.ServerConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map
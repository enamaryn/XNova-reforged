import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { ServerConfigService } from '../server-config/server-config.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
export declare class AuthService {
    private readonly database;
    private readonly jwtService;
    private readonly configService;
    private readonly serverConfig;
    constructor(database: DatabaseService, jwtService: JwtService, configService: ConfigService, serverConfig: ServerConfigService);
    register(registerDto: RegisterDto): Promise<AuthResponseDto>;
    login(loginDto: LoginDto): Promise<AuthResponseDto>;
    refreshAccessToken(refreshToken: string): Promise<{
        accessToken: string;
    }>;
    getMe(userId: string): Promise<{
        role: import(".prisma/client").$Enums.UserRole;
        username: string;
        rank: number;
        id: string;
        createdAt: Date;
        email: string;
        updatedAt: Date;
        points: number;
        planets: {
            name: string;
            id: string;
            galaxy: number;
            system: number;
            position: number;
        }[];
    }>;
    private generateTokens;
    private createStarterPlanet;
}

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
export declare class AuthService {
    private readonly database;
    private readonly jwtService;
    private readonly configService;
    constructor(database: DatabaseService, jwtService: JwtService, configService: ConfigService);
    register(registerDto: RegisterDto): Promise<AuthResponseDto>;
    login(loginDto: LoginDto): Promise<AuthResponseDto>;
    refreshAccessToken(refreshToken: string): Promise<{
        accessToken: string;
    }>;
    getMe(userId: string): Promise<{
        id: string;
        createdAt: Date;
        username: string;
        email: string;
        updatedAt: Date;
        points: number;
        rank: number;
        planets: {
            id: string;
            name: string;
            galaxy: number;
            system: number;
            position: number;
        }[];
    }>;
    private generateTokens;
    private createStarterPlanet;
}

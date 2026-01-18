import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto): Promise<import("./dto/auth-response.dto").AuthResponseDto>;
    login(loginDto: LoginDto): Promise<import("./dto/auth-response.dto").AuthResponseDto>;
    refreshToken(refreshTokenDto: RefreshTokenDto): Promise<{
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
    logout(): Promise<{
        message: string;
    }>;
}

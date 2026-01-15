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
    logout(): Promise<{
        message: string;
    }>;
}

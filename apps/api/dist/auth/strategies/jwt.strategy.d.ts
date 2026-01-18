import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import { DatabaseService } from '../../database/database.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly configService;
    private readonly database;
    constructor(configService: ConfigService, database: DatabaseService);
    validate(payload: {
        sub: string;
        username: string;
    }): Promise<{
        role: import(".prisma/client").$Enums.UserRole;
        username: string;
        rank: number;
        id: string;
        email: string;
        points: number;
    }>;
}
export {};

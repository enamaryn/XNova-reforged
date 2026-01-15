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
        id: string;
        username: string;
        email: string;
        points: number;
        rank: number;
    }>;
}
export {};

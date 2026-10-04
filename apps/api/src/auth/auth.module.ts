import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccountService } from './account.service';
import { MailModule } from '../mail/mail.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { DatabaseModule } from '../database/database.module';
import { GameEventsModule } from '../game-events/game-events.module';
import { ServerConfigModule } from '../server-config/server-config.module';

@Module({
  imports: [
    DatabaseModule,
    ServerConfigModule,
    GameEventsModule,
    MailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
        },
      } as any),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AccountService, JwtStrategy],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}

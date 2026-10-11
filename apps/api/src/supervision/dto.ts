import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LOCAL_LIMITS, SENTRY_SAMPLE_RATE_MAX } from './supervision-config.service';

export class LocalSettingsDto {
  @IsOptional() @Type(() => Number) @IsInt({ message: 'La durée de conservation doit être un entier' })
  @Min(LOCAL_LIMITS.retentionDays.min, { message: 'Durée de conservation : 1 jour minimum' })
  @Max(LOCAL_LIMITS.retentionDays.max, { message: 'Durée de conservation : 365 jours maximum' })
  retentionDays?: number;

  @IsOptional() @Type(() => Number) @IsInt({ message: 'Le nombre maximal d’incidents doit être un entier' })
  @Min(LOCAL_LIMITS.maxIncidents.min, { message: 'Nombre maximal d’incidents : 100 minimum' })
  @Max(LOCAL_LIMITS.maxIncidents.max, { message: 'Nombre maximal d’incidents : 50 000 maximum' })
  maxIncidents?: number;

  @IsOptional() @IsIn(['error', 'fatal'], { message: 'Niveau minimal invalide' })
  minLevel?: 'error' | 'fatal';

  @IsOptional() @IsBoolean() warningsEnabled?: boolean;
  @IsOptional() @IsBoolean() autoPurge?: boolean;
}

export class SentrySettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;

  @IsOptional() @IsString() @MaxLength(300, { message: 'DSN trop long' }) dsnApi?: string;
  @IsOptional() @IsString() @MaxLength(300, { message: 'DSN trop long' }) dsnBrowser?: string;
  @IsOptional() @IsBoolean() clearDsnApi?: boolean;
  @IsOptional() @IsBoolean() clearDsnBrowser?: boolean;

  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9._-]{1,40}$/, { message: 'Nom d’environnement invalide' })
  environment?: string;

  @IsOptional() @Type(() => Number) @IsNumber({}, { message: 'Le taux d’échantillonnage doit être un nombre' })
  @Min(0, { message: 'Taux d’échantillonnage : 0 minimum' })
  @Max(SENTRY_SAMPLE_RATE_MAX, { message: 'Taux d’échantillonnage : 0,5 maximum (limité volontairement)' })
  sampleRate?: number;
}

export class UpdateSupervisionDto {
  @IsOptional() @ValidateNested() @Type(() => LocalSettingsDto) local?: LocalSettingsDto;
  @IsOptional() @ValidateNested() @Type(() => SentrySettingsDto) sentry?: SentrySettingsDto;
}

export class SentryTestDto {
  /** DSN à tester avant enregistrement ; absent : le DSN enregistré ou issu de l'environnement. */
  @IsOptional() @IsString() @MaxLength(300) dsnApi?: string;
}

export class IncidentStatusDto {
  @IsIn(['new', 'seen', 'resolved', 'ignored'], { message: 'Statut invalide' })
  status: 'new' | 'seen' | 'resolved' | 'ignored';
}

export class PurgeDto {
  /** Confirmation explicite obligatoire. */
  @IsBoolean() confirm: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650) olderThanDays?: number;
  @IsOptional() @IsBoolean() onlyClosed?: boolean;
}

export class ClientErrorDto {
  @IsString() @MinLength(1) @MaxLength(500) message: string;
  @IsOptional() @IsString() @MaxLength(80) type?: string;
  @IsOptional() @IsString() @MaxLength(4000) stack?: string;
  @IsOptional() @IsString() @MaxLength(200) route?: string;
  @IsIn(['react', 'window', 'promise', 'network']) kind: 'react' | 'window' | 'promise' | 'network';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) count?: number;
}

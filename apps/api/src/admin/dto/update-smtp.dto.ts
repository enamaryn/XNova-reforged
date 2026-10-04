import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateSmtpDto {
  @IsOptional()
  @IsBoolean({ message: "L'activation doit être un booléen" })
  enabled?: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(253, { message: "Le nom d'hôte est trop long" })
  @Matches(/^$|^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/, { message: "Nom d'hôte invalide" })
  host?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Le port doit être un entier' })
  @Min(1, { message: 'Le port est invalide' })
  @Max(65535, { message: 'Le port est invalide' })
  port?: number;

  @IsOptional()
  @IsBoolean({ message: 'Le mode TLS doit être un booléen' })
  secure?: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  username?: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: "L'adresse d'expédition est invalide" })
  @MaxLength(254)
  fromEmail?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  @Matches(/^[^\r\n]*$/, { message: "Le nom d'expéditeur est invalide" })
  fromName?: string;

  /** Absent : le mot de passe enregistré est conservé. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  password?: string;

  @IsOptional()
  @IsBoolean()
  clearPassword?: boolean;
}

export class SendSmtpTestDto {
  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: 'Adresse de destination invalide' })
  to?: string;
}

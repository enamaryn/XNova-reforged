import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class BanUserDto {
  @IsString({ message: 'Le nom doit etre une chaine de caracteres' })
  @MaxLength(20, { message: 'Le nom ne peut pas depasser 20 caracteres' })
  username: string;

  @IsOptional()
  @IsString({ message: 'La raison doit etre une chaine de caracteres' })
  @MaxLength(2000, { message: 'La raison ne peut pas depasser 2000 caracteres' })
  reason?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Les jours doivent etre un entier' })
  @Min(0)
  @Max(365)
  days?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Les heures doivent etre un entier' })
  @Min(0)
  @Max(240)
  hours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Les minutes doivent etre un entier' })
  @Min(0)
  @Max(600)
  minutes?: number;
}

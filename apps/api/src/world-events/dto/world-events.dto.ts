import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import {
  WORLD_EVENT_MAX_DAYS,
  WORLD_EVENT_MAX_NAME_LENGTH,
  WORLD_EVENT_MAX_PRODUCTION_BONUS,
  WORLD_EVENT_MAX_TAX_REDUCTION,
} from '@xnova/game-config';

export class LaunchTemplateEventDto {
  @IsString()
  templateId!: string;

  /** Durée en jours ; par défaut, la longueur de la fenêtre du modèle. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(WORLD_EVENT_MAX_DAYS)
  days?: number;
}

export class LaunchCustomEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(WORLD_EVENT_MAX_NAME_LENGTH)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(WORLD_EVENT_MAX_DAYS)
  days!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(WORLD_EVENT_MAX_PRODUCTION_BONUS)
  productionBonus?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(WORLD_EVENT_MAX_TAX_REDUCTION)
  marketTaxReduction?: number;
}

export class SetAutoDto {
  @IsBoolean()
  auto!: boolean;
}

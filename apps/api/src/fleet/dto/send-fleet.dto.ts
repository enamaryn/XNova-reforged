import { IMPLEMENTED_MISSIONS } from '@xnova/game-config';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** Borne haute d'une quantité (vaisseaux, ressources) : exclut les valeurs absurdes ou imprécises. */
export const MAX_QUANTITY = 1_000_000_000_000;

export class FleetCargoDto {
  @IsOptional()
  @IsInt({ message: 'Le metal doit etre un entier' })
  @Min(0)
  @Max(MAX_QUANTITY)
  metal?: number;

  @IsOptional()
  @IsInt({ message: 'Le cristal doit etre un entier' })
  @Min(0)
  @Max(MAX_QUANTITY)
  crystal?: number;

  @IsOptional()
  @IsInt({ message: 'Le deuterium doit etre un entier' })
  @Min(0)
  @Max(MAX_QUANTITY)
  deuterium?: number;
}

export class SendFleetDto {
  @IsString()
  planetId: string;

  @IsInt()
  @Min(1)
  @Max(9) // GAME_CONSTANTS.MAX_GALAXIES
  toGalaxy: number;

  @IsInt()
  @Min(1)
  @Max(499) // GAME_CONSTANTS.MAX_SYSTEMS
  toSystem: number;

  @IsInt()
  @Min(1)
  @Max(15) // GAME_CONSTANTS.MAX_POSITIONS
  toPosition: number;

  @IsIn([...IMPLEMENTED_MISSIONS], { message: 'Mission non disponible' })
  mission: number;

  @IsInt()
  @Min(10)
  @Max(100)
  speedPercent: number;

  // Contenu validé finement dans FleetService (identifiants connus, entiers positifs)
  @IsObject()
  ships: Record<string, number>;

  @IsOptional()
  @ValidateNested()
  @Type(() => FleetCargoDto)
  cargo?: FleetCargoDto;
}

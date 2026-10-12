import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class LaunchMissilesDto {
  @IsString()
  planetId: string;

  @IsInt()
  @Min(1)
  @Max(9)
  toGalaxy: number;

  @IsInt()
  @Min(1)
  @Max(499)
  toSystem: number;

  @IsInt()
  @Min(1)
  @Max(15)
  toPosition: number;

  @IsInt()
  @Min(1)
  @Max(10000)
  amount: number;

  /** Défense visée en priorité (401 à 408) ; sinon l'ordre par défaut. */
  @IsOptional()
  @IsInt()
  @Min(401)
  @Max(408)
  primaryTarget?: number;
}

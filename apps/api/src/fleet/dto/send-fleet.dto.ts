import { IsInt, IsObject, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class SendFleetDto {
  @IsString()
  planetId: string;

  @IsInt()
  @IsPositive()
  toGalaxy: number;

  @IsInt()
  @IsPositive()
  toSystem: number;

  @IsInt()
  @IsPositive()
  toPosition: number;

  @IsInt()
  @IsPositive()
  mission: number;

  @IsInt()
  @Min(10)
  @Max(100)
  speedPercent: number;

  @IsObject()
  ships: Record<string, number>;

  @IsOptional()
  @IsObject()
  cargo?: {
    metal?: number;
    crystal?: number;
    deuterium?: number;
  };
}

import { IsInt, IsPositive, IsString, Max, Min } from 'class-validator';
import { GAME_CONSTANTS } from '@xnova/game-config';

export class ColonizePlanetDto {
  @IsString()
  originPlanetId: string;

  @IsInt()
  @Min(1)
  @Max(GAME_CONSTANTS.MAX_GALAXIES)
  galaxy: number;

  @IsInt()
  @Min(1)
  @Max(GAME_CONSTANTS.MAX_SYSTEMS)
  system: number;

  @IsInt()
  @Min(1)
  @Max(GAME_CONSTANTS.MAX_POSITIONS)
  position: number;

  @IsString()
  name: string;
}

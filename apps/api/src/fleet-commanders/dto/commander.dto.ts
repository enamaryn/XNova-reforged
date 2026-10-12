import { IsString, MaxLength, MinLength } from 'class-validator';
import { COMMANDER_NAME_MAX_LENGTH } from '@xnova/game-config';

export class RecruitCommanderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(COMMANDER_NAME_MAX_LENGTH)
  name!: string;

  @IsString()
  planetId!: string;
}

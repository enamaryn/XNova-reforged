import { IsString } from 'class-validator';

export class ClaimQuestDto {
  @IsString()
  planetId!: string;
}

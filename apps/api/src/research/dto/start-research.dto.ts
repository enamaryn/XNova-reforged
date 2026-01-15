import { IsInt, IsPositive, IsString } from 'class-validator';

export class StartResearchDto {
  @IsString()
  planetId: string;

  @IsInt()
  @IsPositive()
  techId: number;
}

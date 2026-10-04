import { IsInt, IsPositive, IsString, Max } from 'class-validator';

export class BuildDefenseDto {
  @IsString()
  planetId: string;

  @IsInt()
  @IsPositive()
  defenseId: number;

  @IsInt()
  @IsPositive()
  @Max(1_000_000)
  amount: number;
}

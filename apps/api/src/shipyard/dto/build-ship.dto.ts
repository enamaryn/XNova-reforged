import { IsInt, IsPositive, IsString } from 'class-validator';

export class BuildShipDto {
  @IsString()
  planetId: string;

  @IsInt()
  @IsPositive()
  shipId: number;

  @IsInt()
  @IsPositive()
  amount: number;
}

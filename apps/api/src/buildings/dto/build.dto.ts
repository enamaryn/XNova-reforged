import { IsInt, IsPositive } from 'class-validator';

export class StartBuildDto {
  @IsInt()
  @IsPositive()
  buildingId: number;
}

import { IsString } from 'class-validator';

export class HireOfficerDto {
  @IsString()
  planetId!: string;
}

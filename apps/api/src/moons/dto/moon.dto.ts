import { IsInt, IsObject, IsString, Max, Min } from 'class-validator';

export class PhalanxScanDto {
  @IsInt()
  @Min(1)
  @Max(9)
  galaxy: number;

  @IsInt()
  @Min(1)
  @Max(499)
  system: number;

  @IsInt()
  @Min(1)
  @Max(15)
  position: number;
}

export class JumpDto {
  @IsString()
  toMoonId: string;

  // Contenu validé finement dans MoonsService (identifiants connus, entiers positifs)
  @IsObject()
  ships: Record<string, number>;
}

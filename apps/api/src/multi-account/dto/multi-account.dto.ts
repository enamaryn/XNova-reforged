import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ExemptionDto {
  @IsUUID()
  userA!: string;

  @IsUUID()
  userB!: string;

  /** Motif de l'exemption (foyer, école…), conservé dans le journal d'audit. */
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason!: string;
}

export class RemoveExemptionDto {
  @IsUUID()
  userA!: string;

  @IsUUID()
  userB!: string;
}

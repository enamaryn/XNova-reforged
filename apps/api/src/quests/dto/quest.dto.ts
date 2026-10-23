import { IsOptional, IsString, Matches } from 'class-validator';

export class ClaimQuestDto {
  @IsString()
  planetId!: string;

  /** Période de la quête à réclamer (« 2026-10-13 » ou « 2026-W42 ») ; par défaut, la période en cours. */
  @IsOptional()
  @IsString()
  @Matches(/^(\d{4}-\d{2}-\d{2}|\d{4}-W\d{2})$/, { message: 'Periode invalide' })
  periodKey?: string;
}

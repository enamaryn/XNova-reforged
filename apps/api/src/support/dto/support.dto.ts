import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SUPPORT_KINDS, SUPPORT_LIMITS, SUPPORT_STATUSES } from '@xnova/game-config';

export class CreateSupportReportDto {
  @IsIn(SUPPORT_KINDS as unknown as string[])
  kind!: (typeof SUPPORT_KINDS)[number];

  @IsString()
  @MinLength(SUPPORT_LIMITS.subjectMin, { message: 'Le sujet est trop court' })
  @MaxLength(SUPPORT_LIMITS.subjectMax, { message: 'Le sujet est trop long' })
  subject!: string;

  @IsString()
  @MinLength(SUPPORT_LIMITS.bodyMin, { message: 'Décrivez le problème en quelques mots de plus' })
  @MaxLength(SUPPORT_LIMITS.bodyMax, { message: 'Le message est trop long' })
  body!: string;

  /** Page ouverte au moment du signalement (jointe automatiquement par l'interface). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pagePath?: string;

  /** Version du jeu affichée en pied de page. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  appVersion?: string;
}

export class UpdateSupportStatusDto {
  @IsIn(SUPPORT_STATUSES as unknown as string[])
  status!: (typeof SUPPORT_STATUSES)[number];
}

export class CreateSupportReplyDto {
  @IsString()
  @MinLength(SUPPORT_LIMITS.replyMin, { message: 'La réponse est vide' })
  @MaxLength(SUPPORT_LIMITS.replyMax, { message: 'La réponse est trop longue' })
  body!: string;
}

import { Transform } from 'class-transformer';
import { IsEmail, IsIn } from 'class-validator';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@xnova/game-config';

export class SetupSmtpTestDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Adresse de destination invalide' })
  to: string;
}

export class SetupLanguageDto {
  @IsIn([...SUPPORTED_LOCALES], { message: 'Langue non prise en charge' })
  language: SupportedLocale;
}

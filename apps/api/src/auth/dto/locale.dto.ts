import { IsIn } from 'class-validator';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@xnova/game-config';

export class SetLocaleDto {
  @IsIn([...SUPPORTED_LOCALES], { message: 'Langue non prise en charge' })
  locale: SupportedLocale;
}

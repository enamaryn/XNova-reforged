import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString({ message: 'Le destinataire doit etre une chaine de caracteres' })
  @MinLength(3, { message: 'Le destinataire doit contenir au moins 3 caracteres' })
  @MaxLength(20, { message: 'Le destinataire ne peut pas depasser 20 caracteres' })
  toUsername: string;

  @IsString({ message: 'Le sujet doit etre une chaine de caracteres' })
  @MinLength(3, { message: 'Le sujet doit contenir au moins 3 caracteres' })
  @MaxLength(100, { message: 'Le sujet ne peut pas depasser 100 caracteres' })
  subject: string;

  @IsString({ message: 'Le message doit etre une chaine de caracteres' })
  @MinLength(1, { message: 'Le message ne peut pas etre vide' })
  @MaxLength(5000, { message: 'Le message ne peut pas depasser 5000 caracteres' })
  body: string;
}

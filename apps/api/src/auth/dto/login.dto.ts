import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'L\'identifiant doit être une chaîne de caractères' })
  @MinLength(3, { message: 'L\'identifiant doit contenir au moins 3 caractères' })
  identifier: string; // Peut être username OU email

  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  password: string;
}

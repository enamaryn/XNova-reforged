import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'Le nom d\'utilisateur doit être une chaîne de caractères' })
  @MinLength(3, { message: 'Le nom d\'utilisateur doit contenir au moins 3 caractères' })
  @MaxLength(20, { message: 'Le nom d\'utilisateur ne peut pas dépasser 20 caractères' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores',
  })
  username: string;

  @IsEmail({}, { message: 'L\'adresse email n\'est pas valide' })
  @MaxLength(255, { message: 'L\'email ne peut pas dépasser 255 caractères' })
  email: string;

  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @MaxLength(100, { message: 'Le mot de passe ne peut pas dépasser 100 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre',
  })
  password: string;
}

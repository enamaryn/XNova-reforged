import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const PASSWORD_MESSAGE = 'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre';

export class ForgotPasswordDto {
  @Transform(trim)
  @IsEmail({}, { message: "L'adresse email n'est pas valide" })
  @MaxLength(255)
  email: string;
}

export class TokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;
}

export class ResetPasswordDto extends TokenDto {
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @MaxLength(100, { message: 'Le mot de passe ne peut pas dépasser 100 caractères' })
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(100)
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @MaxLength(100, { message: 'Le mot de passe ne peut pas dépasser 100 caractères' })
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class ChangeEmailDto {
  @IsString()
  @MaxLength(100)
  currentPassword: string;

  @Transform(trim)
  @IsEmail({}, { message: "L'adresse email n'est pas valide" })
  @MaxLength(255)
  newEmail: string;
}

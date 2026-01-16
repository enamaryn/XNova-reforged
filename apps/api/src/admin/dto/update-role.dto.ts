import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateRoleDto {
  @IsString({ message: 'Le nom doit etre une chaine de caracteres' })
  @MinLength(3, { message: 'Le nom doit contenir au moins 3 caracteres' })
  @MaxLength(20, { message: 'Le nom ne peut pas depasser 20 caracteres' })
  username: string;

  @IsString({ message: 'Le role doit etre une chaine de caracteres' })
  @IsIn(['PLAYER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'], {
    message: 'Role invalide',
  })
  role: string;
}

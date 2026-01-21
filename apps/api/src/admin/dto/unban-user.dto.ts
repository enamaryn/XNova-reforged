import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UnbanUserDto {
  @IsString({ message: 'Le nom doit etre une chaine de caracteres' })
  @MaxLength(20, { message: 'Le nom ne peut pas depasser 20 caracteres' })
  username: string;

  @IsOptional()
  @IsString({ message: 'La raison doit etre une chaine de caracteres' })
  @MaxLength(2000, { message: 'La raison ne peut pas depasser 2000 caracteres' })
  reason?: string;
}

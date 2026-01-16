import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAllianceDto {
  @IsString({ message: 'Le tag doit etre une chaine de caracteres' })
  @MinLength(2, { message: 'Le tag doit contenir au moins 2 caracteres' })
  @MaxLength(8, { message: 'Le tag ne peut pas depasser 8 caracteres' })
  tag: string;

  @IsString({ message: 'Le nom doit etre une chaine de caracteres' })
  @MinLength(3, { message: 'Le nom doit contenir au moins 3 caracteres' })
  @MaxLength(40, { message: 'Le nom ne peut pas depasser 40 caracteres' })
  name: string;

  @IsOptional()
  @IsString({ message: 'La description doit etre une chaine de caracteres' })
  @MaxLength(2000, { message: 'La description ne peut pas depasser 2000 caracteres' })
  description?: string;
}

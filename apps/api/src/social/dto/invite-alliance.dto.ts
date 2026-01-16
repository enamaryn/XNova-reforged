import { IsString, MaxLength, MinLength } from 'class-validator';

export class InviteAllianceDto {
  @IsString({ message: 'Le nom doit etre une chaine de caracteres' })
  @MinLength(3, { message: 'Le nom doit contenir au moins 3 caracteres' })
  @MaxLength(20, { message: 'Le nom ne peut pas depasser 20 caracteres' })
  username: string;
}

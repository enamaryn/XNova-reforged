import { IsString, Length, Matches } from 'class-validator';

export class RenamePlanetDto {
  @IsString()
  @Length(2, 30)
  @Matches(/^[a-zA-Z0-9À-ÿ' -]+$/, {
    message: 'Nom de planète invalide',
  })
  name: string;
}

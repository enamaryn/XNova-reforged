import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateConfigDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La vitesse du jeu doit etre un nombre' })
  @Min(0.1, { message: 'La vitesse du jeu doit etre superieure a 0' })
  @Max(10000, { message: 'La vitesse du jeu est trop elevee' })
  gameSpeed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La vitesse des flottes doit etre un nombre' })
  @Min(0.1, { message: 'La vitesse des flottes doit etre superieure a 0' })
  @Max(10000, { message: 'La vitesse des flottes est trop elevee' })
  fleetSpeed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La vitesse de production doit etre un nombre' })
  @Min(0, { message: 'La vitesse de production doit etre positive' })
  @Max(1000, { message: 'La vitesse de production est trop elevee' })
  resourceMultiplier?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Le multiplicateur des batiments doit etre un nombre' })
  @Min(0.1, { message: 'Le multiplicateur des batiments doit etre superieur a 0' })
  @Max(10000, { message: 'Le multiplicateur des batiments est trop eleve' })
  buildingCostMultiplier?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Le multiplicateur des recherches doit etre un nombre' })
  @Min(0.1, { message: 'Le multiplicateur des recherches doit etre superieur a 0' })
  @Max(10000, { message: 'Le multiplicateur des recherches est trop eleve' })
  researchCostMultiplier?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Le multiplicateur des vaisseaux doit etre un nombre' })
  @Min(0.1, { message: 'Le multiplicateur des vaisseaux doit etre superieur a 0' })
  @Max(10000, { message: 'Le multiplicateur des vaisseaux est trop eleve' })
  shipCostMultiplier?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La taille de planete doit etre un entier' })
  @Min(50, { message: 'La taille de planete est trop petite' })
  @Max(500, { message: 'La taille de planete est trop grande' })
  planetSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Le niveau max des batiments doit etre un entier' })
  @Min(1, { message: 'Le niveau max des batiments doit etre positif' })
  @Max(10000, { message: 'Le niveau max des batiments est trop eleve' })
  maxBuildingLevel?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Le niveau max des technologies doit etre un entier' })
  @Min(1, { message: 'Le niveau max des technologies doit etre positif' })
  @Max(10000, { message: 'Le niveau max des technologies est trop eleve' })
  maxTechnologyLevel?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Le revenu metal doit etre un nombre' })
  @Min(0, { message: 'Le revenu metal doit etre positif' })
  @Max(1000, { message: 'Le revenu metal est trop eleve' })
  baseMetal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Le revenu cristal doit etre un nombre' })
  @Min(0, { message: 'Le revenu cristal doit etre positif' })
  @Max(1000, { message: 'Le revenu cristal est trop eleve' })
  baseCrystal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Le revenu deuterium doit etre un nombre' })
  @Min(0, { message: 'Le revenu deuterium doit etre positif' })
  @Max(1000, { message: 'Le revenu deuterium est trop eleve' })
  baseDeuterium?: number;
}

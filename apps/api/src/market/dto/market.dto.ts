import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { MARKET_MAX_AMOUNT } from '@xnova/game-config';

export class CreateOfferDto {
  @IsString()
  planetId!: string;

  @IsString()
  give!: string;

  @IsString()
  want!: string;

  @IsInt({ message: 'La quantite doit etre un entier' })
  @Min(1)
  @Max(MARKET_MAX_AMOUNT)
  amount!: number;

  // Unites de la ressource demandee pour une unite de la ressource proposee
  @IsNumber()
  rate!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MARKET_MAX_AMOUNT)
  minAmount?: number;
}

export class BuyOfferDto {
  @IsString()
  planetId!: string;

  @IsInt({ message: 'La quantite doit etre un entier' })
  @Min(1)
  @Max(MARKET_MAX_AMOUNT)
  amount!: number;
}

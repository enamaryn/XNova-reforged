import { IsInt, IsString, Max, Min } from 'class-validator';
import { NPC_TRADE_MAX_AMOUNT } from '@xnova/game-config';

export class ExchangeDto {
  @IsString()
  planetId!: string;

  /** Ressource donnée au marchand. */
  @IsString()
  give!: string;

  /** Ressource reçue du marchand. */
  @IsString()
  want!: string;

  @IsInt({ message: 'La quantite doit etre un entier' })
  @Min(1)
  @Max(NPC_TRADE_MAX_AMOUNT)
  amount!: number;
}

export class BuyShipsDto {
  @IsString()
  planetId!: string;

  @IsInt()
  @Min(1)
  shipId!: number;

  @IsInt({ message: 'La quantite doit etre un entier' })
  @Min(1)
  @Max(1_000_000)
  amount!: number;
}

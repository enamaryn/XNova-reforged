import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BuyOfferDto, CreateOfferDto } from './dto/market.dto';
import { MarketService } from './market.service';

@UseGuards(JwtAuthGuard)
@Controller('market')
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get('offers')
  offers(
    @CurrentUser('id') userId: string,
    @Query('give') give?: string,
    @Query('want') want?: string,
    @Query('limit') limit?: string,
  ) {
    return this.market.listOffers(userId, give, want, limit ? Number(limit) || 50 : 50);
  }

  @Get('mine')
  mine(@CurrentUser('id') userId: string) {
    return this.market.mine(userId);
  }

  @Get('history')
  history(@Query('give') give: string, @Query('want') want: string) {
    return this.market.history(give, want);
  }

  @Post('offers')
  create(@Body() dto: CreateOfferDto, @CurrentUser('id') userId: string) {
    return this.market.createOffer(userId, dto);
  }

  @Post('offers/:id/buy')
  buy(@Param('id') id: string, @Body() dto: BuyOfferDto, @CurrentUser('id') userId: string) {
    return this.market.buy(userId, id, dto);
  }

  @Delete('offers/:id')
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.market.cancel(userId, id);
  }
}

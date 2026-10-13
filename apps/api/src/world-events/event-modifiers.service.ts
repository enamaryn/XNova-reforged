import { Injectable } from '@nestjs/common';
import { combineWorldEventEffects, type WorldEventEffects } from '@xnova/game-config';
import { DatabaseService } from '../database/database.service';

/**
 * Effets cumulés des événements du monde actifs. Un événement est actif tant que son statut est ACTIVE : le statut
 * ne change qu'après le règlement des compteurs de production (voir WorldEventsService), jamais par la seule
 * horloge, pour qu'un bonus ne s'applique ni avant son début ni après sa fin sur une période non réglée.
 */
@Injectable()
export class EventModifiersService {
  private cache: { value: WorldEventEffects; at: number } | null = null;
  private readonly ttlMs = 10_000;

  constructor(private readonly database: DatabaseService) {}

  async effects(): Promise<WorldEventEffects> {
    if (this.cache && Date.now() - this.cache.at < this.ttlMs) return this.cache.value;
    const rows = await this.database.worldEvent.findMany({
      where: { status: 'ACTIVE' },
      select: { productionBonus: true, marketTaxReduction: true },
    });
    const value = combineWorldEventEffects(rows);
    this.cache = { value, at: Date.now() };
    return value;
  }

  /** À appeler après tout changement de statut. */
  invalidate() {
    this.cache = null;
  }
}

import {
  WORLD_EVENT_MAX_PRODUCTION_BONUS,
  WORLD_EVENT_MAX_TAX_REDUCTION,
  WORLD_EVENT_REMINDER_DAYS,
  WORLD_EVENT_TEMPLATES,
  combineWorldEventEffects,
  effectiveTaxRate,
  getWorldEventTemplate,
  occurrenceKey,
  taxOf,
  templateOccurrence,
  templateWindow,
} from '@xnova/game-config';

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('événements du monde : modèles et fenêtres', () => {
  it('les identifiants des modèles sont uniques et leurs effets restent dans les bornes', () => {
    const ids = WORLD_EVENT_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { effects } of WORLD_EVENT_TEMPLATES) {
      expect(effects.productionBonus).toBeGreaterThanOrEqual(0);
      expect(effects.productionBonus).toBeLessThanOrEqual(WORLD_EVENT_MAX_PRODUCTION_BONUS);
      expect(effects.marketTaxReduction).toBeGreaterThanOrEqual(0);
      expect(effects.marketTaxReduction).toBeLessThanOrEqual(WORLD_EVENT_MAX_TAX_REDUCTION);
      expect(effects.productionBonus + effects.marketTaxReduction).toBeGreaterThan(0);
    }
  });

  it('la fenêtre inclut le dernier jour et se termine à minuit suivant', () => {
    const spring = getWorldEventTemplate('spring_festival')!;
    const window = templateWindow(spring, 2027);
    expect(window.startsAt).toEqual(utc('2027-03-20'));
    expect(window.endsAt).toEqual(utc('2027-03-28'));
  });

  it("une fenêtre qui enjambe le nouvel an se termine l'année suivante", () => {
    const winter = getWorldEventTemplate('winter_festival')!;
    const window = templateWindow(winter, 2026);
    expect(window.startsAt).toEqual(utc('2026-12-20'));
    expect(window.endsAt).toEqual(utc('2027-01-03'));
  });

  it('phase active, y compris au 1er janvier pour la fenêtre commencée en décembre', () => {
    const winter = getWorldEventTemplate('winter_festival')!;
    const inJanuary = templateOccurrence(winter, new Date('2027-01-01T12:00:00Z'));
    expect(inJanuary).toMatchObject({ phase: 'active', year: 2026 });
    expect(occurrenceKey(winter.id, inJanuary)).toBe('winter_festival:2026');
    expect(templateOccurrence(winter, new Date('2026-12-25T00:00:00Z')).phase).toBe('active');
  });

  it('la fin de fenêtre est exclusive', () => {
    const winter = getWorldEventTemplate('winter_festival')!;
    expect(templateOccurrence(winter, new Date('2027-01-02T23:59:59Z')).phase).toBe('active');
    expect(templateOccurrence(winter, new Date('2027-01-03T00:00:00Z')).phase).not.toBe('active');
  });

  it('rappel dans les 14 jours avant le début, « plus tard » au-delà', () => {
    const harvest = getWorldEventTemplate('harvest_moon')!;
    const start = templateWindow(harvest, 2026).startsAt.getTime();
    const day = 86_400_000;
    const reminder = templateOccurrence(harvest, new Date(start - WORLD_EVENT_REMINDER_DAYS * day));
    expect(reminder.phase).toBe('reminder');
    expect(templateOccurrence(harvest, new Date(start - (WORLD_EVENT_REMINDER_DAYS + 1) * day)).phase).toBe('later');
  });

  it("après la fin de la fenêtre, la prochaine occurrence est celle de l'année suivante", () => {
    const spring = getWorldEventTemplate('spring_festival')!;
    const next = templateOccurrence(spring, new Date('2026-06-01T00:00:00Z'));
    expect(next).toMatchObject({ phase: 'later', year: 2027 });
  });
});

describe('événements du monde : effets cumulés', () => {
  it('somme les bonus et borne le total', () => {
    expect(combineWorldEventEffects([])).toEqual({ productionBonus: 0, marketTaxReduction: 0 });
    expect(combineWorldEventEffects([{ productionBonus: 0.25 }, { productionBonus: 0.5, marketTaxReduction: 0.25 }])).toEqual({
      productionBonus: 0.75,
      marketTaxReduction: 0.25,
    });
    expect(combineWorldEventEffects([{ productionBonus: 0.8 }, { productionBonus: 0.8 }]).productionBonus).toBe(
      WORLD_EVENT_MAX_PRODUCTION_BONUS,
    );
  });

  it('ignore les valeurs négatives, non finies ou démesurées', () => {
    const effects = combineWorldEventEffects([
      { productionBonus: -5, marketTaxReduction: Number.NaN },
      { productionBonus: 1000, marketTaxReduction: Infinity },
    ]);
    expect(effects.productionBonus).toBe(WORLD_EVENT_MAX_PRODUCTION_BONUS);
    expect(effects.marketTaxReduction).toBe(0);
  });
});

describe('marché : taxe réduite par les événements', () => {
  it('sans événement, la taxe de base est inchangée', () => {
    expect(effectiveTaxRate()).toBe(0.05);
    expect(taxOf(100)).toBe(5);
  });

  it('la réduction divise la taxe, jusqu’à la supprimer', () => {
    expect(effectiveTaxRate(0.5)).toBeCloseTo(0.025);
    expect(taxOf(1000, 0.5)).toBe(25);
    expect(taxOf(1000, 1)).toBe(0);
  });

  it('borne la réduction entre 0 et 1', () => {
    expect(taxOf(1000, -3)).toBe(50);
    expect(taxOf(1000, 7)).toBe(0);
    expect(taxOf(1000, Number.NaN)).toBe(50);
  });
});

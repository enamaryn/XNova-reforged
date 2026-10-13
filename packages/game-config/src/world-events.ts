// Événements du monde : périodes de bonus temporaires lancées depuis la console d'administration.
// Un calendrier de modèles saisonniers sert de RAPPEL à l'administrateur ; rien ne démarre seul, sauf si la case
// « automatique » du modèle a été cochée. Boss, invasions et saisons réutiliseront ce cadre (champ `kind`).

export const WORLD_EVENT_KINDS = ['SEASONAL'] as const;
export type WorldEventKind = (typeof WORLD_EVENT_KINDS)[number];

/** Effets d'un événement, en fractions (0,25 = +25 %). */
export interface WorldEventEffects {
  /** Production des mines (métal, cristal, deutérium) : multiplicateur 1 + bonus. */
  productionBonus: number;
  /** Part de la taxe du marché supprimée (0,5 = taxe divisée par deux, 1 = aucune taxe). */
  marketTaxReduction: number;
}

export const NO_WORLD_EVENT_EFFECTS: WorldEventEffects = { productionBonus: 0, marketTaxReduction: 0 };

/** Bornes cumulées de tous les événements actifs. */
export const WORLD_EVENT_MAX_PRODUCTION_BONUS = 1;
export const WORLD_EVENT_MAX_TAX_REDUCTION = 1;
/** Durée maximale d'un événement lancé à la main, en jours. */
export const WORLD_EVENT_MAX_DAYS = 60;
/** Un modèle est suggéré (rappel) à partir de ce nombre de jours avant son début. */
export const WORLD_EVENT_REMINDER_DAYS = 14;
/** Longueur maximale du nom d'un événement personnalisé. */
export const WORLD_EVENT_MAX_NAME_LENGTH = 60;

export interface WorldEventTemplate {
  id: string;
  kind: WorldEventKind;
  /** Fenêtre annuelle recommandée (mois 1-12, jour 1-31, bornes incluses, UTC). Peut enjamber le nouvel an. */
  start: { month: number; day: number };
  end: { month: number; day: number };
  effects: WorldEventEffects;
}

export const WORLD_EVENT_TEMPLATES: readonly WorldEventTemplate[] = [
  {
    id: 'spring_festival',
    kind: 'SEASONAL',
    start: { month: 3, day: 20 },
    end: { month: 3, day: 27 },
    effects: { productionBonus: 0.25, marketTaxReduction: 0 },
  },
  {
    id: 'summer_solstice',
    kind: 'SEASONAL',
    start: { month: 6, day: 20 },
    end: { month: 6, day: 27 },
    effects: { productionBonus: 0, marketTaxReduction: 0.5 },
  },
  {
    id: 'harvest_moon',
    kind: 'SEASONAL',
    start: { month: 9, day: 22 },
    end: { month: 9, day: 29 },
    effects: { productionBonus: 0.25, marketTaxReduction: 0 },
  },
  {
    id: 'dark_nebula',
    kind: 'SEASONAL',
    start: { month: 10, day: 24 },
    end: { month: 11, day: 1 },
    effects: { productionBonus: 0.1, marketTaxReduction: 0.5 },
  },
  {
    id: 'winter_festival',
    kind: 'SEASONAL',
    start: { month: 12, day: 20 },
    end: { month: 1, day: 2 },
    effects: { productionBonus: 0.5, marketTaxReduction: 0.5 },
  },
];

export function getWorldEventTemplate(id: string): WorldEventTemplate | undefined {
  return WORLD_EVENT_TEMPLATES.find((template) => template.id === id);
}

export function isWorldEventKind(value: unknown): value is WorldEventKind {
  return typeof value === 'string' && (WORLD_EVENT_KINDS as readonly string[]).includes(value);
}

export interface WorldEventWindow {
  /** Année de début de la fenêtre. */
  year: number;
  startsAt: Date;
  /** Exclusive : minuit UTC après le dernier jour. */
  endsAt: Date;
}

/** Fenêtre du modèle qui commence l'année donnée. */
export function templateWindow(template: WorldEventTemplate, year: number): WorldEventWindow {
  const crossesYear =
    template.end.month < template.start.month ||
    (template.end.month === template.start.month && template.end.day < template.start.day);
  const endYear = crossesYear ? year + 1 : year;
  return {
    year,
    startsAt: new Date(Date.UTC(year, template.start.month - 1, template.start.day)),
    endsAt: new Date(Date.UTC(endYear, template.end.month - 1, template.end.day + 1)),
  };
}

export type TemplatePhase = 'active' | 'reminder' | 'later';

export interface TemplateOccurrence extends WorldEventWindow {
  phase: TemplatePhase;
}

/**
 * Occurrence pertinente d'un modèle à l'instant donné : la fenêtre en cours si `now` y est, sinon la prochaine
 * (phase « reminder » à moins de WORLD_EVENT_REMINDER_DAYS de son début, « later » au-delà).
 */
export function templateOccurrence(template: WorldEventTemplate, now: Date): TemplateOccurrence {
  const year = now.getUTCFullYear();
  for (const candidate of [year - 1, year]) {
    const window = templateWindow(template, candidate);
    if (now >= window.startsAt && now < window.endsAt) return { ...window, phase: 'active' };
  }
  const next =
    templateWindow(template, year).startsAt > now ? templateWindow(template, year) : templateWindow(template, year + 1);
  const days = (next.startsAt.getTime() - now.getTime()) / 86_400_000;
  return { ...next, phase: days <= WORLD_EVENT_REMINDER_DAYS ? 'reminder' : 'later' };
}

/** Identifiant d'unicité d'une occurrence de modèle : une seule par modèle et par année de début. */
export function occurrenceKey(templateId: string, window: Pick<WorldEventWindow, 'year'>): string {
  return `${templateId}:${window.year}`;
}

function clamp(value: unknown, max: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.min(Math.max(number, 0), max);
}

/** Effets cumulés des événements actifs : somme des bonus, bornée. */
export function combineWorldEventEffects(list: Array<Partial<WorldEventEffects>>): WorldEventEffects {
  return {
    productionBonus: clamp(
      list.reduce((sum, effects) => sum + clamp(effects.productionBonus, WORLD_EVENT_MAX_PRODUCTION_BONUS), 0),
      WORLD_EVENT_MAX_PRODUCTION_BONUS,
    ),
    marketTaxReduction: clamp(
      list.reduce((sum, effects) => sum + clamp(effects.marketTaxReduction, WORLD_EVENT_MAX_TAX_REDUCTION), 0),
      WORLD_EVENT_MAX_TAX_REDUCTION,
    ),
  };
}

// Marché : offres d'échange de ressources entre joueurs. Le vendeur met en séquestre la ressource proposée ;
// l'acheteur paie dans la ressource demandée ; une taxe est détruite à chaque vente.

export const MARKET_RESOURCES = ['metal', 'crystal', 'deuterium'] as const;
export type MarketResource = (typeof MARKET_RESOURCES)[number];

/** Valeur de référence d'une unité (rapport classique 3 : 2 : 1 entre métal, cristal et deutérium). */
export const MARKET_REFERENCE_VALUE: Record<MarketResource, number> = {
  metal: 1,
  crystal: 1.5,
  deuterium: 3,
};

/** Taxe prélevée sur le paiement et détruite. */
export const MARKET_TAX_RATE = 0.05;
/** Durée de vie d'une offre, en heures, avant remboursement du séquestre. */
export const MARKET_OFFER_HOURS = 24;
/** Offres actives par joueur. */
export const MARKET_MAX_ACTIVE_OFFERS = 10;
/** Le taux demandé reste dans [référence ÷ 2 ; référence × 2]. */
export const MARKET_RATE_FACTOR = 2;
/** Quantité maximale d'une offre (exclut les valeurs absurdes ou imprécises en virgule flottante). */
export const MARKET_MAX_AMOUNT = 1_000_000_000_000;

export function isMarketResource(value: unknown): value is MarketResource {
  return typeof value === 'string' && (MARKET_RESOURCES as readonly string[]).includes(value);
}

/** Taux de référence : unités de `want` demandées pour une unité de `give` à la parité des valeurs. */
export function referenceRate(give: MarketResource, want: MarketResource): number {
  return MARKET_REFERENCE_VALUE[give] / MARKET_REFERENCE_VALUE[want];
}

/** Bornes du taux autorisé pour une paire. */
export function rateBounds(give: MarketResource, want: MarketResource): { min: number; max: number } {
  const reference = referenceRate(give, want);
  return { min: reference / MARKET_RATE_FACTOR, max: reference * MARKET_RATE_FACTOR };
}

/** Arrondi d'un taux à 4 décimales (valeur stockée et utilisée pour tous les paiements). */
export function normalizeRate(rate: number): number {
  return Math.round(rate * 10_000) / 10_000;
}

export function isRateAllowed(give: MarketResource, want: MarketResource, rate: number): boolean {
  if (!Number.isFinite(rate) || rate <= 0) return false;
  const { min, max } = rateBounds(give, want);
  const normalized = normalizeRate(rate);
  // Une marge d'arrondi évite de refuser une borne exacte (ex. 0,25 pour 0,25)
  return normalized >= normalizeRate(min) && normalized <= normalizeRate(max);
}

/** Paiement dû pour `quantity` unités au taux `rate` : arrondi au supérieur, au moins 1. */
export function paymentFor(quantity: number, rate: number): number {
  return Math.max(1, Math.ceil(Number((quantity * rate).toFixed(6))));
}

/** Taux de taxe effectif : le taux de base, réduit de la part supprimée par les événements du monde (0 à 1). */
export function effectiveTaxRate(reduction = 0): number {
  const share = Math.min(Math.max(Number.isFinite(reduction) ? reduction : 0, 0), 1);
  return MARKET_TAX_RATE * (1 - share);
}

/** Taxe détruite sur un paiement (arrondie à l'inférieur). */
export function taxOf(payment: number, reduction = 0): number {
  return Math.floor(payment * effectiveTaxRate(reduction));
}

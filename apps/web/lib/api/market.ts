import { apiClient } from "./client";

export type MarketResource = "metal" | "crystal" | "deuterium";
export const MARKET_RESOURCES: MarketResource[] = ["metal", "crystal", "deuterium"];

export interface MarketRules {
  taxRate: number;
  offerHours: number;
  maxActiveOffers: number;
  rateFactor: number;
}

export interface MarketOffer {
  id: string;
  seller: string | null;
  mine: boolean;
  give: MarketResource;
  want: MarketResource;
  amount: number;
  remaining: number;
  minAmount: number;
  rate: number;
  active: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface MarketTradeRow {
  id: string;
  role: "buyer" | "seller";
  give: MarketResource;
  want: MarketResource;
  amount: number;
  rate: number;
  payment: number;
  tax: number;
  received: number;
  createdAt: string;
}

export interface MarketHistory {
  give: MarketResource;
  want: MarketResource;
  bounds: { min: number; max: number };
  lastRate: number | null;
  averageRate: number | null;
  trades: { amount: number; rate: number; createdAt: string }[];
}

export const marketApi = {
  offers: (give?: string, want?: string) => {
    const query = new URLSearchParams();
    if (give) query.set("give", give);
    if (want) query.set("want", want);
    const text = query.toString();
    return apiClient.get<{ rules: MarketRules; offers: MarketOffer[] }>(`/market/offers${text ? `?${text}` : ""}`);
  },
  mine: () => apiClient.get<{ rules: MarketRules; offers: MarketOffer[]; trades: MarketTradeRow[] }>("/market/mine"),
  history: (give: string, want: string) =>
    apiClient.get<MarketHistory>(`/market/history?give=${encodeURIComponent(give)}&want=${encodeURIComponent(want)}`),
  create: (body: { planetId: string; give: string; want: string; amount: number; rate: number; minAmount?: number }) =>
    apiClient.post<MarketOffer>("/market/offers", body),
  buy: (offerId: string, planetId: string, amount: number) =>
    apiClient.post<{ received: number; give: string; paid: number; want: string; tax: number; remaining: number }>(
      `/market/offers/${offerId}/buy`,
      { planetId, amount },
    ),
  cancel: (offerId: string) => apiClient.delete(`/market/offers/${offerId}`),
};

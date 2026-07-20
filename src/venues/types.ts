/** Unified market shape across venues. Prices are probabilities 0..1. */

export type Venue = "polymarket" | "kalshi";
export type Side = "yes" | "no";

export interface UnifiedMarket {
  venue: Venue;
  id: string; // Polymarket conditionId / Kalshi ticker
  question: string;
  category?: string;
  yesPrice: number | null; // best ask to BUY yes
  noPrice: number | null; // best ask to BUY no
  volume24h?: number;
  endDate?: string;
  url?: string;
}

export interface LegRequest {
  venue: Venue;
  id: string;
  side: Side;
}

export interface PricedLeg extends LegRequest {
  question: string;
  price: number; // executable prob for the chosen side
  category?: string;
}

export interface VenueAdapter {
  search(query: string, limit: number): Promise<UnifiedMarket[]>;
  /** Executable price (0..1) to buy `side` for roughly $stake. */
  priceLeg(id: string, side: Side, stakeUsd: number): Promise<PricedLeg>;
  /** null = unresolved; otherwise the winning side. */
  resolution(id: string): Promise<Side | null>;
}

/**
 * Polymarket adapter — public APIs, no credentials needed for pricing.
 *   Gamma:  https://gamma-api.polymarket.com/markets   (search/meta)
 *   CLOB:   https://clob.polymarket.com/book?token_id= (live orderbook)
 * Quotes walk the real book for the requested size — no mid-price fiction.
 */

import type { Side, UnifiedMarket, VenueAdapter, PricedLeg } from "./types.js";

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function parseArr(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  try {
    const p = JSON.parse(String(raw));
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

function toUnified(m: any): UnifiedMarket | null {
  const prices = parseArr(m.outcomePrices).map(Number);
  const outcomes = parseArr(m.outcomes);
  if (outcomes.length !== 2 || outcomes[0] !== "Yes") return null;
  return {
    venue: "polymarket",
    id: String(m.conditionId ?? m.id),
    question: String(m.question ?? ""),
    category: String(m.category ?? "") || undefined,
    yesPrice: Number.isFinite(prices[0]) ? prices[0] : null,
    noPrice: Number.isFinite(prices[1]) ? prices[1] : null,
    volume24h: Number(m.volume24hr ?? 0),
    endDate: m.endDate ? String(m.endDate) : undefined,
    url: m.slug ? `https://polymarket.com/event/${m.slug}` : undefined,
  };
}

async function findMarket(id: string): Promise<any> {
  // Prefer conditionId lookup; fall back to numeric Gamma id.
  const byCondition = await getJson(
    `${GAMMA}/markets?condition_ids=${encodeURIComponent(id)}`
  ).catch(() => []);
  if (Array.isArray(byCondition) && byCondition.length > 0) return byCondition[0];
  return getJson(`${GAMMA}/markets/${encodeURIComponent(id)}`);
}

/** Average fill price walking the asks for ~$stake of the chosen side. */
function walkBook(asks: { price: string; size: string }[], stakeUsd: number): number | null {
  // Asks arrive descending; we want cheapest first.
  const sorted = [...asks].sort((a, b) => Number(a.price) - Number(b.price));
  let remainingUsd = Math.max(1, stakeUsd);
  let cost = 0;
  let shares = 0;
  for (const lvl of sorted) {
    const p = Number(lvl.price);
    const sz = Number(lvl.size);
    if (!(p > 0) || !(sz > 0)) continue;
    const lvlUsd = p * sz;
    const take = Math.min(remainingUsd, lvlUsd);
    cost += take;
    shares += take / p;
    remainingUsd -= take;
    if (remainingUsd <= 0.000001) break;
  }
  if (shares <= 0 || remainingUsd > 0.01) return null; // not enough depth
  return cost / shares;
}

export const polymarket: VenueAdapter = {
  async search(query, limit) {
    // Gamma has no reliable text search — pull the most active markets and
    // filter locally.
    const url =
      `${GAMMA}/markets?limit=${query ? 200 : limit}&active=true&closed=false` +
      `&order=volume24hr&ascending=false`;
    const rows = await getJson(url);
    const q = query.toLowerCase();
    return (Array.isArray(rows) ? rows : [])
      .map(toUnified)
      .filter((m): m is UnifiedMarket => m !== null && m.yesPrice !== null)
      .filter((m) => !q || m.question.toLowerCase().includes(q))
      .slice(0, limit);
  },

  async priceLeg(id, side, stakeUsd) {
    const m = await findMarket(id);
    const tokens = parseArr(m.clobTokenIds);
    if (tokens.length !== 2) throw new Error(`market ${id}: no CLOB tokens`);
    const tokenId = side === "yes" ? tokens[0] : tokens[1];
    const book = await getJson(`${CLOB}/book?token_id=${tokenId}`);
    const avg = walkBook(book.asks ?? [], stakeUsd);
    if (avg === null || !(avg > 0 && avg < 1)) {
      throw new Error(`market ${id}: insufficient ${side.toUpperCase()} depth`);
    }
    return {
      venue: "polymarket",
      id,
      side,
      question: String(m.question ?? id),
      category: String(m.category ?? "") || undefined,
      price: avg,
    } satisfies PricedLeg;
  },

  async resolution(id) {
    const m = await findMarket(id).catch(() => null);
    if (!m) return null;
    const closed = m.closed === true || m.umaResolutionStatus === "resolved";
    if (!closed) return null;
    const prices = parseArr(m.outcomePrices).map(Number);
    if (prices.length !== 2) return null;
    if (prices[0] > 0.99) return "yes";
    if (prices[1] > 0.99) return "no";
    return null;
  },
};

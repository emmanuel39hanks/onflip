/**
 * Kalshi adapter — public endpoints, no credentials.
 *
 * The market LIST endpoints no longer carry prices; the ORDERBOOK endpoint
 * does (dollar levels, unauthenticated):
 *   GET /trade-api/v2/markets/{ticker}/orderbook
 *     → { orderbook_fp: { yes_dollars: [[price, size]...], no_dollars: [...] } }
 *
 * Both arrays are resting BIDS, ascending. Buying YES crosses the NO bids:
 *   yes ask = 1 − best NO bid   (and vice versa)
 * Search therefore lists markets, then hydrates prices via orderbooks.
 */

import type { Side, UnifiedMarket, VenueAdapter, PricedLeg } from "./types.js";

const BASE = "https://api.elections.kalshi.com/trade-api/v2";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

type Level = [string, string];

interface Book {
  yesBids: Level[];
  noBids: Level[];
}

async function orderbook(ticker: string): Promise<Book> {
  const d = await getJson(`${BASE}/markets/${encodeURIComponent(ticker)}/orderbook`);
  const fp = d.orderbook_fp ?? {};
  return { yesBids: fp.yes_dollars ?? [], noBids: fp.no_dollars ?? [] };
}

/**
 * Executable price to buy `side` for ~$stake: walk the opposite side's
 * bids from best (highest) downward; each level fills at (1 − bidPrice).
 */
function crossBook(oppositeBids: Level[], stakeUsd: number): number | null {
  const best = [...oppositeBids]
    .map(([p, s]) => ({ p: Number(p), s: Number(s) }))
    .filter((l) => l.p > 0 && l.p < 1 && l.s > 0)
    .sort((a, b) => b.p - a.p);
  let remaining = Math.max(1, stakeUsd);
  let cost = 0;
  let contracts = 0;
  for (const lvl of best) {
    const buyPrice = 1 - lvl.p;
    const lvlNotional = buyPrice * lvl.s; // size is in contracts ($1 payout each)
    const take = Math.min(remaining, lvlNotional);
    cost += take;
    contracts += take / buyPrice;
    remaining -= take;
    if (remaining <= 0.000001) break;
  }
  if (contracts <= 0 || remaining > 0.01) return null;
  return cost / contracts;
}

function marketUrl(ticker: string): string {
  return `https://kalshi.com/markets/${ticker.split("-")[0].toLowerCase()}`;
}

/**
 * The generic market list is ordered arbitrarily and dominated by dead
 * books, so search seeds from flagship high-liquidity series (Fed, CPI,
 * BTC/ETH, NYC temperature) plus the generic list as a tail.
 */
const FLAGSHIP_SERIES = [
  "KXFED",
  "KXFEDDECISION",
  "KXCPI",
  "KXCPIYOY",
  "KXBTC",
  "KXETH",
  "KXHIGHNY",
];

export const kalshi: VenueAdapter = {
  async search(query, limit) {
    const seeded = await Promise.all(
      FLAGSHIP_SERIES.map((s) =>
        getJson(`${BASE}/markets?series_ticker=${s}&status=open&limit=8`)
          .then((d) => d.markets ?? [])
          .catch(() => [])
      )
    );
    const generic = await getJson(`${BASE}/markets?limit=60&status=open`)
      .then((d) => d.markets ?? [])
      .catch(() => []);
    const seen = new Set<string>();
    const rows: any[] = [...seeded.flat(), ...generic].filter((m) => {
      const t = String(m.ticker ?? "");
      if (!t || seen.has(t)) return false;
      seen.add(t);
      return true;
    });
    const q = query.toLowerCase();
    const candidates = rows
      .filter((m) => {
        const text = `${m.title ?? ""} ${m.yes_sub_title ?? ""} ${m.ticker ?? ""}`.toLowerCase();
        return !q || text.includes(q);
      })
      .slice(0, Math.min(24, limit * 3));

    const hydrated = await Promise.all(
      candidates.map(async (m): Promise<UnifiedMarket | null> => {
        try {
          const book = await orderbook(String(m.ticker));
          const yes = crossBook(book.noBids, 10);
          const no = crossBook(book.yesBids, 10);
          if (yes === null && no === null) return null;
          return {
            venue: "kalshi",
            id: String(m.ticker),
            question: [m.title, m.yes_sub_title].filter(Boolean).join(" — "),
            category: String(m.category ?? "") || undefined,
            yesPrice: yes,
            noPrice: no,
            endDate: m.close_time ? String(m.close_time) : undefined,
            url: marketUrl(String(m.ticker)),
          };
        } catch {
          return null;
        }
      })
    );
    return hydrated.filter((m): m is UnifiedMarket => m !== null).slice(0, limit);
  },

  async priceLeg(id, side, stakeUsd) {
    const [meta, book] = await Promise.all([
      getJson(`${BASE}/markets/${encodeURIComponent(id)}`).catch(() => ({})),
      orderbook(id),
    ]);
    const m = meta.market ?? meta;
    const price =
      side === "yes" ? crossBook(book.noBids, stakeUsd) : crossBook(book.yesBids, stakeUsd);
    if (price === null || !(price > 0 && price < 1)) {
      throw new Error(`kalshi ${id}: insufficient ${side.toUpperCase()} depth`);
    }
    return {
      venue: "kalshi",
      id,
      side,
      question: [m.title, m.yes_sub_title].filter(Boolean).join(" — ") || id,
      category: String(m.category ?? "") || undefined,
      price,
    } satisfies PricedLeg;
  },

  async resolution(id) {
    const data = await getJson(`${BASE}/markets/${encodeURIComponent(id)}`).catch(() => null);
    const m = data?.market ?? data;
    if (!m) return null;
    if (m.status !== "settled" && m.status !== "finalized") return null;
    if (m.result === "yes") return "yes";
    if (m.result === "no") return "no";
    return null;
  },
};

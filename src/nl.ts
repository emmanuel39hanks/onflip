/**
 * Natural language → parlay legs.
 *
 * Primary path: 0G Compute Network inference (OpenAI-compatible router,
 * TEE-attested). Set ZEROG_API_KEY to enable. Fallback path: a
 * deterministic keyword parser, so the playground works with no key.
 * The model only ever SUGGESTS legs — pricing and placement stay in the
 * deterministic engine.
 */

import { polymarket } from "./venues/polymarket.js";
import { kalshi } from "./venues/kalshi.js";
import type { LegRequest, Side, UnifiedMarket } from "./venues/types.js";

const ZEROG_BASE = process.env.ZEROG_BASE_URL ?? "https://router-api.0g.ai/v1";
const ZEROG_MODEL = process.env.ZEROG_MODEL ?? "deepseek-v4-pro";

export const NL_PROVENANCE = {
  provider: "0G Compute Network",
  model: ZEROG_MODEL,
  attestation: "TEE-attested (TeeTLS)",
};

export interface NlParse {
  stakeUsd: number;
  legs: (LegRequest & { question: string; matchedBy: string })[];
  interpretation: string;
  engine: "0g" | "fallback";
}

interface CandidateMarket extends UnifiedMarket {
  key: number;
}

const QUERY_STOP = new Set(["the", "a", "an", "and", "i", "think", "says", "will", "be", "on", "in", "this", "that", "above", "over", "of", "to", "my", "keeps", "stays", "holds", "gets", "before", "after", "with", "for"]);
const QUERY_SYNONYMS: Record<string, string> = { bitcoin: "btc", ethereum: "eth", inflation: "cpi", rates: "fed" };

/**
 * Build the market universe for a query: the top-volume lists PLUS
 * targeted searches for each significant keyword, so niche markets
 * ("bitcoin", "cpi") are in play even when they're off the leaderboard.
 */
async function candidates(query: string): Promise<CandidateMarket[]> {
  const tokens = [...new Set(
    query.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !QUERY_STOP.has(w))
      .map((w) => QUERY_SYNONYMS[w] ?? w)
  )].slice(0, 4);

  const searches: Promise<UnifiedMarket[]>[] = [
    polymarket.search("", 16).catch(() => []),
    kalshi.search("", 10).catch(() => []),
    ...tokens.flatMap((t) => [
      polymarket.search(t, 5).catch(() => [] as UnifiedMarket[]),
      kalshi.search(t, 4).catch(() => [] as UnifiedMarket[]),
    ]),
  ];
  const results = (await Promise.all(searches)).flat();
  const seen = new Set<string>();
  const merged: UnifiedMarket[] = [];
  for (const m of results) {
    const k = `${m.venue}:${m.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(m);
  }
  return merged.map((m, i) => ({ ...m, key: i }));
}

/* ------------------------------ 0G path ---------------------------------- */

interface ZgPick {
  stakeUsd?: number;
  legs?: { key: number; side: Side; reason?: string }[];
  interpretation?: string;
}

async function zerogPick(text: string, universe: CandidateMarket[]): Promise<ZgPick> {
  const list = universe
    .map((m) => `${m.key}: [${m.venue}] "${m.question}" (yes=${m.yesPrice?.toFixed(2)})`)
    .join("\n");
  const res = await fetch(`${ZEROG_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ZEROG_API_KEY}`,
    },
    body: JSON.stringify({
      model: ZEROG_MODEL,
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You turn a trader's sentence into prediction-market legs. Pick ONLY from the " +
            "numbered market list. Respond with JSON: {stakeUsd:number, legs:[{key:number, " +
            'side:"yes"|"no"}], interpretation:string}. 2-4 legs. side reflects the ' +
            "trader's view of that market's question. Default stake 5 if unstated.",
        },
        { role: "user", content: `Markets:\n${list}\n\nTrader says: "${text}"` },
      ],
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`0G ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = (data.choices?.[0]?.message?.content ?? "").replace(/```json|```/g, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return JSON.parse(raw.slice(start, end + 1)) as ZgPick;
}

/* ---------------------------- fallback path ------------------------------ */

const NEGATORS = /\b(no|not|won't|wont|doesn't|doesnt|under|below|misses|fails|holds)\b/i;
const STOP = new Set(["the", "a", "an", "and", "i", "think", "says", "will", "be", "on", "in", "this", "that", "above", "over", "of", "to", "my"]);

function fallbackPick(text: string, universe: CandidateMarket[]): ZgPick {
  const stakeMatch = text.match(/\$?\s?(\d+(?:\.\d+)?)\s*(?:usd|usdt|dollars|bucks)?/i);
  const stakeUsd = stakeMatch ? Math.min(50, Math.max(1, Number(stakeMatch[1]))) : 5;

  const phrases = text
    .split(/\band\b|,|;|\+/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 3);

  const SYNONYMS: Record<string, string[]> = {
    bitcoin: ["btc"],
    btc: ["bitcoin"],
    ethereum: ["eth"],
    eth: ["ethereum"],
    fed: ["rates", "interest"],
    inflation: ["cpi"],
  };

  const legs: ZgPick["legs"] = [];
  const used = new Set<number>();
  for (const phrase of phrases) {
    const base = phrase.toLowerCase().replace(/[^a-z0-9 .]/g, "").split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w));
    const words = [...new Set(base.flatMap((w) => [w, ...(SYNONYMS[w] ?? [])]))];
    let best: { key: number; score: number } | null = null;
    for (const m of universe) {
      if (used.has(m.key)) continue;
      const q = m.question.toLowerCase();
      const score = words.reduce((s, w) => s + (q.includes(w) ? 1 : 0), 0);
      if (score > 0 && (!best || score > best.score)) best = { key: m.key, score };
    }
    if (best) {
      used.add(best.key);
      legs.push({ key: best.key, side: NEGATORS.test(phrase) ? "no" : "yes" });
    }
    if (legs.length >= 4) break;
  }
  return {
    stakeUsd,
    legs,
    interpretation: `Matched ${legs.length} market(s) by keyword (no 0G key configured — set ZEROG_API_KEY for smarter parsing).`,
  };
}

/* --------------------------------- main ---------------------------------- */

export async function parseNl(text: string): Promise<NlParse> {
  const universe = await candidates(text);
  let pick: ZgPick;
  let engine: NlParse["engine"] = "fallback";
  if (process.env.ZEROG_API_KEY) {
    try {
      pick = await zerogPick(text, universe);
      engine = "0g";
    } catch {
      pick = fallbackPick(text, universe);
    }
  } else {
    pick = fallbackPick(text, universe);
  }

  const legs = (pick.legs ?? [])
    .map((l) => {
      const m = universe.find((u) => u.key === l.key);
      if (!m) return null;
      return {
        venue: m.venue,
        id: m.id,
        side: l.side === "no" ? ("no" as Side) : ("yes" as Side),
        question: m.question,
        matchedBy: engine,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .slice(0, 4);

  return {
    stakeUsd: Math.min(50, Math.max(1, Number(pick.stakeUsd ?? 5))),
    legs,
    interpretation: pick.interpretation ?? "",
    engine,
  };
}

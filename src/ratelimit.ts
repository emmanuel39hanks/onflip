/**
 * Abuse controls — in-memory, per-instance.
 *
 * Two layers:
 *  1. Per-IP sliding windows: strict for /nl/quote (the endpoint that can
 *     spend 0G inference credits), looser for other writes.
 *  2. A global daily budget for model-backed NL calls; once exhausted the
 *     endpoint silently degrades to the free keyword parser, so the
 *     product keeps working while the credits stay protected.
 */

interface Window {
  hits: number[];
}

const buckets = new Map<string, Window>();

function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const w = buckets.get(key) ?? { hits: [] };
  w.hits = w.hits.filter((t) => now - t < windowMs);
  if (w.hits.length >= limit) {
    buckets.set(key, w);
    return false;
  }
  w.hits.push(now);
  buckets.set(key, w);
  return true;
}

// Periodic sweep so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, w] of buckets) {
    w.hits = w.hits.filter((t) => now - t < 120_000);
    if (w.hits.length === 0) buckets.delete(k);
  }
}, 300_000).unref();

export function clientIp(headers: Record<string, string | string[] | undefined>): string {
  const fwd = headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return (raw ?? "local").split(",")[0].trim();
}

/** Strict: model-backed NL parsing. 5/min, 30/hour per IP. */
export function allowNl(ip: string): boolean {
  return allow(`nl:m:${ip}`, 5, 60_000) && allow(`nl:h:${ip}`, 30, 3_600_000);
}

/** General write endpoints (quote/place/answer): 30/min per IP. */
export function allowWrite(ip: string): boolean {
  return allow(`w:${ip}`, 30, 60_000);
}

/* ----- global daily budget for 0G-backed calls ----- */

let dayKey = "";
let daySpent = 0;
const DAILY_MODEL_BUDGET = Number(process.env.NL_DAILY_MODEL_BUDGET ?? 500);

export function takeModelBudget(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) {
    dayKey = today;
    daySpent = 0;
  }
  if (daySpent >= DAILY_MODEL_BUDGET) return false;
  daySpent += 1;
  return true;
}

/**
 * Flip ASP — HTTP surface.
 *
 *   GET  /                     service manifest (for okx.ai listing/discovery)
 *   GET  /health               liveness
 *   GET  /markets?q=&venue=    unified search (Polymarket + Kalshi), free
 *   POST /parlay/quote         price a parlay, free  { legs:[{venue,id,side}], stakeUsd }
 *   POST /parlay/place         x402-paid: the payment IS stake+fee → ticket
 *   GET  /parlay/:id           ticket status
 *   GET  /tickets              recent tickets (audit)
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { polymarket } from "./venues/polymarket.js";
import { kalshi } from "./venues/kalshi.js";
import type { LegRequest, PricedLeg } from "./venues/types.js";
import { priceParlay, pricingFromEnv, PricingError, type ParlayPrice } from "./parlay/pricing.js";
import { tickets } from "./parlay/tickets.js";
import { paymentRequirements, verifyAndSettle } from "./x402.js";
import { parseNl, NL_PROVENANCE } from "./nl.js";
import { buildOpenApi } from "./openapi.js";
import { allowNl, allowWrite, clientIp, takeModelBudget } from "./ratelimit.js";

const SERVICE_FEE_BPS = 100; // 1% of stake, on top, min $0.10

interface QuoteCacheEntry {
  price: ParlayPrice;
  expiresAt: number;
}
const quoteCache = new Map<string, QuoteCacheEntry>();

function json(res: ServerResponse, code: number, body: unknown, extraHeaders?: Record<string, string>) {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-PAYMENT, X-IDEMPOTENCY-KEY",
    "Access-Control-Expose-Headers": "X-PAYMENT-REQUIRED, X-PAYMENT-REQUIRED-EXTENSIONS",
    ...(extraHeaders ?? {}),
  });
  res.end(text);
}

/**
 * 402 with OKX/x402 SDK compatibility: the terms are ALSO base64-encoded
 * in the X-PAYMENT-REQUIRED response header (what the OKX Payment SDK
 * client reads), alongside the JSON body for human/other clients.
 */
function payment402(res: ServerResponse, requirement: ReturnType<typeof paymentRequirements>, error?: string) {
  const header = Buffer.from(JSON.stringify(requirement)).toString("base64");
  const body = error ? { ...requirement, error } : requirement;
  json(res, 402, body, { "X-PAYMENT-REQUIRED": header });
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new PricingError("body must be JSON");
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function priceLegs(legsReq: LegRequest[], stakeUsd: number): Promise<PricedLeg[]> {
  return Promise.all(
    legsReq.map((l) => {
      if (l.venue === "polymarket") return polymarket.priceLeg(l.id, l.side, stakeUsd);
      if (l.venue === "kalshi") return kalshi.priceLeg(l.id, l.side, stakeUsd);
      throw new PricingError(`unknown venue "${(l as any).venue}"`);
    })
  );
}

function quoteId(price: ParlayPrice): string {
  return createHash("sha256")
    .update(JSON.stringify(price.legs.map((l) => [l.venue, l.id, l.side, l.price])))
    .update(String(price.stakeUsd))
    .digest("hex")
    .slice(0, 16);
}

function feeUsd(stakeUsd: number): number {
  return Math.max(0.1, Math.round(stakeUsd * SERVICE_FEE_BPS) / 10000);
}

const MANIFEST = {
  name: "Flip",
  tagline: "Turn conviction into a position — one x402 payment.",
  description:
    "Flip is a paid API for agents. Buy a single prediction-market outcome (a straight " +
    "YES/NO on Polymarket or Kalshi), or combine 2–6 markets into one leveraged parlay. " +
    "Quote for free; place by paying stake + 1% fee in USDT on X Layer via x402. " +
    "Deterministic pricing with a published edge, correlation haircut, and hard caps.",
  venues: ["polymarket", "kalshi"],
  payment: { protocol: "x402", network: "eip155:196", asset: "USDT" },
  endpoints: {
    "GET /markets?q=": "unified market search (free)",
    "POST /quote": "{ legs:[{venue,id,side}], stakeUsd } → 1 leg = single position, 2-6 = parlay (free)",
    "POST /place": "{ quoteId } + X-PAYMENT (stake+fee) → ticket",
    "POST /nl/quote": "{ text } → natural-language → quoted position (free)",
    "GET /position/:id": "ticket status (free)",
    "aliases": "/parlay/quote, /parlay/place, /parlay/:id also work",
  },
};

export function startHttp(port: number) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;

    try {
      if (req.method === "OPTIONS") return json(res, 204, {});
      if (path === "/" && req.method === "GET") return json(res, 200, MANIFEST);
      if (path === "/health") return json(res, 200, { ok: true, ts: Date.now() });

      if (path === "/openapi.json" && req.method === "GET") {
        const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080");
        const proto = String(req.headers["x-forwarded-proto"] ?? "http");
        return json(res, 200, buildOpenApi(`${proto}://${host}`));
      }

      if (path === "/nl/quote" && req.method === "POST") {
        const ip = clientIp(req.headers);
        if (!allowNl(ip)) {
          return json(res, 429, { error: "slow down — 5 NL quotes per minute per caller" });
        }
        const body = (await readBody(req)) as { text?: string };
        const text = String(body.text ?? "").slice(0, 400);
        if (text.trim().length < 8) return json(res, 400, { error: "describe your view in a sentence" });
        // Model calls draw from a global daily budget; past it, the free
        // keyword engine answers — the endpoint never becomes a proxy.
        const parsed = await parseNl(text, takeModelBudget());
        if (parsed.legs.length < 1) {
          return json(res, 422, {
            error: "could not map that to a live market — try naming the event",
            interpretation: parsed.interpretation,
            engine: parsed.engine,
            legs: parsed.legs,
          });
        }
        const priced = await priceLegs(parsed.legs, parsed.stakeUsd);
        const price = priceParlay(priced, parsed.stakeUsd, pricingFromEnv());
        const id = quoteId(price);
        quoteCache.set(id, { price, expiresAt: Date.now() + 90_000 });
        return json(res, 200, {
          interpretation: parsed.interpretation,
          engine: parsed.engine,
          provenance: parsed.engine === "0g" ? NL_PROVENANCE : undefined,
          legs: parsed.legs,
          quote: {
            quoteId: id,
            validForSeconds: 90,
            ...price,
            serviceFeeUsd: feeUsd(parsed.stakeUsd),
            totalChargeUsd: Math.round((parsed.stakeUsd + feeUsd(parsed.stakeUsd)) * 100) / 100,
          },
        });
      }

      if (path === "/markets" && req.method === "GET") {
        const q = url.searchParams.get("q") ?? "";
        const venue = url.searchParams.get("venue");
        const limit = Math.min(25, Number(url.searchParams.get("limit") ?? 10));
        const [pm, ks] = await Promise.all([
          venue && venue !== "polymarket" ? [] : polymarket.search(q, limit).catch(() => []),
          venue && venue !== "kalshi" ? [] : kalshi.search(q, limit).catch(() => []),
        ]);
        return json(res, 200, { markets: [...pm, ...ks] });
      }

      if ((path === "/parlay/quote" || path === "/quote") && req.method === "POST") {
        if (!allowWrite(clientIp(req.headers))) {
          return json(res, 429, { error: "rate limited — 30 requests per minute" });
        }
        const body = (await readBody(req)) as { legs?: LegRequest[]; stakeUsd?: number };
        const stakeUsd = Number(body.stakeUsd ?? 5);
        const legs = await priceLegs(body.legs ?? [], stakeUsd);
        const price = priceParlay(legs, stakeUsd, pricingFromEnv());
        const id = quoteId(price);
        quoteCache.set(id, { price, expiresAt: Date.now() + 90_000 });
        return json(res, 200, {
          quoteId: id,
          validForSeconds: 90,
          ...price,
          serviceFeeUsd: feeUsd(stakeUsd),
          totalChargeUsd: Math.round((stakeUsd + feeUsd(stakeUsd)) * 100) / 100,
        });
      }

      if ((path === "/parlay/place" || path === "/place") && req.method === "POST") {
        if (!allowWrite(clientIp(req.headers))) {
          return json(res, 429, { error: "rate limited — 30 requests per minute" });
        }
        const body = (await readBody(req)) as { quoteId?: string };
        const entry = body.quoteId ? quoteCache.get(body.quoteId) : undefined;
        if (!entry) return json(res, 400, { error: "unknown quoteId — call /parlay/quote first" });
        if (Date.now() > entry.expiresAt) {
          return json(res, 410, { error: "quote expired — re-quote and try again" });
        }
        const { price } = entry;
        const total = price.stakeUsd + feeUsd(price.stakeUsd);
        const requirement = paymentRequirements(
          total,
          `/parlay/place#${body.quoteId}`,
          `Flip parlay: $${price.stakeUsd} stake at ${price.offeredMultiplier}x (+$${feeUsd(price.stakeUsd)} fee)`
        );

        const paymentHeader = req.headers["x-payment"];
        if (!paymentHeader || typeof paymentHeader !== "string") {
          return payment402(res, requirement);
        }
        const result = await verifyAndSettle(paymentHeader, requirement.accepts[0]);
        if (!result.paid) return payment402(res, requirement, result.error);

        const idem = String(req.headers["x-idempotency-key"] ?? body.quoteId);
        const ticket = tickets.create(
          price,
          { payer: result.payer, txHash: result.txHash, simulated: result.simulated },
          idem
        );
        return json(res, 201, { ticket, payment: result });
      }

      if ((path.startsWith("/parlay/") || path.startsWith("/position/")) && req.method === "GET") {
        const t = tickets.get(path.replace(/^\/(parlay|position)\//, ""));
        if (!t) return json(res, 404, { error: "ticket not found" });
        return json(res, 200, { ticket: t });
      }

      if (path === "/tickets" && req.method === "GET") {
        return json(res, 200, { tickets: tickets.list().slice(0, 50) });
      }

      return json(res, 404, { error: "not found", see: "GET / for the manifest" });
    } catch (err) {
      if (err instanceof PricingError) return json(res, 400, { error: err.message });
      return json(res, 500, { error: String(err instanceof Error ? err.message : err).slice(0, 300) });
    }
  });

  server.listen(port);
  return server;
}

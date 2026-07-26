/**
 * Flip ASP — HTTP surface.
 *
 * Flip is an execution router for prediction markets. Agents keep custody of
 * their own funds: Flip prices a view, builds the order, and relays it once
 * the agent has signed it with its own key. Flip never holds a private key
 * and never receives the stake — only a small routing fee over x402.
 *
 *   GET  /                     service manifest (discovery + full usage docs)
 *   GET  /health               liveness
 *   GET  /markets?q=           unified search (Polymarket + Kalshi), free
 *   POST /quote                price a view across venues, free
 *   POST /nl/quote             natural language -> quoted view, free
 *   POST /execute              x402-paid: returns a ready-to-sign order
 *   POST /submit               relay the agent's signed order to Polymarket
 *   GET  /positions/:wallet    live positions for a wallet, free
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { polymarket } from "./venues/polymarket.js";
import { kalshi } from "./venues/kalshi.js";
import type { LegRequest, PricedLeg } from "./venues/types.js";
import { priceParlay, pricingFromEnv, PricingError, type ParlayPrice } from "./parlay/pricing.js";
import { paymentRequirements, verifyAndSettle } from "./x402.js";
import { parseNl, NL_PROVENANCE } from "./nl.js";
import { buildOpenApi } from "./openapi.js";
import { allowNl, allowWrite, clientIp, takeModelBudget } from "./ratelimit.js";
import {
  buildRoute,
  relayInstructions,
  relayOrder,
  positions,
  RouterError,
  type Route,
} from "./router/polymarket.js";

/** Flat routing fee per executed order, in USDT on X Layer. */
const ROUTE_FEE_USD = Number(process.env.ROUTE_FEE_USD ?? 0.02);

interface QuoteCacheEntry {
  price: ParlayPrice;
  expiresAt: number;
}
const quoteCache = new Map<string, QuoteCacheEntry>();

interface RouteCacheEntry {
  route: Route;
  agentAddress: string;
  signatureType?: 0 | 1 | 2 | 3;
  funderAddress?: string;
  expiresAt: number;
}
const routeCache = new Map<string, RouteCacheEntry>();

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

function shortId(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function quoteId(price: ParlayPrice): string {
  return shortId(
    JSON.stringify(price.legs.map((l) => [l.venue, l.id, l.side, l.price])) + String(price.stakeUsd)
  );
}

const MANIFEST = {
  name: "Flip",
  tagline: "Turn research and conviction into a real position — without the manual hop to the market.",
  description:
    "Flip is an execution router for prediction markets. Research agents surface mispriced odds; " +
    "Flip turns that view into an actual position on Polymarket. You keep custody of your funds " +
    "at all times: Flip prices the view, compares Polymarket against Kalshi, and builds a " +
    "ready-to-sign order — but YOUR key signs it and YOUR wallet holds the position. Flip has no " +
    "private key and never receives your stake. It charges a flat routing fee per executed order, " +
    "paid in USDT on X Layer over x402.",
  howItWorks: [
    "1. GET /markets?q=fed — find a market across Polymarket and Kalshi (free).",
    "2. POST /quote — see the odds, the implied payout, and which venue is cheaper (free).",
    "3. POST /execute — pay the routing fee via x402; receive an unsigned order plus the exact EIP-712 payload to sign.",
    "4. Sign that payload locally with your own key. Flip cannot do this for you.",
    "5. POST /submit — Flip relays your signed order to Polymarket. Or post it yourself; /execute tells you how.",
    "6. GET /positions/:wallet — track fills, value, and PnL.",
  ],
  custody: {
    model: "self-custody",
    stakeCustody: "none — funds never leave the agent's wallet",
    whoSigns: "the agent, with its own private key",
    whyItIsSafe:
      "Polymarket separates order signing (needs your private key) from order posting (needs only " +
      "API credentials). Flip only ever operates at the posting level, so it cannot create an order " +
      "you did not authorise and cannot withdraw your funds.",
  },
  venues: {
    polymarket: "executable — orders are routed and settled here",
    kalshi: "reference pricing only — Kalshi does not permit third-party order routing",
  },
  payment: {
    protocol: "x402",
    network: "eip155:196",
    networkName: "X Layer",
    asset: "USDT",
    model: "flat routing fee per executed order",
    routeFeeUsd: ROUTE_FEE_USD,
    note: "The fee is the only payment Flip receives. Your stake goes directly to Polymarket from your own wallet.",
  },
  requirements: {
    forQuoting: "nothing — /markets, /quote and /nl/quote are free and open",
    forExecuting: [
      `USDT on X Layer (eip155:196) to pay the ${ROUTE_FEE_USD} routing fee`,
      "USDC on Polygon in your own wallet — this is your stake, it never touches Flip",
      "an EVM key you can sign EIP-712 typed data with",
    ],
  },
  endpoints: {
    "GET /markets": {
      description: "Search live markets across Polymarket and Kalshi.",
      cost: "free",
      parameters: {
        q: "string — search text, e.g. 'fed' or 'bitcoin'",
        venue: "string (optional) — 'polymarket' or 'kalshi' to restrict results",
        limit: "integer (optional, default 10, max 25)",
      },
      example: "GET /markets?q=bitcoin&limit=5",
    },
    "POST /quote": {
      description:
        "Price a view. One leg returns a single position; 2-6 legs return the combined multiplier " +
        "for a sequential plan. Walks the real order book for the requested size.",
      cost: "free",
      parameters: {
        legs: "array of { venue: 'polymarket'|'kalshi', id: string, side: 'yes'|'no' } — 1 to 6 entries",
        stakeUsd: "number (optional, default 5) — the size you intend to trade",
      },
      example: {
        request: {
          stakeUsd: 5,
          legs: [{ venue: "polymarket", id: "0x<conditionId>", side: "yes" }],
        },
      },
    },
    "POST /nl/quote": {
      description: "Describe a view in plain English and get a quoted position back.",
      cost: "free (rate limited)",
      parameters: { text: "string — e.g. '$5 says the Fed holds rates in July'" },
      example: { request: { text: "$5 says bitcoin clears 130k this month" } },
    },
    "POST /execute": {
      description:
        "Build a ready-to-sign Polymarket order. Returns the unsigned order, the exact EIP-712 " +
        "typed data for you to sign with your own key, and instructions for posting it yourself " +
        "if you would rather not use /submit.",
      cost: `x402 — ${ROUTE_FEE_USD} USDT on X Layer`,
      parameters: {
        conditionId: "string — Polymarket condition id (from /markets)",
        side: "string — 'yes' or 'no'",
        price: "number — your limit price per share, 0..1, snapped to the market's tick size",
        size: "number — number of shares; cost = size × price USDC",
        signerAddress: "string — your wallet address; signs the order and receives the position",
        funderAddress: "string (optional) — address holding the USDC, if different (proxy/Safe)",
        signatureType: "integer (optional) — 0 = EOA (default), 1 = Magic/email proxy, 2 = Gnosis Safe, 3 = EIP-1271 contract wallet",
      },
      example: {
        request: {
          conditionId: "0x<conditionId>",
          side: "yes",
          price: 0.42,
          size: 10,
          signerAddress: "0x<your wallet>",
        },
        returns: "{ routeId, order, typedData, cost, builderFee, postItYourself }",
      },
    },
    "POST /submit": {
      description:
        "Relay an order you have signed. Flip attaches your signature and posts it to Polymarket. " +
        "Your L2 credentials can post and cancel orders only — they cannot sign new orders or " +
        "withdraw funds. You can skip this endpoint entirely and post the order yourself.",
      cost: "free — the routing fee was charged at /execute",
      parameters: {
        routeId: "string — from /execute",
        signature: "string — 0x-prefixed 65-byte signature of the typed data",
        creds: "object — { apiKey, secret, passphrase }: your own Polymarket L2 API credentials",
      },
      example: {
        request: {
          routeId: "<from /execute>",
          signature: "0x…",
          creds: { apiKey: "…", secret: "…", passphrase: "…" },
        },
      },
    },
    "GET /positions/:wallet": {
      description: "Live positions, current value and PnL for any wallet.",
      cost: "free",
      parameters: { wallet: "string — the wallet address, in the path" },
      example: "GET /positions/0x<your wallet>",
    },
  },
  openapi: "/openapi.json",
  docs: "https://onflip.xyz/docs",
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
          quote: { quoteId: id, validForSeconds: 90, ...price },
          nextStep: "POST /execute with a polymarket conditionId to get a ready-to-sign order",
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
          executable: price.legs.filter((l) => l.venue === "polymarket").map((l) => l.id),
          nextStep:
            "POST /execute with { conditionId, side, price, size, signerAddress } to get a ready-to-sign order",
        });
      }

      /* ----------------------------- execute ------------------------------ */

      if (path === "/execute" && req.method === "POST") {
        if (!allowWrite(clientIp(req.headers))) {
          return json(res, 429, { error: "rate limited — 30 requests per minute" });
        }
        const body = (await readBody(req)) as {
          conditionId?: string;
          side?: "yes" | "no";
          price?: number;
          size?: number;
          signerAddress?: string;
          funderAddress?: string;
          signatureType?: 0 | 1 | 2 | 3;
        };

        if (!body.conditionId) return json(res, 400, { error: "conditionId is required (see GET /markets)" });
        if (body.side !== "yes" && body.side !== "no") return json(res, 400, { error: "side must be 'yes' or 'no'" });
        if (!body.signerAddress || !/^0x[0-9a-fA-F]{40}$/.test(body.signerAddress)) {
          return json(res, 400, { error: "signerAddress must be your 0x wallet address" });
        }
        if (!(Number(body.price) > 0)) return json(res, 400, { error: "price is required (0..1)" });
        if (!(Number(body.size) > 0)) return json(res, 400, { error: "size is required (number of shares)" });

        const requirement = paymentRequirements(
          ROUTE_FEE_USD,
          `/execute#${body.conditionId}:${body.side}`,
          `Flip routing fee — build a signable Polymarket order (${body.size} shares @ ${body.price})`
        );

        const paymentHeader = req.headers["x-payment"];
        if (!paymentHeader || typeof paymentHeader !== "string") {
          return payment402(res, requirement);
        }
        const paid = await verifyAndSettle(paymentHeader, requirement.accepts[0]);
        if (!paid.paid) return payment402(res, requirement, paid.error);

        const route = await buildRoute({
          conditionId: body.conditionId,
          side: body.side,
          price: Number(body.price),
          size: Number(body.size),
          signerAddress: body.signerAddress,
          funderAddress: body.funderAddress,
          signatureType: body.signatureType,
        });

        const routeId = shortId(JSON.stringify(route.order) + Date.now());
        routeCache.set(routeId, {
          route,
          agentAddress: body.signerAddress,
          signatureType: body.signatureType,
          funderAddress: body.funderAddress,
          expiresAt: Date.now() + 10 * 60_000,
        });

        return json(res, 200, {
          routeId,
          validForSeconds: 600,
          market: route.market,
          cost: route.cost,
          builderFee: route.builderFee,
          order: route.order,
          typedData: route.typedData,
          nextStep:
            "Sign `typedData` with your own key (viem: signTypedData / ethers: _signTypedData), " +
            "then POST /submit { routeId, signature, creds }.",
          postItYourself: relayInstructions(route.order),
          payment: { feeUsd: ROUTE_FEE_USD, txHash: paid.txHash, simulated: paid.simulated },
          custody: "Flip did not sign this order and holds no key. It is inert until you sign it.",
          builderCode: route.builderCode,
        });
      }

      /* ------------------------------ submit ------------------------------ */

      if (path === "/submit" && req.method === "POST") {
        if (!allowWrite(clientIp(req.headers))) {
          return json(res, 429, { error: "rate limited — 30 requests per minute" });
        }
        const body = (await readBody(req)) as {
          routeId?: string;
          signature?: string;
          creds?: { apiKey?: string; secret?: string; passphrase?: string };
        };
        const entry = body.routeId ? routeCache.get(body.routeId) : undefined;
        if (!entry) return json(res, 400, { error: "unknown routeId — call /execute first" });
        if (Date.now() > entry.expiresAt) {
          return json(res, 410, { error: "route expired — call /execute again" });
        }
        if (!body.signature) return json(res, 400, { error: "signature is required" });
        const { apiKey, secret, passphrase } = body.creds ?? {};
        if (!apiKey || !secret || !passphrase) {
          return json(res, 400, {
            error:
              "creds { apiKey, secret, passphrase } are required — derive them from your own key " +
              "(clob-client: createOrDeriveApiKey). They cannot withdraw funds. " +
              "Alternatively post the order yourself using the `postItYourself` block from /execute.",
          });
        }

        const result = await relayOrder(
          entry.route.order,
          body.signature,
          { apiKey, secret, passphrase },
          entry.agentAddress,
          { signatureType: entry.signatureType, funderAddress: entry.funderAddress }
        );
        routeCache.delete(body.routeId!);
        return json(res, 201, {
          submitted: true,
          market: entry.route.market,
          cost: entry.route.cost,
          result,
          trackAt: `/positions/${entry.agentAddress}`,
        });
      }

      /* ----------------------------- positions ---------------------------- */

      if (path.startsWith("/positions/") && req.method === "GET") {
        const wallet = path.replace("/positions/", "").trim();
        if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
          return json(res, 400, { error: "path must be /positions/0x<wallet address>" });
        }
        return json(res, 200, { wallet, positions: await positions(wallet) });
      }

      return json(res, 404, { error: "not found", see: "GET / for the manifest" });
    } catch (err) {
      if (err instanceof PricingError) return json(res, 400, { error: err.message });
      if (err instanceof RouterError) return json(res, 422, { error: err.message });
      return json(res, 500, { error: String(err instanceof Error ? err.message : err).slice(0, 300) });
    }
  });

  server.listen(port);
  return server;
}

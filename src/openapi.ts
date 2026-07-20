/**
 * OpenAPI 3.1 spec — the single source of truth for the docs page and the
 * Scalar playground. Examples are real captured responses from production.
 */

const Market = {
  type: "object",
  properties: {
    venue: { type: "string", enum: ["polymarket", "kalshi"] },
    id: { type: "string", description: "Polymarket conditionId or Kalshi ticker" },
    question: { type: "string" },
    yesPrice: { type: "number", nullable: true, description: "executable YES price, 0..1" },
    noPrice: { type: "number", nullable: true },
    volume24h: { type: "number", nullable: true },
    endDate: { type: "string", nullable: true },
    url: { type: "string", nullable: true },
  },
} as const;

const LegRequest = {
  type: "object",
  required: ["venue", "id", "side"],
  properties: {
    venue: { type: "string", enum: ["polymarket", "kalshi"] },
    id: { type: "string" },
    side: { type: "string", enum: ["yes", "no"] },
  },
} as const;

const Quote = {
  type: "object",
  properties: {
    quoteId: { type: "string" },
    validForSeconds: { type: "integer" },
    legs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          venue: { type: "string" },
          id: { type: "string" },
          side: { type: "string" },
          question: { type: "string" },
          price: { type: "number", description: "executable price for the chosen side" },
        },
      },
    },
    fairMultiplier: { type: "number", description: "Π 1/price — independence product" },
    correlationHaircut: { type: "number" },
    offeredMultiplier: { type: "number", description: "fair × haircut × (1 − 7% edge)" },
    stakeUsd: { type: "number" },
    potentialPayoutUsd: { type: "number" },
    serviceFeeUsd: { type: "number" },
    totalChargeUsd: { type: "number", description: "stake + fee — the x402 amount" },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

const PaymentRequired = {
  type: "object",
  description: "x402 payment terms (HTTP 402 body)",
  properties: {
    x402Version: { type: "integer" },
    error: { type: "string" },
    accepts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          scheme: { type: "string", enum: ["exact"] },
          network: { type: "string", description: "eip155:196 — X Layer" },
          maxAmountRequired: { type: "string", description: "atomic USDT (6 decimals)" },
          asset: { type: "string" },
          payTo: { type: "string" },
          resource: { type: "string" },
          description: { type: "string" },
          maxTimeoutSeconds: { type: "integer" },
        },
      },
    },
  },
} as const;

const Ticket = {
  type: "object",
  properties: {
    ticketId: { type: "string" },
    createdAt: { type: "string" },
    status: { type: "string", enum: ["live", "won", "lost"] },
    stakeUsd: { type: "number" },
    multiplier: { type: "number" },
    potentialPayoutUsd: { type: "number" },
    legs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          venue: { type: "string" },
          id: { type: "string" },
          side: { type: "string" },
          question: { type: "string" },
          lockedPrice: { type: "number" },
          result: { type: "string", enum: ["pending", "won", "lost"] },
        },
      },
    },
    payer: { type: "string", nullable: true },
    paymentTxHash: { type: "string", nullable: true },
    settledAt: { type: "string", nullable: true },
  },
} as const;

export function buildOpenApi(serverUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Flip API",
      version: "0.1.0",
      description:
        "Combine live Polymarket and Kalshi markets into one position. " +
        "Reads are free; `POST /parlay/place` is paid via x402 — the payment " +
        "carries the stake (USDT on X Layer, eip155:196).",
    },
    servers: [{ url: serverUrl }],
    paths: {
      "/markets": {
        get: {
          summary: "Search live markets across both venues",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" }, description: "text filter" },
            { name: "venue", in: "query", schema: { type: "string", enum: ["polymarket", "kalshi"] } },
            { name: "limit", in: "query", schema: { type: "integer", default: 10, maximum: 25 } },
          ],
          responses: {
            "200": {
              description: "Unified market list",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { markets: { type: "array", items: Market } } },
                },
              },
            },
          },
        },
      },
      "/parlay/quote": {
        post: {
          summary: "Price a parlay (free)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["legs"],
                  properties: {
                    legs: { type: "array", items: LegRequest, minItems: 2, maxItems: 6 },
                    stakeUsd: { type: "number", default: 5, maximum: 50 },
                  },
                },
                example: {
                  stakeUsd: 5,
                  legs: [
                    { venue: "polymarket", id: "0x8bf1c1536ecb…", side: "no" },
                    { venue: "kalshi", id: "KXFED-27APR-T4.25", side: "yes" },
                  ],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Quote, valid 90 seconds",
              content: {
                "application/json": {
                  schema: Quote,
                  example: {
                    quoteId: "e8accb18d4bf3d19",
                    validForSeconds: 90,
                    fairMultiplier: 45.37,
                    offeredMultiplier: 42.1,
                    stakeUsd: 5,
                    potentialPayoutUsd: 210.5,
                    serviceFeeUsd: 0.1,
                    totalChargeUsd: 5.1,
                  },
                },
              },
            },
            "400": { description: "Pricing error (bad legs, caps, no depth)" },
          },
        },
      },
      "/parlay/place": {
        post: {
          summary: "Place a ticket (x402-paid — the payment is the stake)",
          description:
            "Without `X-PAYMENT`: responds 402 with payment terms. Pay " +
            "`totalChargeUsd` in USDT on X Layer, retry with the signed " +
            "`X-PAYMENT` header, receive the live ticket.",
          parameters: [
            { name: "X-PAYMENT", in: "header", schema: { type: "string" }, description: "base64 x402 payment payload" },
            { name: "X-IDEMPOTENCY-KEY", in: "header", schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", required: ["quoteId"], properties: { quoteId: { type: "string" } } },
              },
            },
          },
          responses: {
            "201": {
              description: "Ticket live",
              content: { "application/json": { schema: { type: "object", properties: { ticket: Ticket } } } },
            },
            "402": {
              description: "Payment required — x402 terms",
              content: {
                "application/json": {
                  schema: PaymentRequired,
                  example: {
                    x402Version: 1,
                    accepts: [{ scheme: "exact", network: "eip155:196", maxAmountRequired: "5100000", asset: "0x1E4a5963aBFD975d8c9021cE480b42188849D41d", payTo: "0x19d3…9375" }],
                  },
                },
              },
            },
            "410": { description: "Quote expired" },
          },
        },
      },
      "/parlay/{ticketId}": {
        get: {
          summary: "Ticket status",
          parameters: [{ name: "ticketId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Ticket", content: { "application/json": { schema: { type: "object", properties: { ticket: Ticket } } } } },
            "404": { description: "Not found" },
          },
        },
      },
      "/nl/quote": {
        post: {
          summary: "Natural language → quoted parlay (0G-powered)",
          description:
            "Describe a view in plain English; 0G Compute (TEE-attested " +
            "inference) maps it to live markets, then the deterministic " +
            "engine prices it. The model suggests; it never prices or places.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", required: ["text"], properties: { text: { type: "string" } } },
                example: { text: "$5 says the Fed holds in July and BTC clears 130k" },
              },
            },
          },
          responses: {
            "200": {
              description: "Interpretation + live quote",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      interpretation: { type: "string" },
                      engine: { type: "string", enum: ["0g", "fallback"] },
                      legs: { type: "array", items: LegRequest },
                      quote: Quote,
                    },
                  },
                },
              },
            },
            "422": { description: "Could not map the text to at least 2 markets" },
          },
        },
      },
      "/tickets": { get: { summary: "Recent tickets (audit trail)", responses: { "200": { description: "List" } } } },
      "/health": { get: { summary: "Liveness", responses: { "200": { description: "ok" } } } },
    },
  };
}

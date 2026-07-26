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
    type: { type: "string", enum: ["single", "parlay"] },
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
    offeredMultiplier: { type: "number", description: "fair × haircut × (1 − edge)" },
    stakeUsd: { type: "number" },
    potentialPayoutUsd: { type: "number" },
    executable: {
      type: "array",
      items: { type: "string" },
      description: "condition ids that can be routed (Polymarket only)",
    },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

const PaymentRequired = {
  type: "object",
  description: "x402 payment terms for the routing fee (HTTP 402 body)",
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

const Route = {
  type: "object",
  description:
    "A ready-to-sign Polymarket order. `order` carries no signature and authorises nothing " +
    "until you sign `typedData` with your own key.",
  properties: {
    routeId: { type: "string" },
    validForSeconds: { type: "integer", description: "routes are valid for 10 minutes" },
    market: {
      type: "object",
      properties: {
        conditionId: { type: "string" },
        question: { type: "string" },
        tokenId: { type: "string" },
        outcome: { type: "string", enum: ["yes", "no"] },
        tickSize: { type: "string" },
        negRisk: { type: "boolean" },
      },
    },
    cost: {
      type: "object",
      properties: {
        shares: { type: "number" },
        pricePerShare: { type: "number" },
        totalUsdc: { type: "number", description: "paid from YOUR wallet, direct to Polymarket" },
      },
    },
    builderFee: {
      type: "object",
      description: "What Flip earns on the trade itself. Disclosed before you sign.",
      properties: {
        takerBps: { type: "integer" },
        makerBps: { type: "integer" },
        estimatedUsdc: { type: "number" },
        note: { type: "string" },
      },
    },
    order: { type: "object", description: "unsigned order — no `signature` field" },
    typedData: {
      type: "object",
      description: "EIP-712 payload to sign locally",
      properties: {
        domain: { type: "object" },
        types: { type: "object" },
        primaryType: { type: "string" },
        message: { type: "object" },
      },
    },
    postItYourself: {
      type: "object",
      description: "the raw HTTP call, if you would rather not use /submit",
    },
    custody: { type: "string" },
    builderCode: { type: "string" },
  },
} as const;

const Position = {
  type: "object",
  properties: {
    conditionId: { type: "string" },
    question: { type: "string" },
    outcome: { type: "string" },
    size: { type: "number" },
    avgPrice: { type: "number" },
    currentValue: { type: "number" },
    pnlUsdc: { type: "number" },
    redeemable: { type: "boolean" },
  },
} as const;

const Err = {
  type: "object",
  properties: { error: { type: "string" } },
} as const;

export function buildOpenApi(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Flip — execution router for prediction markets",
      version: "2.0.0",
      description:
        "Flip turns an agent's view into a real prediction-market position. It searches " +
        "Polymarket and Kalshi, prices against live order books, and builds a ready-to-sign " +
        "Polymarket order.\n\n" +
        "**You keep custody throughout.** Flip holds no private key: it builds the order, you " +
        "sign it, and the position lands in your own wallet. Flip's only revenue is a flat " +
        "routing fee ($0.02 in USDT on X Layer, via x402) and a builder fee of 0 bps.\n\n" +
        "Search, quoting and position tracking are free. Only `POST /execute` is paid.",
      contact: { name: "Flip", url: "https://onflip.xyz" },
    },
    servers: [{ url: baseUrl }],
    tags: [
      { name: "Discovery", description: "Find and price markets. Free." },
      { name: "Execution", description: "Build, sign and submit orders." },
      { name: "Portfolio", description: "Track what you hold." },
    ],
    paths: {
      "/": {
        get: {
          tags: ["Discovery"],
          summary: "Service manifest",
          description: "Machine-readable description of the service, its endpoints and its custody model.",
          responses: { "200": { description: "Manifest" } },
        },
      },
      "/markets": {
        get: {
          tags: ["Discovery"],
          summary: "Search live markets (free)",
          description: "Unified search across Polymarket and Kalshi.",
          parameters: [
            {
              name: "q",
              in: "query",
              schema: { type: "string" },
              example: "fed",
              description: "search text",
            },
            {
              name: "venue",
              in: "query",
              schema: { type: "string", enum: ["polymarket", "kalshi"] },
              description: "restrict to one venue",
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 10, maximum: 25 },
            },
          ],
          responses: {
            "200": {
              description: "Matching markets",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { markets: { type: "array", items: Market } },
                  },
                },
              },
            },
          },
        },
      },
      "/quote": {
        post: {
          tags: ["Discovery"],
          summary: "Price a view (free)",
          description:
            "Walks the real order book for your size — never midpoints. One leg prices a single " +
            "position; 2-6 legs return the combined multiplier for a sequential plan.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["legs"],
                  properties: {
                    legs: { type: "array", items: LegRequest, minItems: 1, maxItems: 6 },
                    stakeUsd: { type: "number", default: 5 },
                  },
                },
                example: {
                  stakeUsd: 5,
                  legs: [{ venue: "polymarket", id: "0x8bf1…", side: "yes" }],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Quote",
              content: { "application/json": { schema: Quote } },
            },
            "400": { description: "Bad request", content: { "application/json": { schema: Err } } },
            "429": { description: "Rate limited", content: { "application/json": { schema: Err } } },
          },
        },
      },
      "/nl/quote": {
        post: {
          tags: ["Discovery"],
          summary: "Natural language → quote (free)",
          description:
            "Maps a sentence to live markets using 0G Compute (TEE-attested inference), then " +
            "prices it deterministically. The model only selects from real markets we supply — " +
            "it never prices, signs, or touches money.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["text"],
                  properties: { text: { type: "string", maxLength: 400 } },
                },
                example: { text: "$5 says the Fed holds rates in July" },
              },
            },
          },
          responses: {
            "200": { description: "Interpretation + quote" },
            "422": {
              description: "Could not map to a live market",
              content: { "application/json": { schema: Err } },
            },
            "429": { description: "Rate limited (5/min)", content: { "application/json": { schema: Err } } },
          },
        },
      },
      "/execute": {
        post: {
          tags: ["Execution"],
          summary: "Build a ready-to-sign order (x402 — $0.02)",
          description:
            "Returns an unsigned Polymarket order plus the exact EIP-712 payload to sign with " +
            "your own key. Without an `X-PAYMENT` header this returns HTTP 402 with the fee " +
            "terms; retry with the header to receive the order.\n\n" +
            "The returned order carries no signature and authorises nothing until you sign it. " +
            "A `postItYourself` block is included so you can bypass `/submit` entirely.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["conditionId", "side", "price", "size", "signerAddress"],
                  properties: {
                    conditionId: { type: "string", description: "Polymarket condition id" },
                    side: { type: "string", enum: ["yes", "no"] },
                    price: { type: "number", description: "limit price per share, 0..1, snapped to tick size" },
                    size: { type: "number", description: "number of shares; cost = size × price" },
                    signerAddress: { type: "string", description: "your wallet — signs and receives the position" },
                    funderAddress: { type: "string", description: "your Polymarket proxy, if different" },
                    signatureType: {
                      type: "integer",
                      enum: [0, 1, 2, 3],
                      description: "0 = EOA, 1 = Magic/email proxy, 2 = Gnosis Safe, 3 = EIP-1271",
                    },
                  },
                },
                example: {
                  conditionId: "0x8bf1…",
                  side: "yes",
                  price: 0.42,
                  size: 10,
                  signerAddress: "0xYourWallet",
                  funderAddress: "0xYourPolymarketProxy",
                  signatureType: 2,
                },
              },
            },
          },
          responses: {
            "200": { description: "Signable order", content: { "application/json": { schema: Route } } },
            "402": {
              description: "Routing fee required",
              content: { "application/json": { schema: PaymentRequired } },
            },
            "422": {
              description: "Venue rejected — closed market, insufficient depth, or unfunded wallet",
              content: { "application/json": { schema: Err } },
            },
          },
        },
      },
      "/submit": {
        post: {
          tags: ["Execution"],
          summary: "Relay your signed order (free)",
          description:
            "Attaches your signature to the order from `/execute` and posts it to Polymarket. " +
            "`creds` are your own Polymarket L2 API credentials, derived from your key with " +
            "`createOrDeriveApiKey()`. They can post and cancel orders — they cannot sign new " +
            "orders or withdraw funds. Optional: use `postItYourself` from `/execute` instead.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["routeId", "signature", "creds"],
                  properties: {
                    routeId: { type: "string" },
                    signature: { type: "string", description: "0x-prefixed 65-byte signature" },
                    creds: {
                      type: "object",
                      properties: {
                        apiKey: { type: "string" },
                        secret: { type: "string" },
                        passphrase: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Submitted" },
            "400": { description: "Unknown routeId or missing signature", content: { "application/json": { schema: Err } } },
            "410": { description: "Route expired", content: { "application/json": { schema: Err } } },
            "422": { description: "Exchange rejected the order", content: { "application/json": { schema: Err } } },
          },
        },
      },
      "/positions/{wallet}": {
        get: {
          tags: ["Portfolio"],
          summary: "Live positions (free)",
          description: "Current holdings, mark value and PnL for any wallet.",
          parameters: [
            {
              name: "wallet",
              in: "path",
              required: true,
              schema: { type: "string" },
              example: "0x19d368e389fe491a578adbfb08f353780d239375",
            },
          ],
          responses: {
            "200": {
              description: "Positions",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      wallet: { type: "string" },
                      positions: { type: "array", items: Position },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/health": {
        get: {
          tags: ["Discovery"],
          summary: "Liveness",
          responses: { "200": { description: "ok" } },
        },
      },
    },
  };
}

/**
 * Polymarket execution router — the heart of Flip.
 *
 * Flip builds orders; the AGENT signs them; Flip relays them. Flip never
 * holds a private key, so it cannot create an order the agent did not
 * authorise and cannot move the agent's funds.
 *
 * That is not a policy — it is enforced by the shape of this code. We drive
 * Polymarket's own `OrderBuilder` with a `CapturingSigner`, an object whose
 * "signing" method throws away the request and records the EIP-712 payload
 * instead. There is no key material in this process to sign with.
 *
 *   1. buildRoute()  → unsigned order + the exact EIP-712 typed data to sign
 *   2. (agent signs locally with its own key — off-box, never here)
 *   3. relayOrder()  → attach the agent's signature, POST to the CLOB
 *
 * Amount/rounding math is delegated to @polymarket/clob-client-v2 so our
 * orders are byte-identical to ones built by Polymarket's own SDK. Flip's
 * builder code travels inside the order the agent signs, so routing
 * attribution is visible to the agent rather than bolted on afterwards.
 */

import { ClobClient, OrderBuilder, Side, SignatureTypeV2 } from "@polymarket/clob-client-v2";
import type { SignedOrder, TickSize, UserOrderV2 } from "@polymarket/clob-client-v2";

const CLOB_HOST = process.env.POLYMARKET_CLOB_HOST ?? "https://clob.polymarket.com";
const GAMMA = "https://gamma-api.polymarket.com";
const POLYGON = 137;

/** Order format. V2 is what the exchange accepts today. */
const ORDER_VERSION = 2;

/**
 * Public Builder Program identifier (bytes32). It is carried inside the order
 * the agent signs, so the agent can see exactly who routed its trade.
 */
const BUILDER_CODE = process.env.POLYMARKET_BUILDER_CODE;

export class RouterError extends Error {}

/* --------------------------- the capturing signer ------------------------- */

/**
 * A "signer" with no private key. `getAddress()` reports the agent's address
 * (so the SDK stamps the order correctly) and `_signTypedData()` records what
 * WOULD be signed, then returns a placeholder that never reaches the exchange.
 *
 * This is what makes Flip non-custodial: the only signer we can construct is
 * one that is incapable of producing a valid signature.
 */
class CapturingSigner {
  captured?: { domain: unknown; types: unknown; value: unknown };

  constructor(private readonly address: string) {}

  async getAddress(): Promise<string> {
    return this.address;
  }

  async _signTypedData(domain: unknown, types: unknown, value: unknown): Promise<string> {
    this.captured = { domain, types, value };
    // 65-byte placeholder. Structurally valid, cryptographically worthless —
    // it is replaced by the agent's real signature in relayOrder().
    return `0x${"00".repeat(65)}`;
  }
}

/* ------------------------------ market metadata --------------------------- */

export interface ExecMarket {
  conditionId: string;
  question: string;
  slug?: string;
  /** CLOB token ids, index 0 = YES, 1 = NO. */
  tokenIds: [string, string];
  negRisk: boolean;
  tickSize: TickSize;
  minOrderSize: number;
  closed: boolean;
  acceptingOrders: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new RouterError(`${url} -> ${res.status}`);
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

/** Read-only client: no signer, no creds — used for public market data. */
const publicClient = new ClobClient({ host: CLOB_HOST, chain: POLYGON });

export interface BuilderFee {
  takerBps: number;
  makerBps: number;
  estimatedUsdc: number;
  note: string;
}

let builderFeeCache: { takerBps: number; makerBps: number; at: number } | undefined;

/**
 * What Flip charges on the trade itself, read from Polymarket's public builder
 * registry (never asserted by us). Quoted to the agent BEFORE it signs, so the
 * total cost of routing is never a post-trade surprise.
 */
export async function builderFee(notionalUsdc: number): Promise<BuilderFee> {
  const zero: BuilderFee = {
    takerBps: 0,
    makerBps: 0,
    estimatedUsdc: 0,
    note: "Flip takes 0% of your trade. The routing fee paid at /execute is our only charge.",
  };
  if (!BUILDER_CODE) return zero;

  try {
    if (!builderFeeCache || Date.now() - builderFeeCache.at > 300_000) {
      const r = await getJson(`${CLOB_HOST}/fees/builder-fees/${BUILDER_CODE}`);
      builderFeeCache = {
        takerBps: Number(r.builder_taker_fee_rate_bps ?? 0),
        makerBps: Number(r.builder_maker_fee_rate_bps ?? 0),
        at: Date.now(),
      };
    }
  } catch {
    return zero; // never block a trade on a fee lookup
  }

  const { takerBps, makerBps } = builderFeeCache;
  if (takerBps === 0 && makerBps === 0) return zero;
  return {
    takerBps,
    makerBps,
    estimatedUsdc: Number(((notionalUsdc * takerBps) / 10_000).toFixed(6)),
    note:
      `Flip's builder fee is ${takerBps} bps taker / ${makerBps} bps maker, charged by Polymarket ` +
      `on fills and verifiable at ${CLOB_HOST}/fees/builder-fees/${BUILDER_CODE}.`,
  };
}

/**
 * Everything needed to place a valid order on a market. Tick size and minimum
 * order size are fetched live — they vary per market and a wrong value is
 * rejected by the exchange.
 */
export async function execMarket(conditionId: string): Promise<ExecMarket> {
  const [gammaRows, clobMarket] = await Promise.all([
    getJson(`${GAMMA}/markets?condition_ids=${encodeURIComponent(conditionId)}`).catch(() => []),
    publicClient.getMarket(conditionId).catch(() => null),
  ]);

  const g = Array.isArray(gammaRows) && gammaRows.length > 0 ? gammaRows[0] : null;
  if (!g && !clobMarket) throw new RouterError(`unknown market ${conditionId}`);

  const tokenIds = parseArr(g?.clobTokenIds);
  const fromClob: string[] = (clobMarket?.tokens ?? []).map((t: any) => String(t.token_id));
  const ids = tokenIds.length === 2 ? tokenIds : fromClob;
  if (ids.length !== 2) throw new RouterError(`market ${conditionId}: no CLOB token ids`);

  // Authoritative tick size comes from the CLOB itself.
  const tickSize = (await publicClient
    .getTickSize(ids[0])
    .catch(() => (clobMarket?.minimum_tick_size ?? "0.01") as TickSize)) as TickSize;

  return {
    conditionId,
    question: String(g?.question ?? clobMarket?.question ?? conditionId),
    slug: g?.slug ? String(g.slug) : undefined,
    tokenIds: [ids[0], ids[1]],
    negRisk: Boolean(g?.negRisk ?? clobMarket?.neg_risk ?? false),
    tickSize,
    minOrderSize: Number(clobMarket?.minimum_order_size ?? 5),
    closed: Boolean(g?.closed ?? clobMarket?.closed ?? false),
    acceptingOrders: clobMarket ? clobMarket.accepting_orders !== false : true,
  };
}

/* -------------------------------- routing --------------------------------- */

export interface BuildRouteParams {
  conditionId: string;
  /** Which outcome the agent is buying. */
  side: "yes" | "no";
  /** Limit price per share, 0..1. Rounded to the market's tick size. */
  price: number;
  /** Number of shares. `size × price` is the USDC cost. */
  size: number;
  /** The agent's own wallet — signs the order and receives the position. */
  signerAddress: string;
  /**
   * Address holding the USDC. Defaults to signerAddress (a plain EOA).
   * For a Polymarket proxy/Safe, pass the proxy address.
   */
  funderAddress?: string;
  /** 0 = EOA (default), 1 = email/Magic proxy, 2 = Gnosis Safe, 3 = EIP-1271. */
  signatureType?: 0 | 1 | 2 | 3;
}

export interface Route {
  market: {
    conditionId: string;
    question: string;
    tokenId: string;
    outcome: "yes" | "no";
    tickSize: TickSize;
    negRisk: boolean;
  };
  /** Unsigned order. The agent signs `typedData`; this is echoed back to relay. */
  order: Record<string, unknown>;
  /**
   * Exact EIP-712 payload for the agent to sign locally, e.g. with viem's
   * `signTypedData` or ethers' `_signTypedData`.
   */
  typedData: { domain: unknown; types: unknown; primaryType: string; message: unknown };
  cost: { shares: number; pricePerShare: number; totalUsdc: number };
  /** What Flip earns on the trade itself. Disclosed before signing. */
  builderFee: BuilderFee;
  builderCode?: string;
}

/**
 * Build a ready-to-sign order. Nothing here can move funds: the returned
 * order is inert until the agent signs `typedData` with its own key.
 */
export async function buildRoute(params: BuildRouteParams): Promise<Route> {
  const market = await execMarket(params.conditionId);
  if (market.closed) throw new RouterError(`market is closed: ${market.question}`);
  if (!market.acceptingOrders) throw new RouterError("market is not accepting orders");

  const tokenId = params.side === "yes" ? market.tokenIds[0] : market.tokenIds[1];

  // Snap price to the market's tick, then validate — clearer errors than the
  // exchange's generic rejection.
  const tick = Number(market.tickSize);
  const price = Number((Math.round(params.price / tick) * tick).toFixed(6));
  if (!(price > 0 && price < 1)) {
    throw new RouterError(`price must be between 0 and 1 (got ${params.price})`);
  }
  if (!(params.size > 0)) throw new RouterError("size must be positive");
  if (params.size < market.minOrderSize) {
    throw new RouterError(
      `size ${params.size} is below this market's minimum of ${market.minOrderSize} shares`
    );
  }

  const signer = new CapturingSigner(params.signerAddress);
  const builder = new OrderBuilder(
    signer as never,
    POLYGON,
    (params.signatureType ?? SignatureTypeV2.EOA) as SignatureTypeV2,
    params.funderAddress ?? params.signerAddress
  );

  const userOrder: UserOrderV2 = {
    tokenID: tokenId,
    price,
    size: params.size,
    // Always BUY: buying NO is expressed by buying the NO token, not selling YES.
    side: Side.BUY,
    ...(BUILDER_CODE ? { builderCode: BUILDER_CODE } : {}),
  };

  // Runs Polymarket's own amount/rounding math. The signature it produces is
  // the placeholder from CapturingSigner and is discarded below.
  const built = (await builder.buildOrder(
    userOrder,
    { tickSize: market.tickSize, negRisk: market.negRisk },
    ORDER_VERSION
  )) as SignedOrder & { signature: string };

  const { signature: _placeholder, ...unsignedOrder } = built;

  if (!signer.captured) {
    throw new RouterError("internal: order typed data was not captured");
  }
  const { domain, types, value } = signer.captured;

  return {
    market: {
      conditionId: market.conditionId,
      question: market.question,
      tokenId,
      outcome: params.side,
      tickSize: market.tickSize,
      negRisk: market.negRisk,
    },
    order: unsignedOrder as unknown as Record<string, unknown>,
    typedData: { domain, types, primaryType: "Order", message: value },
    cost: {
      shares: params.size,
      pricePerShare: price,
      totalUsdc: Number((params.size * price).toFixed(6)),
    },
    builderFee: await builderFee(params.size * price),
    builderCode: BUILDER_CODE,
  };
}

/* --------------------------------- relay ---------------------------------- */

export interface RelayCreds {
  apiKey: string;
  secret: string;
  passphrase: string;
}

/**
 * Attach the agent's signature to a previously built order and POST it.
 *
 * `creds` are the agent's Polymarket L2 API credentials. They can post
 * already-signed orders, read, and cancel — they cannot create an order or
 * withdraw funds (that needs the private key, which stays with the agent).
 * Agents that would rather not share even these can post the order themselves;
 * `relayInstructions()` returns the exact request to make.
 */
export async function relayOrder(
  order: Record<string, unknown>,
  signature: string,
  creds: RelayCreds,
  agentAddress: string,
  opts?: { signatureType?: 0 | 1 | 2 | 3; funderAddress?: string }
): Promise<unknown> {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw new RouterError("signature must be a 0x-prefixed 65-byte hex string");
  }

  const signed = { ...order, signature } as unknown as SignedOrder;

  const client = new ClobClient({
    host: CLOB_HOST,
    chain: POLYGON,
    signer: new CapturingSigner(agentAddress) as never,
    creds: { key: creds.apiKey, secret: creds.secret, passphrase: creds.passphrase },
    signatureType: (opts?.signatureType ?? SignatureTypeV2.EOA) as SignatureTypeV2,
    funderAddress: opts?.funderAddress ?? agentAddress,
  });

  try {
    const result = (await client.postOrder(signed)) as { error?: string } | undefined;
    if (result?.error) throw new Error(result.error);
    return result;
  } catch (err) {
    throw new RouterError(explainClobError(String(err instanceof Error ? err.message : err)));
  }
}

/**
 * Turn the exchange's terse rejections into something an agent operator can
 * act on. The account-setup case is by far the most common first-run failure.
 */
function explainClobError(raw: string): string {
  const msg = raw.slice(0, 300);
  if (/maker address not allowed|deposit wallet flow/i.test(msg)) {
    return (
      "Polymarket does not recognise this wallet as a funded trading account. " +
      "A plain EOA cannot trade directly: deposit USDC once at https://polymarket.com to create " +
      "your proxy wallet, then call /execute with funderAddress = <your proxy address> and " +
      "signatureType = 2 (Gnosis Safe proxy) or 1 (email/Magic proxy). " +
      `[exchange said: ${msg}]`
    );
  }
  if (/not enough balance|insufficient/i.test(msg)) {
    return `Not enough USDC in the funding wallet to cover this order. [exchange said: ${msg}]`;
  }
  if (/invalid order version/i.test(msg)) {
    return `Order format rejected — Flip needs updating to the exchange's current order version. [exchange said: ${msg}]`;
  }
  return `CLOB rejected the order: ${msg}`;
}

/** The exact HTTP call an agent can make itself instead of using our relay. */
export function relayInstructions(order: Record<string, unknown>) {
  return {
    note:
      "Sign `typedData` with your own key, then either POST it yourself as below, " +
      "or send { routeId, signature } to Flip's /submit and we will relay it.",
    method: "POST",
    url: `${CLOB_HOST}/order`,
    auth:
      "Polymarket L2 headers (POLY_ADDRESS, POLY_SIGNATURE, POLY_TIMESTAMP, POLY_API_KEY, POLY_PASSPHRASE) " +
      "derived from your own key — see https://docs.polymarket.com/api-reference/authentication",
    body: {
      order: { ...order, signature: "<your 0x… signature>" },
      owner: "<your api key>",
      orderType: "GTC",
    },
  };
}

/* -------------------------------- monitoring ------------------------------- */

export interface PositionView {
  conditionId: string;
  question: string;
  outcome: string;
  size: number;
  avgPrice: number;
  currentValue: number;
  pnlUsdc: number;
  redeemable: boolean;
}

/** Live positions for a wallet, straight from Polymarket's public data API. */
export async function positions(wallet: string): Promise<PositionView[]> {
  const rows = await getJson(
    `https://data-api.polymarket.com/positions?user=${encodeURIComponent(wallet)}&sizeThreshold=0.1`
  ).catch(() => []);
  return (Array.isArray(rows) ? rows : []).map((p: any) => ({
    conditionId: String(p.conditionId ?? ""),
    question: String(p.title ?? p.slug ?? ""),
    outcome: String(p.outcome ?? ""),
    size: Number(p.size ?? 0),
    avgPrice: Number(p.avgPrice ?? 0),
    currentValue: Number(p.currentValue ?? 0),
    pnlUsdc: Number(p.cashPnl ?? 0),
    redeemable: Boolean(p.redeemable),
  }));
}

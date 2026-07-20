/**
 * Flip buyer agent — the customer side of the ASP.
 *
 * This is exactly what an OKX.AI agent does when it calls Flip: it discovers
 * a market, quotes a position, hits the x402 gate, signs a USDT payment on
 * X Layer, and retries to receive the ticket. We run this against our own
 * deployed endpoint to prove the whole money path end to end BEFORE listing.
 *
 * The x402 "exact" EVM scheme (coinbase/x402): the client signs an
 * EIP-3009 `transferWithAuthorization` (EIP-712 typed data) authorizing the
 * facilitator to pull `maxAmountRequired` of USDT from the buyer to `payTo`.
 * The signed authorization is base64-JSON in the `X-PAYMENT` header; the
 * facilitator verifies + settles on-chain.
 *
 * Usage:
 *   BUYER_PK=0x…            # buyer wallet private key (funded: USDT + a little OKB)
 *   FLIP_API=https://api.onflip.xyz
 *   npx tsx agent/buyer.ts single "will there be no change in fed rates" 5
 *   npx tsx agent/buyer.ts nl "$5 the fed holds and btc clears 130k"
 *   npx tsx agent/buyer.ts market fed        # just search
 */

import {
  createWalletClient,
  http,
  parseAbi,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const API = process.env.FLIP_API ?? "https://api.onflip.xyz";
const X_LAYER_CHAIN_ID = 196;

/* ------------------------------- helpers -------------------------------- */

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

function log(label: string, obj: unknown) {
  console.log(`\n\x1b[1m${label}\x1b[0m`);
  console.log(typeof obj === "string" ? obj : JSON.stringify(obj, null, 2));
}

/* --------------------------- x402 payment sign --------------------------- */

interface Accepts {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  asset: Address;
  payTo: Address;
  maxTimeoutSeconds: number;
}

/**
 * Build + sign the x402 `exact` EVM payment payload (EIP-3009).
 * Returns the base64 X-PAYMENT header value.
 */
async function signPayment(accepts: Accepts, pk: Hex): Promise<string> {
  const account = privateKeyToAccount(pk);
  const wallet = createWalletClient({ account, transport: http() });

  const now = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(now - 60);
  const validBefore = BigInt(now + accepts.maxTimeoutSeconds);
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32))) as Hex;

  // USDT (EIP-3009) EIP-712 domain on X Layer. name/version follow the
  // deployed token; "USD Coin"/"2" is the common default — override via env
  // if the X Layer USDT metadata differs.
  const domain = {
    name: process.env.USDT_EIP712_NAME ?? "USD Coin",
    version: process.env.USDT_EIP712_VERSION ?? "2",
    chainId: X_LAYER_CHAIN_ID,
    verifyingContract: accepts.asset,
  } as const;

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  } as const;

  const authorization = {
    from: account.address,
    to: accepts.payTo,
    value: BigInt(accepts.maxAmountRequired),
    validAfter,
    validBefore,
    nonce,
  };

  const signature = await wallet.signTypedData({
    account,
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message: authorization,
  });

  const payload = {
    x402Version: 1,
    scheme: accepts.scheme,
    network: accepts.network,
    payload: {
      signature,
      authorization: {
        from: authorization.from,
        to: authorization.to,
        value: authorization.value.toString(),
        validAfter: authorization.validAfter.toString(),
        validBefore: authorization.validBefore.toString(),
        nonce,
      },
    },
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/* --------------------------------- flows --------------------------------- */

async function place(quoteId: string): Promise<void> {
  const pk = process.env.BUYER_PK as Hex | undefined;

  // 1) probe → expect 402 with terms
  const probe = await api("/place", { method: "POST", body: JSON.stringify({ quoteId }) });
  if (probe.status !== 402) {
    log(`place → ${probe.status} (expected 402)`, await probe.json());
    return;
  }
  const terms = (await probe.json()) as { accepts: Accepts[] };
  const accepts = terms.accepts[0];
  log("402 Payment Required — x402 terms", {
    network: accepts.network,
    amountUSDT: (Number(accepts.maxAmountRequired) / 1e6).toFixed(2),
    asset: accepts.asset,
    payTo: accepts.payTo,
  });

  if (!pk) {
    log("no BUYER_PK set", "Set BUYER_PK to a funded X Layer wallet to sign + settle the payment.");
    return;
  }

  // 2) sign the EIP-3009 authorization
  const xPayment = await signPayment(accepts, pk);
  log("signed X-PAYMENT (base64, truncated)", xPayment.slice(0, 80) + "…");

  // 3) retry with payment → expect 201 ticket
  const paid = await api("/place", {
    method: "POST",
    headers: { "X-PAYMENT": xPayment },
    body: JSON.stringify({ quoteId }),
  });
  log(`place + X-PAYMENT → ${paid.status}`, await paid.json());
}

async function quoteSingle(query: string, stakeUsd: number, side: "yes" | "no"): Promise<void> {
  const res = await api(`/markets?q=${encodeURIComponent(query)}&limit=1`);
  const { markets } = (await res.json()) as { markets: { venue: string; id: string; question: string; yesPrice: number }[] };
  if (!markets.length) return log("no market found", query);
  const m = markets[0];
  log("market", `[${m.venue}] ${m.question}  (yes ${m.yesPrice})`);

  const q = await api("/quote", {
    method: "POST",
    body: JSON.stringify({ stakeUsd, legs: [{ venue: m.venue, id: m.id, side }] }),
  });
  const quote = (await q.json()) as { quoteId: string; type: string; offeredMultiplier: number; potentialPayoutUsd: number; totalChargeUsd: number };
  log("quote (single position)", quote);
  if (quote.quoteId) await place(quote.quoteId);
}

async function quoteNl(text: string): Promise<void> {
  const r = await api("/nl/quote", { method: "POST", body: JSON.stringify({ text }) });
  const parsed = (await r.json()) as { engine?: string; legs?: unknown[]; quote?: { quoteId: string; type: string; offeredMultiplier: number } };
  log("nl → quote", parsed);
  if (parsed.quote?.quoteId) await place(parsed.quote.quoteId);
}

async function searchOnly(query: string): Promise<void> {
  const res = await api(`/markets?q=${encodeURIComponent(query)}&limit=6`);
  const { markets } = (await res.json()) as { markets: { venue: string; id: string; question: string; yesPrice: number }[] };
  log(`markets matching "${query}"`, markets.map((m) => `[${m.venue}] ${m.question} — yes ${m.yesPrice} — ${m.id}`));
}

/* --------------------------------- main ---------------------------------- */

async function main() {
  const [cmd, arg, arg2] = process.argv.slice(2);
  console.log(`\x1b[2mFlip buyer agent → ${API}\x1b[0m`);
  switch (cmd) {
    case "single":
      return quoteSingle(arg ?? "fed rates", Number(arg2 ?? 5), "no");
    case "yes":
      return quoteSingle(arg ?? "fed rates", Number(arg2 ?? 5), "yes");
    case "nl":
      return quoteNl(arg ?? "$5 the fed holds and btc clears 130k");
    case "market":
      return searchOnly(arg ?? "fed");
    default:
      console.log(
        "usage:\n  npx tsx agent/buyer.ts market <query>\n" +
          "  npx tsx agent/buyer.ts single <query> <stakeUsd>   (buys NO)\n" +
          "  npx tsx agent/buyer.ts yes <query> <stakeUsd>      (buys YES)\n" +
          "  npx tsx agent/buyer.ts nl \"<sentence>\"\n" +
          "\nSet BUYER_PK=0x… (funded X Layer wallet) to sign + settle the payment."
      );
  }
}

void main();

// (parseAbi kept available for a future on-chain balance preflight)
void parseAbi;

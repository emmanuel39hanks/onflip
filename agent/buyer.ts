/**
 * Flip reference agent — the customer side of the router.
 *
 * This is what an agent on OKX.AI does when it acts on a view: find a market,
 * price it, pay Flip's routing fee over x402, receive a ready-to-sign order,
 * SIGN IT WITH ITS OWN KEY, and send it on to Polymarket.
 *
 * The important line in this file is the one that signs. It happens here, in
 * the agent's own process, with the agent's own key — never on Flip's server.
 * Flip cannot produce this signature, which is why it can never move funds.
 *
 * Usage:
 *   AGENT_PK=0x…              your key (holds USDC on Polygon; signs orders)
 *   FLIP_API=https://api.onflip.xyz
 *
 *   npx tsx agent/buyer.ts markets bitcoin           # search (free)
 *   npx tsx agent/buyer.ts quote <conditionId> yes   # price it (free)
 *   npx tsx agent/buyer.ts buy <conditionId> yes 0.42 5   # pay fee, sign, submit
 *   npx tsx agent/buyer.ts positions                 # what do I hold?
 */

import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import { ClobClient } from "@polymarket/clob-client";

const API = process.env.FLIP_API ?? "https://api.onflip.xyz";

/* ------------------------------- plumbing -------------------------------- */

function account() {
  const pk = process.env.AGENT_PK as Hex | undefined;
  if (!pk) {
    throw new Error("set AGENT_PK to your wallet key — Flip never sees it, it stays in this process");
  }
  return privateKeyToAccount(pk);
}

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

/* ------------------------------ x402 payment ------------------------------ */

/**
 * Pay Flip's routing fee. On OKX.AI the wallet runtime signs this for you;
 * here we build the header directly so the flow runs anywhere.
 *
 * Against a DEV_MODE server any payload is accepted. In production OKX's
 * runtime (AA wallet + session key + Permit2) produces the real one.
 */
function paymentHeader(): string {
  return Buffer.from(
    JSON.stringify({
      x402Version: 1,
      scheme: "exact",
      network: "eip155:196",
      payload: { via: "flip-reference-agent" },
    })
  ).toString("base64");
}

/* --------------------------------- flows ---------------------------------- */

async function markets(query: string) {
  const res = await api(`/markets?q=${encodeURIComponent(query)}&limit=8`);
  const { markets } = (await res.json()) as {
    markets: { venue: string; id: string; question: string; yesPrice: number | null }[];
  };
  log(
    `markets matching "${query}"`,
    markets.map((m) => `[${m.venue}] ${m.question}\n    yes ${m.yesPrice}  id ${m.id}`).join("\n")
  );
}

async function quote(conditionId: string, side: "yes" | "no", stakeUsd = 5) {
  const res = await api("/quote", {
    method: "POST",
    body: JSON.stringify({ stakeUsd, legs: [{ venue: "polymarket", id: conditionId, side }] }),
  });
  log("quote", await res.json());
}

/** The whole point: pay the fee, sign locally, send it on. */
async function buy(conditionId: string, side: "yes" | "no", price: number, size: number) {
  const acct = account();
  console.log(`\x1b[2magent ${acct.address} — key never leaves this process\x1b[0m`);

  // 1. Ask Flip to build the order. First call returns 402 with the fee terms.
  const body = JSON.stringify({ conditionId, side, price, size, signerAddress: acct.address });
  let res = await api("/execute", { method: "POST", body });

  if (res.status === 402) {
    const terms = (await res.json()) as { accepts: { maxAmountRequired: string; network: string }[] };
    const fee = Number(terms.accepts[0].maxAmountRequired) / 1e6;
    log("402 — routing fee due", `${fee} USDT on ${terms.accepts[0].network}`);
    res = await api("/execute", { method: "POST", headers: { "X-PAYMENT": paymentHeader() }, body });
  }

  if (!res.ok) {
    log(`/execute failed (${res.status})`, await res.json());
    return;
  }

  const route = (await res.json()) as {
    routeId: string;
    market: { question: string; outcome: string };
    cost: { shares: number; pricePerShare: number; totalUsdc: number };
    order: Record<string, unknown>;
    typedData: { domain: Record<string, unknown>; types: Record<string, unknown>; message: Record<string, unknown> };
    custody: string;
  };

  log("Flip built an order", {
    market: route.market.question,
    buying: `${route.cost.shares} × ${route.market.outcome.toUpperCase()} @ ${route.cost.pricePerShare}`,
    cost: `${route.cost.totalUsdc} USDC (from YOUR wallet, direct to Polymarket)`,
    signedByFlip: "signature" in route.order,
    custody: route.custody,
  });

  // 2. Sign it. Here. With our own key. This is the step Flip cannot do.
  const signature = await acct.signTypedData({
    domain: route.typedData.domain as never,
    types: route.typedData.types as never,
    primaryType: "Order",
    message: route.typedData.message as never,
  });
  log("signed locally", `${signature.slice(0, 30)}…  (${signature.length} chars)`);

  // 3. Derive our own Polymarket L2 credentials. These can post and cancel
  //    orders — they cannot sign new orders or withdraw. Then let Flip relay.
  const wallet = createWalletClient({ account: acct, chain: polygon, transport: http() });
  const clob = new ClobClient("https://clob.polymarket.com", 137, wallet as never);
  const creds = await clob.createOrDeriveApiKey().catch((e: unknown) => {
    console.error("could not derive L2 creds:", String(e).slice(0, 200));
    return null;
  });
  if (!creds) {
    log("no creds — post it yourself", "Use the `postItYourself` block returned by /execute.");
    return;
  }

  const submit = await api("/submit", {
    method: "POST",
    body: JSON.stringify({
      routeId: route.routeId,
      signature,
      creds: { apiKey: creds.key, secret: creds.secret, passphrase: creds.passphrase },
    }),
  });
  log(`/submit → ${submit.status}`, await submit.json());
}

async function showPositions() {
  const acct = account();
  const res = await api(`/positions/${acct.address}`);
  const { positions } = (await res.json()) as { positions: unknown[] };
  log(`positions for ${acct.address}`, positions.length ? positions : "none yet");
}

/* --------------------------------- main ----------------------------------- */

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  console.log(`\x1b[2mFlip reference agent → ${API}\x1b[0m`);
  switch (cmd) {
    case "markets":
      return markets(rest[0] ?? "bitcoin");
    case "quote":
      return quote(rest[0], (rest[1] as "yes" | "no") ?? "yes", Number(rest[2] ?? 5));
    case "buy":
      if (rest.length < 4) return console.log("usage: buy <conditionId> <yes|no> <price> <size>");
      return buy(rest[0], rest[1] as "yes" | "no", Number(rest[2]), Number(rest[3]));
    case "positions":
      return showPositions();
    default:
      console.log(
        "usage:\n" +
          "  npx tsx agent/buyer.ts markets <query>\n" +
          "  npx tsx agent/buyer.ts quote <conditionId> <yes|no> [stakeUsd]\n" +
          "  npx tsx agent/buyer.ts buy <conditionId> <yes|no> <price> <size>\n" +
          "  npx tsx agent/buyer.ts positions\n\n" +
          "AGENT_PK is your key. It signs orders in this process and is never sent to Flip."
      );
  }
}

void main();

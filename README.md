# Flip

**The execution router for prediction markets, on the OKX.AI agent marketplace.**

Research agents surface mispriced odds. Flip turns that view into a real
position on **Polymarket**, with **Kalshi** priced alongside for comparison —
and it does so **without ever holding your funds**.

Flip finds the market, prices your size against the live order book, and builds
a ready-to-sign order. **You** sign it with your own key. The position lands in
**your** wallet. Flip's only revenue is a flat **$0.02 routing fee** paid in
USDT on X Layer over x402, plus a Polymarket builder fee of **0 bps**.

- **Live API** — https://api.onflip.xyz · `GET /` for the manifest
- **Site, docs, playground** — https://onflip.xyz

```
view ──▶ /markets ──▶ /quote ──▶ /execute ($0.02) ──▶ YOU SIGN ──▶ /submit ──▶ position in your wallet
```

## Why it cannot take your money

Polymarket separates two powers:

| Capability | Your private key | What Flip has |
|---|---|---|
| Create and sign an order | yes | **no** |
| Post an already-signed order | yes | yes |
| Cancel orders, read balances | yes | yes |
| Withdraw funds | yes | **no** |

Flip operates strictly at the posting level. `src/router/polymarket.ts` drives
Polymarket's own `OrderBuilder` with a `CapturingSigner` — an object that holds
no key, records the EIP-712 payload that needs signing, and returns a
placeholder the exchange rejects. There is no key material in the process.

Every order returned by `/execute` is unsigned; check for yourself. The response
also includes a `postItYourself` block, so the relay is optional.

## Endpoints

| Endpoint | Cost | What it does |
|---|---|---|
| `GET /` | free | service manifest |
| `GET /markets?q=` | free | unified search across Polymarket and Kalshi |
| `POST /quote` | free | price a view against real book depth |
| `POST /nl/quote` | free | plain English → matched markets → quote (0G Compute) |
| `POST /execute` | **$0.02** | unsigned order + the EIP-712 payload to sign |
| `POST /submit` | free | relay the order you signed |
| `GET /positions/:wallet` | free | live positions, value and PnL |

Full schema at `GET /openapi.json`.

## Run it locally

```bash
pnpm install
cp .env.example .env        # DEV_MODE=1 simulates the fee payment
pnpm start                  # :8080
pnpm test                   # router + pricing tests

curl 'localhost:8080/markets?q=fed'
```

## The reference agent

`agent/buyer.ts` is the customer side — it does exactly what an OKX.AI agent
does, including signing locally with its own key.

```bash
AGENT_PK=0x…  FLIP_API=http://localhost:8080 \
  npx tsx agent/buyer.ts buy <conditionId> yes 0.42 10
```

To trade for real you need a funded Polymarket account (deposit once at
polymarket.com to create the proxy wallet that holds collateral), then pass
`funderAddress` and `signatureType: 2`.

## Layout

```
src/
  server.ts             HTTP surface + manifest
  router/polymarket.ts  order building, relay, positions — the core
  x402.ts               402 gate for the routing fee
  nl.ts                 natural language → markets (0G, TEE-attested)
  openapi.ts            OpenAPI 3.1 served at /openapi.json
  ratelimit.ts          per-IP limits + a daily model budget
  parlay/pricing.ts     deterministic multiplier engine
  venues/               Polymarket + Kalshi adapters (book-walking)
agent/buyer.ts          self-custody reference agent
web/                    Next.js landing, docs, playground
```

## Venues

**Polymarket** is executable — orders route and settle there. **Kalshi** is
read-only: submitting orders on a customer's behalf requires CFTC registration
as an FCM or introducing broker, which no router holds. We price it alongside so
you can see when it is the better venue.

## Roadmap

- Sequential plans: roll a winning position into the next leg
- Simultaneous multi-leg parlays, which require an escrow counterparty
- Verified builder tier (higher relay limits, volume rewards)

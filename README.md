# Flip

**An agent-callable execution ASP for prediction markets, on the OKX.AI marketplace.**

Research agents surface conviction. Flip turns it into a position. Any agent (or a
human with `curl`) can buy a single outcome on **Polymarket or Kalshi**, or combine up
to six into one leveraged **parlay** — priced deterministically and settled by a single
payment. Quotes are free; placing is paid over **x402 on X Layer** (`eip155:196`), and
the payment *is* the stake: one USDT transfer funds the position and the fee in one hop.

- **Live API** — https://api.onflip.xyz  ·  `GET /` for the manifest
- **Site / docs / playground** — https://onflip.xyz

```
 conviction ──▶ /markets (search) ──▶ /quote (price, free) ──▶ /place (x402, paid) ──▶ ticket
```

## Endpoints

| Endpoint | Cost | What it does |
|---|---|---|
| `GET /` | free | service manifest (discovery) |
| `GET /markets?q=fed` | free | unified live search across both venues |
| `POST /quote` | free | `{ legs, stakeUsd }` → multiplier, payout, `quoteId` (valid 90s). 1 leg = single position, 2–6 = parlay |
| `POST /nl/quote` | free | `{ text }` → natural language → quoted position (0G-hosted parsing, keyword fallback) |
| `POST /place` | **x402** | `{ quoteId }` — 402 asks for stake + 1% in USDT on X Layer; the paid retry returns the ticket |
| `GET /position/:id` | free | ticket status (legs resolve via venue data; a watcher settles) |

Aliases `/parlay/quote`, `/parlay/place`, `/parlay/:id` also work. Full schema at
`GET /openapi.json`.

## Pricing (deterministic, published)

```
fair     = Π 1/price_i              live executable prices — order books walked, not mids
haircut  = 0.9 ^ same-category-pairs   correlation guard; duplicate markets rejected
offered  = fair × haircut × (1 − 7% edge)
caps     = 6 legs · $50 stake · 100× · $1,000 payout
```

Every quote returns fair vs offered multiplier side by side — no hidden vig.

## Run it locally

```bash
pnpm install
cp .env.example .env        # DEV_MODE=1 by default: simulates payment, no keys needed
pnpm start                  # :8080
pnpm test                   # deterministic pricing tests

curl 'localhost:8080/markets?q=fed'
curl -X POST localhost:8080/quote -H 'Content-Type: application/json' \
  -d '{"stakeUsd":5,"legs":[{"venue":"polymarket","id":"<conditionId>","side":"no"}]}'
# → quoteId; POST /place with it → 402 terms → pay on X Layer → retry with X-PAYMENT → ticket
```

Set the OKX facilitator keys and `DEV_MODE=0` to settle for real (see `.env.example`).

## Test the money path (buyer agent)

`agent/buyer.ts` is the customer side — it does exactly what an OKX.AI agent does:
discover a market, quote, hit the 402, and read back the payment terms.

```bash
FLIP_API=https://api.onflip.xyz npx tsx agent/buyer.ts market fed
FLIP_API=https://api.onflip.xyz npx tsx agent/buyer.ts single "will there be no fed rate change" 5
```

The 402 handshake and terms are fully exercised here. Real on-chain settlement of USDT on
X Layer runs through the OKX Payment runtime (AA wallet + Session Key + Permit2), which is
what executes when a buyer calls Flip from the OKX.AI marketplace.

## Layout

```
src/
  server.ts          HTTP surface + manifest
  x402.ts            402 gate → verify/settle via OKX facilitator
  nl.ts              natural language → legs (0G Compute, TEE-attested; keyword fallback)
  openapi.ts         OpenAPI 3 doc served at /openapi.json
  ratelimit.ts       per-IP limits + a global daily model budget (abuse guard)
  parlay/pricing.ts  deterministic multiplier engine (+ pricing.test.ts)
  parlay/tickets.ts  persisted ticket store + settlement watcher
  venues/            Polymarket + Kalshi adapters (public data; order books walked)
agent/buyer.ts       buyer-side reference agent
web/                 Next.js landing, GitBook-style docs, API playground
```

## Deployment

Two services from this repo: the API (`Dockerfile`) and the site (`web.Dockerfile`),
both on Railway behind `api.onflip.xyz` / `onflip.xyz`.

## Roadmap

- Treasury payouts on-chain (USDT on X Layer) at settlement
- Per-leg hedging on venue accounts (Polymarket CLOB / Kalshi API keys)
- Deeper venue coverage and live correlation modelling beyond the category haircut

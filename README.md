# Flip — parlay on anything

**An agent-callable ASP for the OKX.AI marketplace.** Other agents (or humans
with curl) combine prediction markets from **Polymarket and Kalshi** into one
leveraged position. Quotes are free; placing a ticket is paid via **x402 on
X Layer (eip155:196)** — and the payment *is* the stake: one USDT transfer
funds the position and the fee in a single hop. Research agents on OKX.AI
surface conviction; Flip turns it into a position. No manual hop to a market.

## Endpoints

| Endpoint | Cost | What it does |
|---|---|---|
| `GET /` | free | service manifest |
| `GET /markets?q=fed` | free | unified live search across both venues |
| `POST /parlay/quote` | free | `{ legs:[{venue,id,side}], stakeUsd }` → multiplier, payout, `quoteId` (90s) |
| `POST /parlay/place` | x402 | `{ quoteId }` — 402 asks for stake+1% in USDT on X Layer; paid retry returns the ticket |
| `GET /parlay/:id` | free | ticket status (legs resolve via venue data; watcher settles) |
| `GET /tickets` | free | audit trail |

## Pricing (deterministic, published)

```
fair       = Π 1/price_i          (live executable prices — order books walked, not mids)
haircut    = 0.9 ^ same-category-pairs   (correlation guard; duplicate markets rejected)
offered    = fair × haircut × (1 − 7% edge)
caps       = 6 legs · $50 stake · 100x · $1,000 payout
```

The quote shows fair vs offered side by side — no hidden vig.

## Try it

```bash
pnpm install && cp .env.example .env && pnpm start
curl 'localhost:8080/markets?q=fed'
curl -X POST localhost:8080/parlay/quote -H 'Content-Type: application/json' \
  -d '{"stakeUsd":5,"legs":[{"venue":"polymarket","id":"<conditionId>","side":"no"},
                            {"venue":"kalshi","id":"KXFED-27APR-T4.25","side":"yes"}]}'
# → 402 with payment terms; retry with X-PAYMENT after paying on X Layer
```

`DEV_MODE=1` simulates payment acceptance for local testing.

## Architecture

- **Venue adapters** (`src/venues/`) — public data only: Polymarket Gamma +
  CLOB books, Kalshi orderbooks (flagship series seeded). Quotes walk real
  depth for the requested size.
- **x402 gate** (`src/x402.ts`) — spec-compliant 402 → `X-PAYMENT` →
  verify/settle via OKX's facilitator (`/api/v6/pay/x402`).
- **Tickets** (`src/parlay/tickets.ts`) — persisted, idempotent, settled by
  a watcher polling venue resolutions. Won tickets record the payout owed
  to the payer address.

## Roadmap

- Treasury payouts on-chain (USDT on X Layer) at settlement
- Per-leg hedging on venue accounts (Polymarket CLOB / Kalshi API keys)
- Single-leg `/execute` for straight YES/NO buys
- 0G-hosted NL parsing: "$5 says the Fed cuts and BTC clears 130k" → legs

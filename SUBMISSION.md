# Flip — OKX.AI listing resubmission

Paste-ready content for the ASP listing (agent #6969). The first review was
rejected for "missing a complete description, parameter details, and usage
examples" — every one of those is filled in below.

- **Live API:** https://api.onflip.xyz (manifest at `GET /`, spec at `/openapi.json`)
- **Site & docs:** https://onflip.xyz · https://onflip.xyz/docs
- **Repo:** https://github.com/emmanuel39hanks/onflip

---

## Name

Flip

## Short description (one line)

The execution router for prediction agents — turn a view into a real Polymarket
position without ever giving up custody of your funds.

## Full description

Flip is an execution router for prediction markets.

OKX.AI already has agents that surface mispriced odds, undervalued markets and
emerging alpha. What was missing is execution: a way to turn that research into
an actual YES or NO position without a human manually hopping to the market.
Flip is that step.

Give Flip a market and a view. It searches Polymarket and Kalshi, prices your
size against real order-book depth (never midpoints), and returns a
ready-to-sign Polymarket order together with the exact EIP-712 payload for it.
You sign that payload with your own key, and Flip relays it to the exchange.

**You keep custody at every point.** Your stake never reaches Flip — it moves
from your own wallet straight to Polymarket when your signed order fills, and
the position lands in your wallet. This is enforced by architecture, not by
promise: Polymarket separates order *signing* (requires your private key) from
order *posting* (requires only API credentials), and Flip operates strictly at
the posting level. Internally our order builder is driven by a signer object
that holds no key material — it records the payload that needs signing and
returns a placeholder the exchange would reject. There is nothing in our
process capable of authorising a transfer.

Flip's only revenue is a flat **$0.02 routing fee** per executed order, paid in
USDT on X Layer over x402. Our Polymarket builder fee is **0 bps** — we take no
percentage of your trade, and both numbers are disclosed on every `/execute`
response before you sign anything.

Market search, pricing and position tracking are free and need no account.

**Venues:** Polymarket is executable — orders route and settle there. Kalshi is
priced alongside for comparison but is read-only: submitting orders on a
customer's behalf at Kalshi requires CFTC registration as an FCM or introducing
broker, which no router holds.

## Category

Finance / Trading

## Endpoint

https://api.onflip.xyz

## Service type

A2MCP — HTTP JSON API, x402-metered

---

## Endpoints, parameters, and examples

### 1. `GET /markets` — search live markets (free)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | no | Search text, e.g. `fed`, `bitcoin` |
| `venue` | string | no | `polymarket` or `kalshi` to restrict results |
| `limit` | integer | no | 1–25, default 10 |

```bash
curl 'https://api.onflip.xyz/markets?q=fed&limit=3'
```
```json
{
  "markets": [
    {
      "venue": "polymarket",
      "id": "0x7018d32e315a69c0537fc42f8e574ee4a24b3babaae302cda79fb0c355e0df1a",
      "question": "Will the Fed cut rates in July?",
      "yesPrice": 0.42,
      "noPrice": 0.58,
      "endDate": "2026-08-01T04:00:00Z"
    }
  ]
}
```

### 2. `POST /quote` — price a view (free)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `legs` | array | yes | 1–6 of `{ venue, id, side }`; `side` is `yes` or `no` |
| `stakeUsd` | number | no | Size you intend to trade, default 5 |

```bash
curl -X POST https://api.onflip.xyz/quote \
  -H 'Content-Type: application/json' \
  -d '{"stakeUsd":5,"legs":[{"venue":"polymarket","id":"0x7018…","side":"yes"}]}'
```
```json
{
  "quoteId": "e8accb18d4bf3d19",
  "validForSeconds": 90,
  "type": "single",
  "fairMultiplier": 2.38,
  "offeredMultiplier": 2.21,
  "potentialPayoutUsd": 11.05,
  "executable": ["0x7018…"],
  "nextStep": "POST /execute with { conditionId, side, price, size, signerAddress }"
}
```

### 3. `POST /execute` — build a signable order (x402, $0.02)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `conditionId` | string | yes | Polymarket condition id from `/markets` |
| `side` | string | yes | `yes` or `no` |
| `price` | number | yes | Limit price per share, 0–1, snapped to the market's tick size |
| `size` | number | yes | Number of shares; cost = `size × price` USDC |
| `signerAddress` | string | yes | Your wallet — signs the order, receives the position |
| `funderAddress` | string | no | Your Polymarket proxy address, if different |
| `signatureType` | integer | no | 0 = EOA (default), 1 = Magic/email proxy, 2 = Gnosis Safe, 3 = EIP-1271 |

Without an `X-PAYMENT` header this returns **HTTP 402** with the fee terms
(also base64-encoded in the `X-PAYMENT-REQUIRED` response header for the OKX
Payment SDK):

```json
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:196",
    "maxAmountRequired": "20000",
    "asset": "0x1E4a5963aBFD975d8c9021cE480b42188849D41d",
    "payTo": "0x19d368e389fe491a578adbfb08f353780d239375",
    "resource": "/execute#0x7018…:yes",
    "maxTimeoutSeconds": 120
  }]
}
```

Retry with the payment header to receive the order:

```bash
curl -X POST https://api.onflip.xyz/execute \
  -H 'Content-Type: application/json' \
  -H "X-PAYMENT: $SIGNED_PAYMENT" \
  -d '{"conditionId":"0x7018…","side":"yes","price":0.42,"size":10,
       "signerAddress":"0xYourWallet","funderAddress":"0xYourProxy","signatureType":2}'
```
```json
{
  "routeId": "13d922f520bca92c",
  "validForSeconds": 600,
  "cost": { "shares": 10, "pricePerShare": 0.42, "totalUsdc": 4.2 },
  "builderFee": { "takerBps": 0, "makerBps": 0, "estimatedUsdc": 0,
                  "note": "Flip takes 0% of your trade." },
  "order": { "salt": "…", "maker": "0xYourWallet", "…": "no signature field" },
  "typedData": { "domain": {…}, "types": {…}, "primaryType": "Order", "message": {…} },
  "postItYourself": { "method": "POST", "url": "https://clob.polymarket.com/order", "…": "…" },
  "custody": "Flip did not sign this order and holds no key. It is inert until you sign it."
}
```

### 4. Sign locally — the step Flip cannot do

```js
const signature = await account.signTypedData({
  domain: route.typedData.domain,
  types: route.typedData.types,
  primaryType: "Order",
  message: route.typedData.message,
});
```

### 5. `POST /submit` — relay your signed order (free)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `routeId` | string | yes | From `/execute` |
| `signature` | string | yes | 0x-prefixed 65-byte signature of `typedData` |
| `creds` | object | yes | Your own Polymarket L2 credentials `{ apiKey, secret, passphrase }` — these can post and cancel orders only; they cannot sign orders or withdraw funds |

```bash
curl -X POST https://api.onflip.xyz/submit \
  -H 'Content-Type: application/json' \
  -d '{"routeId":"13d922f5…","signature":"0x…","creds":{...}}'
```
```json
{ "submitted": true, "result": {...}, "trackAt": "/positions/0xYourWallet" }
```

Using this endpoint is optional — `/execute` returns a `postItYourself` block
with the raw HTTP call if you would rather post directly.

### 6. `POST /nl/quote` — natural language (free)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `text` | string | yes | Plain English view, max 400 chars |

```bash
curl -X POST https://api.onflip.xyz/nl/quote \
  -H 'Content-Type: application/json' \
  -d '{"text":"$5 says the Fed holds rates in July"}'
```

Uses 0G Compute (TEE-attested inference) to map the sentence onto live markets.
The model only ever picks from real markets we supply — it never prices, never
signs, never touches funds.

### 7. `GET /positions/:wallet` — track holdings (free)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `wallet` | string | yes | 0x address, in the path |

```bash
curl https://api.onflip.xyz/positions/0xYourWallet
```

---

## What a caller needs

| To do this | You need |
|---|---|
| Search and quote | Nothing |
| Execute an order | USDT on X Layer (eip155:196) for the $0.02 fee; USDC in a funded Polymarket account; a key that signs EIP-712 |

A bare wallet cannot trade on Polymarket. Deposit USDC once at polymarket.com —
this creates the proxy wallet holding your collateral — then pass its address as
`funderAddress` with `signatureType: 2`.

## Errors

| Status | Meaning |
|---|---|
| 400 | Malformed request — a required parameter is missing or invalid |
| 402 | Routing fee required; retry with `X-PAYMENT` |
| 410 | Route expired (routes last 10 minutes, quotes 90 seconds) |
| 422 | Venue rejected — closed market, insufficient depth, or unfunded wallet. The message explains the fix |
| 429 | Rate limited — 30 req/min, 5 natural-language quotes/min |

## Payment summary

- **Protocol:** x402 · **Network:** X Layer (`eip155:196`) · **Asset:** USDT
- **Model:** flat $0.02 per executed order — not a percentage
- **Builder fee:** 0 bps, independently verifiable at
  `clob.polymarket.com/fees/builder-fees/0x875ceda8500a1a49deadaabd3cbeb514ac668888965fc0f25122cd5871d737d9`
- Only `POST /execute` is paid. Everything else is free.

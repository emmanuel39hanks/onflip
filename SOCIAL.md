# Flip — social copy

Plain sentences, no fragment taglines. Everything below is factually accurate
as of the router rewrite: self-custody, $0.02 flat fee, 0 bps builder fee,
Polymarket executable, Kalshi read-only.

---

## X bio (≤160 chars)

> An API for agents to bet on prediction markets. We build and route the order,
> you sign it with your own key and keep your funds. On @XLayerOfficial.

**Alternate (names the marketplace):**

> The execution router for prediction agents. We build the order, you sign it,
> your funds never touch us. Live on @okx AI · @XLayerOfficial.

---

## Launch thread

**1/**
> Most prediction-market agents can tell you what's mispriced. Almost none of
> them can actually place the trade.
>
> We built Flip to close that gap — and to do it without ever holding your money.
>
> onflip.xyz

**2/**
> The problem with "let an API trade for you" is obvious: you have to hand over
> your funds or your keys.
>
> So we built it the other way round. Flip prepares the order. You sign it. The
> position lands in your wallet. We never touch the stake.

**3/**
> This isn't a promise, it's how the code works.
>
> Polymarket splits signing an order (needs your private key) from posting one
> (needs only API credentials). Flip only ever operates at the posting level.
>
> There is no key in our process to sign or withdraw with.

**4/**
> The flow is four calls:
>
> 1. find a market across Polymarket and Kalshi
> 2. price it against the real order book, not midpoints
> 3. pay $0.02 → get an unsigned order + the payload to sign
> 4. sign it yourself, we relay it
>
> Steps 1, 2 and 4 are free.

**5/**
> What we charge: a flat two cents per routed order.
>
> What we take from your trade: nothing. Our Polymarket builder fee is 0 bps,
> and you can verify that yourself against Polymarket's public registry rather
> than taking our word for it.

**6/**
> One honest limitation: Kalshi is read-only.
>
> Routing someone else's order to Kalshi requires CFTC registration as a broker.
> Nobody has that. So we price Kalshi alongside Polymarket to show you the
> better venue, and execute where self-custody trading actually works.

**7/**
> Built on @okx AI as an Agent Service Provider, with fees settled over x402 on
> @XLayerOfficial. Market matching runs on @0G_labs Compute with TEE attestation.
>
> Docs and a live playground: onflip.xyz/docs

---

## Single launch post (if you'd rather not thread)

> Flip is live: an API that lets an agent turn a prediction-market view into a
> real position, without giving up custody.
>
> We build the order. You sign it with your own key. Your funds never reach us —
> we couldn't take them if we wanted to.
>
> $0.02 a trade, 0% of your position.
>
> onflip.xyz

---

## OKX hackathon post (include #OKXAI + demo video)

> We built Flip for the OKX.AI Genesis Hackathon.
>
> OKX.AI already has agents that find mispriced prediction markets. What was
> missing was execution — a way to act on that research without a human going
> to the market by hand.
>
> Flip is that step, and it's non-custodial: we build and relay the order, your
> key signs it, your wallet holds the position. A flat $0.02 per trade over x402
> on X Layer, and 0% of the trade itself.
>
> #OKXAI

---

## Demo video script (≤90 seconds)

| Time | On screen | Say |
|---|---|---|
| 0:00–0:10 | onflip.xyz hero | "Agents can spot a mispriced market. Acting on it usually means a human opens Polymarket and clicks buy. Flip removes that step." |
| 0:10–0:25 | terminal: `buyer.ts markets fed` | "The agent searches both Polymarket and Kalshi in one call, and prices its size against the real order book." |
| 0:25–0:40 | 402 response | "To execute, it pays two cents over x402 on X Layer. That's our entire fee — we take nothing from the trade." |
| 0:40–0:55 | `/execute` response, highlight `"signedByFlip": false` | "Flip returns an order with no signature on it. It authorises nothing. We hold no key, so we literally cannot sign it." |
| 0:55–1:10 | signing line + `/submit` | "The agent signs it locally with its own key, and we relay it to Polymarket." |
| 1:10–1:25 | `/positions/0x…` + Polymarket UI | "The position is in the agent's own wallet. Not ours. It was never ours." |
| 1:25–1:30 | onflip.xyz | "Flip. Your keys, your funds, your position." |

---

## Reply-bait / follow-ups

> Someone asked how we can claim we're unable to take funds rather than just
> promising not to.
>
> Our order builder is driven by a signer object with no private key in it. It
> records what needs signing and returns a placeholder the exchange rejects.
> The unsigned order is right there in the API response — check it yourself.

> A fair question: why charge a flat fee instead of a percentage?
>
> Because a percentage punishes the agents we most want — the ones placing many
> small automated trades. Two cents a call is legible and doesn't scale with
> your conviction.

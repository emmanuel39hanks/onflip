import type { Metadata } from "next";
import Link from "next/link";
import { FlipMark } from "@/components/FlipMark";

const API = "https://api.onflip.xyz";

export const metadata: Metadata = {
  title: "Documentation — Flip API",
  description:
    "Integrate Flip: quickstart, the custody model, signing orders, x402 payments, endpoints, rate limits.",
};

function Code({ children }: { children: string }) {
  return (
    <pre className="my-4 overflow-x-auto rounded-xl bg-[#1b1b1b] p-4 font-mono text-[12.5px] leading-[1.7] text-[#e7e7e7]">
      {children}
    </pre>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="display mb-4 mt-14 scroll-mt-24 border-b border-line pb-3 text-3xl tracking-tight first:mt-0"
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-8 text-lg font-bold tracking-tight">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="my-3 text-[15.5px] leading-relaxed text-[#4b4a4a]">{children}</p>;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 rounded-xl border border-line bg-mint px-5 py-4 text-[15px] leading-relaxed text-[#3c5c4e]">
      {children}
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-card px-2 py-0.5 font-mono text-sm">{children}</code>;
}

const NAV = [
  ["introduction", "Introduction"],
  ["custody", "Custody model"],
  ["prerequisites", "Prerequisites"],
  ["quickstart", "Quickstart"],
  ["signing", "Signing an order"],
  ["payments", "Payments (x402)"],
  ["endpoints", "Endpoints"],
  ["natural-language", "Natural language (0G)"],
  ["venues", "Venues & limits"],
  ["errors", "Errors & rate limits"],
] as const;

export default function DocsPage() {
  return (
    <div>
      <nav className="sticky top-0 z-50 border-b border-line bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <FlipMark height={20} />
            <span className="ml-2 rounded-md bg-mint px-2 py-0.5 text-xs font-bold text-green">
              Docs
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm font-semibold text-muted">
            <Link href="/playground" className="hover:text-ink">Playground</Link>
            <a href={`${API}/openapi.json`} className="hover:text-ink">OpenAPI</a>
          </div>
        </div>
      </nav>

      <div className="mx-auto flex max-w-7xl gap-10 px-6">
        {/* sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto py-10 lg:block">
          <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-widest text-muted">
            Documentation
          </p>
          {NAV.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="block rounded-lg px-3 py-2 text-[14px] font-medium text-[#4b4a4a] hover:bg-card hover:text-ink"
            >
              {label}
            </a>
          ))}
          <div className="mt-6 border-t border-line pt-4">
            <Link
              href="/playground"
              className="block rounded-lg px-3 py-2 text-[14px] font-semibold text-green hover:bg-card"
            >
              Try it live →
            </Link>
          </div>
        </aside>

        {/* content */}
        <article className="min-w-0 max-w-3xl flex-1 py-10">
          <H2 id="introduction">Introduction</H2>
          <P>
            Flip is an execution router for prediction markets. Research agents surface a view —
            a mispriced market, an edge, a conviction — and Flip turns it into a real position on{" "}
            <strong>Polymarket</strong>, with <strong>Kalshi</strong> priced alongside for
            comparison.
          </P>
          <P>
            The important part: <strong>you keep custody of your funds throughout</strong>. Flip
            finds the market, builds the order, and relays it. You sign it with your own key, and
            the position lands in your own wallet. Flip never receives your stake.
          </P>
          <P>
            Base URL: <Mono>{API}</Mono> · No API keys for reads · Machine-readable manifest at{" "}
            <Mono>GET /</Mono>
          </P>

          <H2 id="custody">Custody model</H2>
          <P>
            Polymarket separates authority into two levels, and that separation is what makes a
            trustless router possible:
          </P>
          <div className="my-5 overflow-hidden rounded-xl border border-line">
            <table className="w-full text-[14.5px]">
              <thead className="bg-card">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Capability</th>
                  <th className="px-4 py-3 font-semibold">Your private key</th>
                  <th className="px-4 py-3 font-semibold">What Flip has</th>
                </tr>
              </thead>
              <tbody className="text-[#4b4a4a]">
                {[
                  ["Create and sign an order", "Yes", "No"],
                  ["Post an already-signed order", "Yes", "Yes"],
                  ["Cancel orders, read balances", "Yes", "Yes"],
                  ["Withdraw funds", "Yes", "No"],
                ].map(([cap, key, flip]) => (
                  <tr key={cap} className="border-t border-line">
                    <td className="px-4 py-3">{cap}</td>
                    <td className="px-4 py-3">{key}</td>
                    <td className={`px-4 py-3 font-semibold ${flip === "No" ? "text-green" : ""}`}>
                      {flip}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            Flip operates strictly at the posting level. Internally, our order builder is driven by
            a signer object that holds no key material: it records the payload that needs signing
            and returns a placeholder that the exchange would reject. There is nothing in our
            process capable of authorising a transfer.
          </P>
          <Note>
            <strong>You never have to trust this claim.</strong> Every order we return is unsigned —
            check it yourself. And <Mono>/execute</Mono> includes a{" "}
            <Mono>postItYourself</Mono> block with the raw HTTP call, so you can skip our relay
            entirely and still use the router.
          </Note>

          <H2 id="prerequisites">Prerequisites</H2>
          <P>
            Searching and quoting are free and need nothing. To execute, you need three things:
          </P>
          <H3>1 · A funded Polymarket account</H3>
          <P>
            A bare wallet cannot trade. Deposit USDC once at{" "}
            <a className="font-semibold text-green" href="https://polymarket.com">
              polymarket.com
            </a>{" "}
            — this creates the proxy wallet that holds your collateral and positions. Pass its
            address as <Mono>funderAddress</Mono> and set{" "}
            <Mono>signatureType</Mono> to <Mono>2</Mono> (Gnosis Safe proxy) or{" "}
            <Mono>1</Mono> (email/Magic proxy).
          </P>
          <H3>2 · A key that can sign EIP-712</H3>
          <P>
            Any EVM key works — viem, ethers, or an agent wallet runtime. It stays in your process.
          </P>
          <H3>3 · A little USDT on X Layer</H3>
          <P>
            To pay the routing fee ($0.02 per executed order) over x402. X Layer gas is sponsored,
            so you do not need OKB.
          </P>

          <H2 id="quickstart">Quickstart</H2>
          <P>Find, price, pay, sign, submit.</P>
          <H3>1 · Find a market (free)</H3>
          <Code>{`curl '${API}/markets?q=fed'

# → { "markets": [ { "venue": "polymarket", "id": "0x8bf1…",
#      "question": "Will the Fed cut rates in July?",
#      "yesPrice": 0.42, "noPrice": 0.58 }, … ] }`}</Code>

          <H3>2 · Price it (free)</H3>
          <Code>{`curl -X POST ${API}/quote \\
  -H 'Content-Type: application/json' \\
  -d '{ "stakeUsd": 5,
        "legs": [{ "venue": "polymarket", "id": "0x8bf1…", "side": "yes" }] }'

# → { "quoteId": "e8accb18d4bf3d19", "validForSeconds": 90,
#     "fairMultiplier": 2.38, "offeredMultiplier": 2.21, … }`}</Code>

          <H3>3 · Get a signable order (x402)</H3>
          <Code>{`curl -X POST ${API}/execute \\
  -H 'Content-Type: application/json' \\
  -d '{ "conditionId": "0x8bf1…", "side": "yes",
        "price": 0.42, "size": 10,
        "signerAddress": "0xYourWallet",
        "funderAddress": "0xYourPolymarketProxy",
        "signatureType": 2 }'
# → 402 Payment Required (terms below)

curl -X POST ${API}/execute \\
  -H 'Content-Type: application/json' \\
  -H "X-PAYMENT: $SIGNED_PAYMENT" \\
  -d '{ … same body … }'
# → 200 { "routeId": "13d922f5…",
#         "cost": { "shares": 10, "pricePerShare": 0.42, "totalUsdc": 4.2 },
#         "builderFee": { "takerBps": 0, "estimatedUsdc": 0, … },
#         "order": { … },        // no signature — inert
#         "typedData": { … },    // sign this
#         "postItYourself": { … } }`}</Code>

          <H3>4 · Sign it locally, then submit</H3>
          <Code>{`const signature = await account.signTypedData({
  domain: route.typedData.domain,
  types: route.typedData.types,
  primaryType: "Order",
  message: route.typedData.message,
});

curl -X POST ${API}/submit \\
  -H 'Content-Type: application/json' \\
  -d '{ "routeId": "13d922f5…", "signature": "0x…",
        "creds": { "apiKey": "…", "secret": "…", "passphrase": "…" } }'
# → 201 { "submitted": true, "result": { … }, "trackAt": "/positions/0x…" }`}</Code>

          <H2 id="signing">Signing an order</H2>
          <P>
            <Mono>/execute</Mono> returns <Mono>typedData</Mono> — a standard EIP-712 payload for
            Polymarket&rsquo;s CTF Exchange. Sign it with your own key:
          </P>
          <Code>{`// viem
import { privateKeyToAccount } from "viem/accounts";
const account = privateKeyToAccount(process.env.AGENT_PK);
const signature = await account.signTypedData({
  domain: route.typedData.domain,
  types: route.typedData.types,
  primaryType: "Order",
  message: route.typedData.message,
});

// ethers v5
const signature = await signer._signTypedData(
  route.typedData.domain,
  { Order: route.typedData.types.Order },
  route.typedData.message,
);`}</Code>
          <P>
            The <Mono>creds</Mono> passed to <Mono>/submit</Mono> are your own Polymarket L2 API
            credentials, derived from your key with{" "}
            <Mono>createOrDeriveApiKey()</Mono>. They can post and cancel orders — they cannot sign
            new orders or withdraw. If you would rather not share even those, use the{" "}
            <Mono>postItYourself</Mono> block and post directly.
          </P>

          <H2 id="payments">Payments (x402)</H2>
          <P>
            Flip implements the x402 protocol for its routing fee. A <Mono>POST /execute</Mono>{" "}
            without payment returns HTTP 402 with exact terms. The fee is flat — it is not a
            percentage of your trade, and it is the only payment Flip receives.
          </P>
          <Code>{`HTTP/1.1 402 Payment Required
X-PAYMENT-REQUIRED: <base64 of this body>
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:196",                                  // X Layer
    "maxAmountRequired": "20000",                             // 0.02 USDT
    "asset": "0x1E4a5963aBFD975d8c9021cE480b42188849D41d",    // USDT
    "payTo": "0x…",
    "resource": "/execute#0x8bf1…:yes",
    "maxTimeoutSeconds": 120
  }]
}`}</Code>
          <P>
            Retry the same request with an <Mono>X-PAYMENT</Mono> header. On OKX.AI the wallet
            runtime builds and signs this for you. Flip verifies and settles through OKX&rsquo;s
            facilitator before returning the order.
          </P>
          <H3>What Flip earns</H3>
          <P>
            Two numbers, both disclosed on every <Mono>/execute</Mono> response: the flat{" "}
            <strong>$0.02 routing fee</strong>, and our <strong>builder fee of 0 bps</strong> —
            verifiable independently at{" "}
            <Mono>clob.polymarket.com/fees/builder-fees/&lt;code&gt;</Mono>. We take no percentage
            of your trade.
          </P>

          <H2 id="endpoints">Endpoints</H2>
          {[
            {
              m: "GET",
              p: "/markets?q=&venue=&limit=",
              cost: "free",
              d: "Unified search across Polymarket and Kalshi.",
              params: "q: search text · venue: polymarket | kalshi (optional) · limit: 1–25",
            },
            {
              m: "POST",
              p: "/quote",
              cost: "free",
              d: "Price a view against real order-book depth for your size.",
              params: "legs: [{ venue, id, side }] (1–6) · stakeUsd: number",
            },
            {
              m: "POST",
              p: "/nl/quote",
              cost: "free",
              d: "Plain English → matched markets → priced view.",
              params: "text: string (e.g. \"$5 says the Fed holds in July\")",
            },
            {
              m: "POST",
              p: "/execute",
              cost: "$0.02 (x402)",
              d: "Build a ready-to-sign order plus the EIP-712 payload.",
              params:
                "conditionId · side: yes|no · price: 0–1 · size: shares · signerAddress · funderAddress? · signatureType? (0 EOA, 1 proxy, 2 Safe, 3 EIP-1271)",
            },
            {
              m: "POST",
              p: "/submit",
              cost: "free",
              d: "Relay your signed order to Polymarket.",
              params: "routeId · signature: 0x… (65 bytes) · creds: { apiKey, secret, passphrase }",
            },
            {
              m: "GET",
              p: "/positions/:wallet",
              cost: "free",
              d: "Live positions, current value and PnL.",
              params: "wallet: 0x address in the path",
            },
          ].map((e) => (
            <div key={e.p} className="my-4 rounded-xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md bg-bg px-2 py-1 font-mono text-[11px] font-bold">
                  {e.m}
                </span>
                <span className="font-mono text-[14px] font-semibold">{e.p}</span>
                <span className="ml-auto rounded-md bg-bg px-2 py-1 font-mono text-[11px] text-muted">
                  {e.cost}
                </span>
              </div>
              <p className="mt-3 text-[15px] text-[#4b4a4a]">{e.d}</p>
              <p className="mt-2 font-mono text-[12.5px] leading-relaxed text-muted">{e.params}</p>
            </div>
          ))}

          <H2 id="natural-language">Natural language (0G)</H2>
          <P>
            <Mono>POST /nl/quote</Mono> maps a sentence to live markets using 0G Compute —
            TEE-attested inference on decentralised hardware. The model only ever selects from a
            candidate list of real markets we supply; it never prices, never signs, and never
            touches money. Pricing stays deterministic and published.
          </P>
          <Code>{`curl -X POST ${API}/nl/quote \\
  -H 'Content-Type: application/json' \\
  -d '{ "text": "$5 says the Fed holds rates in July" }'

# → { "interpretation": "Backing no rate change at the July meeting.",
#     "engine": "0g",
#     "provenance": { "provider": "0G Compute Network", "attestation": "TEE-attested (TeeTLS)" },
#     "legs": [ … ], "quote": { … } }`}</Code>
          <P>
            Model calls draw from a global daily budget. Past it, a deterministic keyword engine
            answers instead — the endpoint never degrades into an open LLM proxy.
          </P>

          <H2 id="venues">Venues &amp; limits</H2>
          <H3>Polymarket — executable</H3>
          <P>
            Orders are routed here. Prices come from the live CLOB, walked for your actual size.
            Each market has its own tick size and minimum order size; Flip fetches both and
            validates before building, so you get a clear error rather than an exchange rejection.
          </P>
          <H3>Kalshi — reference only</H3>
          <P>
            Kalshi prices appear in search and quotes so you can see when it is the better venue,
            but Flip cannot route orders there. Submitting orders on a customer&rsquo;s behalf at
            Kalshi requires CFTC registration as an FCM or introducing broker — a bar no router
            currently meets.
          </P>
          <Note>
            Polymarket restricts access in some jurisdictions, including the US. Where your agent
            trades is your responsibility.
          </Note>

          <H2 id="errors">Errors &amp; rate limits</H2>
          <div className="my-5 overflow-hidden rounded-xl border border-line">
            <table className="w-full text-[14.5px]">
              <thead className="bg-card">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Meaning</th>
                </tr>
              </thead>
              <tbody className="text-[#4b4a4a]">
                {[
                  ["400", "Malformed request — a required parameter is missing or invalid."],
                  ["402", "Routing fee required. Retry with an X-PAYMENT header."],
                  ["410", "Route expired. Routes are valid for 10 minutes; quotes for 90 seconds."],
                  ["422", "The venue rejected the order — insufficient depth, closed market, or an unfunded wallet. The message explains the fix."],
                  ["429", "Rate limited — 30 requests/minute, 5 natural-language quotes/minute."],
                ].map(([s, m]) => (
                  <tr key={s} className="border-t border-line">
                    <td className="px-4 py-3 font-mono font-semibold">{s}</td>
                    <td className="px-4 py-3">{m}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            Errors are plain English and actionable. A wallet with no Polymarket account, for
            instance, returns the exact steps to fix it rather than the exchange&rsquo;s terse
            rejection.
          </P>

          <div className="mt-16 flex flex-wrap gap-3 border-t border-line pt-8">
            <Link href="/playground" className="pill">
              <strong>Try it live</strong>
            </Link>
            <a href={`${API}/openapi.json`} className="pill-light relative">
              OpenAPI spec
            </a>
          </div>
        </article>
      </div>
    </div>
  );
}

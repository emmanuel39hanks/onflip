import type { Metadata } from "next";
import Link from "next/link";
import { FlipMark } from "@/components/FlipMark";

const API = "https://api.onflip.xyz";

export const metadata: Metadata = {
  title: "Documentation — Flip API",
  description: "Everything you need to integrate Flip: quickstart, x402 payments, endpoints, pricing model, rate limits.",
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
    <h2 id={id} className="serif mb-4 mt-14 scroll-mt-24 border-b border-line pb-3 text-3xl tracking-tight first:mt-0">
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

const NAV = [
  ["introduction", "Introduction"],
  ["quickstart", "Quickstart"],
  ["payments", "Payments (x402)"],
  ["endpoints", "Endpoints"],
  ["natural-language", "Natural language (0G)"],
  ["pricing", "Pricing model"],
  ["settlement", "Tickets & settlement"],
  ["limits", "Rate limits & errors"],
] as const;

export default function DocsPage() {
  return (
    <div>
      <nav className="sticky top-0 z-50 border-b border-line bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <FlipMark size={24} />
            <span className="text-lg font-extrabold tracking-tight">Flip</span>
            <span className="ml-2 rounded-md bg-mint px-2 py-0.5 text-xs font-bold text-green">Docs</span>
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
            <Link href="/playground" className="block rounded-lg px-3 py-2 text-[14px] font-semibold text-green hover:bg-card">
              Try it live →
            </Link>
          </div>
        </aside>

        {/* content */}
        <article className="min-w-0 max-w-3xl flex-1 py-10">
          <H2 id="introduction">Introduction</H2>
          <P>
            Flip is a paid API that lets any agent — or any developer with curl — combine live
            prediction markets from <strong>Polymarket</strong> and <strong>Kalshi</strong> into a
            single leveraged position. Quotes are free and priced from real order books. Placing a
            ticket is paid via <strong>x402</strong>: one USDT transfer on X Layer carries both the
            stake and the fee.
          </P>
          <P>
            Base URL: <code className="rounded bg-card px-2 py-0.5 font-mono text-sm">{API}</code> ·
            No API keys for reads · Machine-readable manifest at <code className="rounded bg-card px-2 py-0.5 font-mono text-sm">GET /</code>
          </P>

          <H2 id="quickstart">Quickstart</H2>
          <P>The whole lifecycle is three calls.</P>
          <H3>1 · Find your legs (free)</H3>
          <Code>{`curl '${API}/markets?q=fed'

# → { "markets": [ { "venue": "polymarket", "id": "0x8bf1…",
#      "question": "Will there be no change in Fed interest rates…",
#      "yesPrice": 0.9245, "noPrice": 0.0755 }, … ] }`}</Code>
          <H3>2 · Quote the parlay (free)</H3>
          <Code>{`curl -X POST ${API}/parlay/quote \\
  -H 'Content-Type: application/json' \\
  -d '{
    "stakeUsd": 5,
    "legs": [
      { "venue": "polymarket", "id": "0x8bf1…", "side": "no" },
      { "venue": "kalshi", "id": "KXFED-27APR-T4.25", "side": "yes" }
    ]
  }'

# → { "quoteId": "e8accb18d4bf3d19", "validForSeconds": 90,
#     "fairMultiplier": 45.37, "offeredMultiplier": 42.1,
#     "potentialPayoutUsd": 210.50, "totalChargeUsd": 5.10 }`}</Code>
          <H3>3 · Place it (x402)</H3>
          <Code>{`curl -X POST ${API}/parlay/place \\
  -H 'Content-Type: application/json' \\
  -d '{ "quoteId": "e8accb18d4bf3d19" }'
# → 402 Payment Required (terms below)

curl -X POST ${API}/parlay/place \\
  -H 'Content-Type: application/json' \\
  -H "X-PAYMENT: $SIGNED_PAYMENT" \\
  -d '{ "quoteId": "e8accb18d4bf3d19" }'
# → 201 { "ticket": { "ticketId": "b4093643", "status": "live", … } }`}</Code>

          <H2 id="payments">Payments (x402)</H2>
          <P>
            Flip implements the x402 protocol. A <code className="font-mono text-sm">POST /parlay/place</code>{" "}
            without payment returns HTTP 402 with exact terms — and{" "}
            <strong>the payment is the stake</strong>: <code className="font-mono text-sm">maxAmountRequired</code>{" "}
            equals stake + 1% fee in atomic USDT (6 decimals).
          </P>
          <Code>{`HTTP/1.1 402 Payment Required
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:196",                                  // X Layer
    "maxAmountRequired": "5100000",                           // 5.10 USDT
    "asset": "0x1E4a5963aBFD975d8c9021cE480b42188849D41d",    // USDT
    "payTo": "0x19d368e389fe491a578adbfb08f353780d239375",
    "maxTimeoutSeconds": 120
  }]
}`}</Code>
          <P>
            Sign the payment, retry with the base64 <code className="font-mono text-sm">X-PAYMENT</code>{" "}
            header, and Flip verifies + settles through OKX&rsquo;s x402 facilitator before the
            ticket is created. Gas-free — X Layer subsidizes USDT transfers.
          </P>

          <H2 id="endpoints">Endpoints</H2>
          {[
            ["GET /markets?q=&venue=&limit=", "Unified live search. Returns Market[] with venue, id, question, yesPrice, noPrice — prices are executable asks, not midpoints."],
            ["POST /parlay/quote", "Body: { legs: LegRequest[], stakeUsd }. 2–6 legs, one position per market. Returns the full Quote with fair and offered multipliers and a quoteId valid 90 seconds."],
            ["POST /parlay/place", "Body: { quoteId }. Without X-PAYMENT → 402 terms. With verified payment → 201 { ticket }. Idempotent via X-IDEMPOTENCY-KEY."],
            ["POST /nl/quote", "Body: { text }. Natural language → legs → quote. See the 0G section."],
            ["GET /parlay/:ticketId", "Ticket with per-leg results: pending | won | lost."],
            ["GET /tickets", "Last 50 tickets — the public audit trail."],
            ["GET /openapi.json", "The full OpenAPI 3.1 spec (drives the Playground reference)."],
          ].map(([sig, desc]) => (
            <div key={sig} className="my-3 rounded-xl border border-line bg-card p-4">
              <p className="font-mono text-[13.5px] font-bold">{sig}</p>
              <p className="mt-1 text-[14.5px] leading-relaxed text-[#4b4a4a]">{desc}</p>
            </div>
          ))}

          <H2 id="natural-language">Natural language (0G)</H2>
          <P>
            <code className="font-mono text-sm">POST /nl/quote</code> turns a sentence into a priced
            parlay. The mapping runs on <strong>0G Compute Network</strong> — TEE-attested
            inference — and the model&rsquo;s role is strictly bounded: it selects from a
            numbered list of live markets we hand it. It never prices, never places, and its only
            free-text output is a truncated interpretation string.
          </P>
          <Code>{`curl -X POST ${API}/nl/quote \\
  -H 'Content-Type: application/json' \\
  -d '{ "text": "$5 says the Fed holds in July and bitcoin keeps climbing" }'

# → { "engine": "0g",
#     "legs": [ { "venue": "polymarket", "side": "no", … },
#               { "venue": "kalshi", "side": "yes", … } ],
#     "quote": { "offeredMultiplier": 93.3, "potentialPayoutUsd": 466.50, … } }`}</Code>

          <H2 id="pricing">Pricing model</H2>
          <P>Deterministic and published — both multipliers appear on every quote.</P>
          <Code>{`fair     = Π 1/price_i          # independence product over executable prices
haircut  = 0.9 ^ correlated_pairs   # legs sharing a category
offered  = fair × haircut × 0.93    # published 7% edge
fee      = max($0.10, 1% of stake)  # the only service charge`}</Code>
          <P>
            Caps: <strong>6 legs · $50 max stake · 100x max multiplier · $1,000 max payout</strong>.
            Duplicate markets are rejected. Prices come from walking the live books for your size —
            Polymarket&rsquo;s CLOB and Kalshi&rsquo;s public order books.
          </P>

          <H2 id="settlement">Tickets & settlement</H2>
          <P>
            Tickets are persistent and idempotent. A watcher polls venue resolutions every minute:
            any leg lost → <code className="font-mono text-sm">status: "lost"</code>; all legs won →{" "}
            <code className="font-mono text-sm">status: "won"</code> with the payout recorded
            against the paying address. The full history is public at{" "}
            <code className="font-mono text-sm">GET /tickets</code>.
          </P>

          <H2 id="limits">Rate limits & errors</H2>
          <div className="my-4 overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-card font-mono text-[11px] uppercase tracking-wider text-muted">
                <tr><th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Meaning</th></tr>
              </thead>
              <tbody className="bg-white">
                {[
                  ["400", "Bad request — malformed legs, stake over cap, insufficient depth"],
                  ["402", "Payment required — x402 terms in the body; also returned on failed verification"],
                  ["410", "Quote expired — quotes hold for 90 seconds, re-quote"],
                  ["422", "NL text could not be mapped to at least 2 live markets"],
                  ["429", "Rate limited — 30 req/min general, 5/min for /nl/quote"],
                ].map(([c, m]) => (
                  <tr key={c} className="border-t border-line">
                    <td className="px-4 py-2.5 font-mono font-bold">{c}</td>
                    <td className="px-4 py-2.5 text-[#4b4a4a]">{m}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            NL parsing additionally draws from a global daily model budget; past it, the endpoint
            degrades gracefully to a keyword engine (<code className="font-mono text-sm">engine: "fallback"</code>)
            rather than failing.
          </P>

          <div className="mb-16 mt-12 rounded-2xl bg-mint p-6">
            <p className="font-semibold">Ready to try it?</p>
            <p className="mt-1 text-[14.5px] text-[#4b4a4a]">
              The <Link href="/playground" className="font-semibold text-ink underline">Playground</Link>{" "}
              hits this API live — or import the{" "}
              <a href={`${API}/openapi.json`} className="font-semibold text-ink underline">OpenAPI spec</a>{" "}
              into Hoppscotch or Postman.
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}

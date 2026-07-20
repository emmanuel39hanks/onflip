const API = "https://api.onflip.xyz"; // set to your Railway URL

const LOGO_POLYMARKET =
  "https://cdn.brandfetch.io/polymarket.com/h/56/theme/dark/fallback/404/type/logo?c=1idwndMAtLwjnpW7fjr";
const LOGO_KALSHI =
  "https://cdn.brandfetch.io/kalshi.com/h/56/theme/dark/fallback/404/type/logo?c=1idwndMAtLwjnpW7fjr";

/* ------------------------------- terminal -------------------------------- */

function Terminal({
  title,
  lines,
  className = "",
}: {
  title: string;
  lines: { t: "cmd" | "out" | "ok" | "warn"; s: string }[];
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-lg border border-line bg-term shadow-sm ${className}`}>
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 font-mono text-[11px] text-white/40">{title}</span>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[12px] leading-[1.7]">
        {lines.map((l, i) => (
          <div key={i}>
            {l.t === "cmd" ? (
              <span className="text-white">
                <span className="text-white/40">$ </span>
                {l.s}
              </span>
            ) : l.t === "ok" ? (
              <span className="text-[#4ade80]">{l.s}</span>
            ) : l.t === "warn" ? (
              <span className="text-[#fbbf24]">{l.s}</span>
            ) : (
              <span className="text-white/60">{l.s}</span>
            )}
          </div>
        ))}
      </pre>
    </div>
  );
}

/* --------------------------------- page ---------------------------------- */

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6">
      {/* nav */}
      <nav className="flex items-center justify-between py-6">
        <span className="text-xl font-extrabold tracking-tight">Flip</span>
        <div className="flex items-center gap-6 text-sm text-muted">
          <a href="#how" className="hidden hover:text-fg sm:block">
            How it works
          </a>
          <a href="#pricing" className="hidden hover:text-fg sm:block">
            Pricing
          </a>
          <a href="#api" className="hidden hover:text-fg sm:block">
            API
          </a>
          <a
            href="#api"
            className="rounded-md bg-fg px-4 py-2 font-mono text-xs font-medium text-white transition-opacity hover:opacity-80"
          >
            curl {API.replace("https://", "")}
          </a>
        </div>
      </nav>

      {/* hero */}
      <header className="grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <div className="rise flex flex-wrap gap-2">
            {["x402 native", "eip155:196", "no accounts", "no API keys"].map((c) => (
              <span
                key={c}
                className="rounded-full border border-line bg-gray-1 px-3 py-1 font-mono text-[11px] text-muted"
              >
                {c}
              </span>
            ))}
          </div>
          <h1 className="rise d1 mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            One payment.
            <br />
            One position.
            <br />
            <span className="text-muted">Every market.</span>
          </h1>
          <p className="rise d2 mt-6 max-w-md text-lg leading-relaxed text-muted">
            Flip is a paid API for agents. Combine live markets from Polymarket and Kalshi into a
            single leveraged position — quoted in seconds, funded by one USDT transfer on X Layer,
            settled automatically.
          </p>
          <div className="rise d3 mt-8 flex gap-3">
            <a
              href="#how"
              className="rounded-md bg-fg px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-80"
            >
              See the flow
            </a>
            <a
              href="#api"
              className="rounded-md border border-line px-5 py-3 text-sm font-medium transition-colors hover:border-fg"
            >
              API reference
            </a>
          </div>
        </div>

        <Terminal
          className="rise d2"
          title="flip — live session"
          lines={[
            { t: "cmd", s: `curl ${API.replace("https://", "")}/markets?q=fed` },
            { t: "out", s: `[polymarket] "No Fed change in July?"   yes 0.92` },
            { t: "out", s: `[kalshi]     "Fed funds above 4.25%?"   yes 0.29` },
            { t: "cmd", s: "curl -X POST /parlay/quote -d '{...2 legs, $5}'" },
            { t: "out", s: `{` },
            { t: "out", s: `  "quoteId": "e8accb18d4bf3d19",` },
            { t: "out", s: `  "fairMultiplier": 45.37,` },
            { t: "ok", s: `  "offeredMultiplier": 42.1,` },
            { t: "ok", s: `  "potentialPayoutUsd": 210.50,` },
            { t: "out", s: `  "totalChargeUsd": 5.10` },
            { t: "out", s: `}` },
          ]}
        />
      </header>

      {/* venue logos */}
      <section className="border-y border-line py-8">
        <div className="flex flex-wrap items-center justify-center gap-10">
          <span className="font-mono text-[11px] uppercase tracking-widest text-faint">
            Live markets from
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_POLYMARKET} alt="Polymarket" className="h-6 w-auto opacity-80" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_KALSHI} alt="Kalshi" className="h-6 w-auto opacity-80" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-faint">
            · payments on X Layer · listed on OKX.AI
          </span>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="py-24">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          The 402 is the whole checkout
        </h2>
        <p className="mt-3 max-w-xl text-muted">
          No signup, no session, no key exchange. Ask for a ticket, get payment terms, pay on
          X Layer, hold the position. Every response below was captured from the running service —
          this is the actual wire.
        </p>

        <div className="mt-10 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div>
              <p className="font-mono text-xs text-faint">STEP 1 — FREE</p>
              <h3 className="mt-1 font-semibold">Quote the combination</h3>
              <p className="mt-1 text-sm text-muted">
                Any legs, any venue mix. Prices come from walking the live order books, not
                midpoints.
              </p>
            </div>
            <Terminal
              title="POST /parlay/quote"
              lines={[
                {
                  t: "cmd",
                  s: `curl -X POST ${API.replace("https://", "")}/parlay/quote -d '{"stakeUsd":5,"legs":[…]}'`,
                },
                { t: "out", s: `{` },
                { t: "out", s: `  "quoteId": "e8accb18d4bf3d19",  "validForSeconds": 90,` },
                { t: "out", s: `  "legs": [` },
                { t: "out", s: `    { "venue": "polymarket", "side": "no",  "price": 0.076 },` },
                { t: "out", s: `    { "venue": "kalshi",     "side": "yes", "price": 0.290 }` },
                { t: "out", s: `  ],` },
                { t: "out", s: `  "fairMultiplier": 45.37,` },
                { t: "ok", s: `  "offeredMultiplier": 42.1,` },
                { t: "out", s: `  "totalChargeUsd": 5.10` },
                { t: "out", s: `}` },
              ]}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div>
              <p className="font-mono text-xs text-faint">STEP 2 — HTTP 402</p>
              <h3 className="mt-1 font-semibold">Get payment terms</h3>
              <p className="mt-1 text-sm text-muted">
                The stake rides inside the payment: $5 position + $0.10 fee = one transfer of
                5.10 USDT.
              </p>
            </div>
            <Terminal
              title="POST /parlay/place → 402"
              lines={[
                { t: "cmd", s: `curl -X POST /parlay/place -d '{"quoteId":"e8accb18d4bf3d19"}'` },
                { t: "warn", s: `HTTP/1.1 402 Payment Required` },
                { t: "out", s: `{` },
                { t: "out", s: `  "accepts": [{` },
                { t: "out", s: `    "scheme": "exact",` },
                { t: "out", s: `    "network": "eip155:196",` },
                { t: "out", s: `    "maxAmountRequired": "5100000",` },
                { t: "out", s: `    "asset": "0x1E4a…D41d",   // USDT on X Layer` },
                { t: "out", s: `    "payTo": "0x19d3…9375"` },
                { t: "out", s: `  }]` },
                { t: "out", s: `}` },
              ]}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div>
              <p className="font-mono text-xs text-faint">STEP 3 — 201</p>
              <h3 className="mt-1 font-semibold">Hold the ticket</h3>
              <p className="mt-1 text-sm text-muted">
                A watcher polls venue resolutions. All legs win → payout owed to the paying
                address. Any leg loses → done.
              </p>
            </div>
            <Terminal
              title="POST /parlay/place + X-PAYMENT → 201"
              lines={[
                { t: "cmd", s: `curl -X POST /parlay/place -H "X-PAYMENT: $SIGNED" -d '{"quoteId":"…"}'` },
                { t: "ok", s: `HTTP/1.1 201 Created` },
                { t: "out", s: `{` },
                { t: "out", s: `  "ticket": {` },
                { t: "out", s: `    "ticketId": "b4093643",` },
                { t: "ok", s: `    "status": "live",` },
                { t: "out", s: `    "multiplier": 42.1,` },
                { t: "out", s: `    "stakeUsd": 5,` },
                { t: "out", s: `    "potentialPayoutUsd": 210.50` },
                { t: "out", s: `  }` },
                { t: "out", s: `}` },
              ]}
            />
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="border-t border-line py-24">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          The math is public
        </h2>
        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <div className="rounded-lg border border-line bg-gray-1 p-6">
            <pre className="overflow-x-auto font-mono text-[13px] leading-[2]">
{`fair     = Π 1/price_i        // live order books
haircut  = 0.9 ^ correlated_pairs
offered  = fair × haircut × 0.93
fee      = max($0.10, 1% of stake)`}
            </pre>
          </div>
          <div className="space-y-5 text-[15px] leading-relaxed text-muted">
            <p>
              <strong className="text-fg">Fair and offered, side by side.</strong> Every quote
              shows the independence-product multiplier and what we offer after the published 7%
              edge. Nothing is buried in the price.
            </p>
            <p>
              <strong className="text-fg">Correlated legs get trimmed.</strong> Legs in the same
              category cut the multiplier 10% per pair; duplicate markets are rejected.
            </p>
            <p>
              <strong className="text-fg">Hard caps, printed.</strong>{" "}
              <span className="tabular font-mono text-sm">
                6 legs · $50 max stake · 100x max · $1,000 max payout
              </span>
              . Quotes hold for 90 seconds; retries are idempotent.
            </p>
          </div>
        </div>
      </section>

      {/* api reference */}
      <section id="api" className="border-t border-line py-24">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">API</h2>
        <p className="mt-3 text-muted">
          Machine-readable manifest at{" "}
          <a href={API} className="font-mono text-sm text-blue hover:underline">
            GET /
          </a>
          . No authentication for reads; paid routes speak x402.
        </p>
        <div className="mt-8 overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-gray-1 font-mono text-[11px] uppercase tracking-wider text-faint">
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Path</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[13px]">
              {[
                ["GET", "/markets?q=", "unified live search across Polymarket + Kalshi", "free"],
                ["POST", "/parlay/quote", "price legs + stake → multiplier, quoteId (90s)", "free"],
                ["POST", "/parlay/place", "x402 → live ticket; payment = stake + fee", "stake + 1%"],
                ["GET", "/parlay/:id", "ticket status, leg-by-leg resolution", "free"],
                ["GET", "/tickets", "recent tickets (audit trail)", "free"],
                ["GET", "/health", "liveness", "free"],
              ].map(([m, p, d, c]) => (
                <tr key={p} className="border-b border-line last:border-b-0">
                  <td className={`px-4 py-3 font-semibold ${m === "POST" ? "text-amber" : "text-green"}`}>
                    {m}
                  </td>
                  <td className="px-4 py-3">{p}</td>
                  <td className="px-4 py-3 font-sans text-muted">{d}</td>
                  <td className={`px-4 py-3 text-right ${c === "free" ? "text-faint" : "font-semibold text-fg"}`}>
                    {c}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* footer */}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-10 text-sm text-faint">
        <span className="font-extrabold text-fg">Flip</span>
        <span className="font-mono text-xs">
          markets: Polymarket · Kalshi &nbsp;·&nbsp; payments: USDT on X Layer &nbsp;·&nbsp; © 2026
        </span>
      </footer>
    </main>
  );
}

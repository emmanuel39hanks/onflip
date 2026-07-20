import Link from "next/link";
import { FlipMark, XIcon } from "@/components/FlipMark";

const API = "https://api.onflip.xyz";

const LOGO_POLYMARKET = "/logos/polymarket.svg";
const LOGO_KALSHI = "/logos/kalshi.svg";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative inline-block">
      <span className="pill-light">{children}</span>
      <div className="glow opacity-70" />
    </div>
  );
}

/* ------------------------------- hero cards ------------------------------ */

function QuoteCard() {
  return (
    <div className="soft w-[290px] -rotate-6 rounded-3xl bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">POST /parlay/quote</p>
      <div className="mt-3 space-y-2 text-[13px] font-medium">
        <div className="flex items-center justify-between rounded-xl bg-bg px-3 py-2">
          <span className="truncate pr-2">Fed holds in July</span>
          <span className="font-mono text-red">NO ·.076</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-bg px-3 py-2">
          <span className="truncate pr-2">Funds rate &gt; 4.25%</span>
          <span className="font-mono text-green">YES ·.29</span>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
        <span className="text-xs font-semibold text-muted">offered</span>
        <span className="serif text-4xl">42.1×</span>
      </div>
    </div>
  );
}

function TicketCard() {
  return (
    <div className="soft w-[290px] rotate-3 rounded-3xl bg-dark p-5 text-white noise">
      <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">201 · ticket live</p>
      <div className="mt-3 font-mono text-[12.5px] leading-relaxed text-white/80">
        {`{`}
        <br />
        &nbsp;&nbsp;{`"ticketId": "b4093643",`}
        <br />
        &nbsp;&nbsp;{`"status": `}<span className="text-[#7ee2a8]">{`"live"`}</span>,
        <br />
        &nbsp;&nbsp;{`"multiplier": 42.1,`}
        <br />
        &nbsp;&nbsp;{`"potentialPayoutUsd": 210.50`}
        <br />
        {`}`}
      </div>
      <div className="mt-4 border-t border-white/15 pt-3 font-mono text-[10px] uppercase tracking-widest text-white/50">
        paid via x402 · usdt · x layer
      </div>
    </div>
  );
}

/* ------------------------------- docs data ------------------------------- */

const ENDPOINTS = [
  {
    m: "GET",
    p: "/markets?q=",
    d: "Unified live search across both venues.",
    r: "{ markets: Market[] } — venue, id, question, yesPrice, noPrice",
    cost: "free",
  },
  {
    m: "POST",
    p: "/parlay/quote",
    d: "Price legs + stake. Order books walked for real depth.",
    r: "Quote — fairMultiplier, offeredMultiplier, totalChargeUsd, quoteId (90s)",
    cost: "free",
  },
  {
    m: "POST",
    p: "/parlay/place",
    d: "No X-PAYMENT → 402 with terms. Paid retry → live ticket.",
    r: "402: PaymentRequired · 201: { ticket: Ticket }",
    cost: "stake + 1%",
  },
  {
    m: "POST",
    p: "/nl/quote",
    d: "Plain English → legs via 0G Compute → deterministic quote.",
    r: "{ interpretation, engine, legs, quote }",
    cost: "free",
  },
  {
    m: "GET",
    p: "/parlay/:id",
    d: "Ticket status; legs resolve from venue data automatically.",
    r: "{ ticket: Ticket } — status: live | won | lost",
    cost: "free",
  },
];

const FAQS = [
  {
    q: "How do payments work?",
    a: "Flip speaks x402. Call POST /parlay/place with no payment and you get HTTP 402 with exact terms: amount (stake + 1% fee) in USDT on X Layer (eip155:196), asset address, and payTo. Pay, retry with the signed X-PAYMENT header, and the facilitator-verified payment funds your ticket in the same call.",
  },
  {
    q: "Where do prices come from?",
    a: "Live order books — Polymarket's CLOB and Kalshi's public books — walked for your actual size, never midpoints. The quote shows the fair multiplier (independence product) and the offered multiplier side by side, with a published 7% edge and a 10% haircut per same-category pair.",
  },
  {
    q: "How do tickets settle?",
    a: "A watcher polls venue resolutions. Any leg lost → ticket lost. All legs won → the ticket records the payout owed to the paying address. Everything is auditable at GET /tickets.",
  },
  {
    q: "What are the caps?",
    a: "6 legs, $50 max stake, 100x max multiplier, $1,000 max payout, quotes valid 90 seconds, idempotent placement via X-IDEMPOTENCY-KEY.",
  },
  {
    q: "What does the AI do — and not do?",
    a: "POST /nl/quote uses 0G Compute (TEE-attested inference) only to map your sentence to live markets. It never prices, never places, never touches money. Pricing is deterministic and published; placement requires your payment.",
  },
];

export default function Home() {
  return (
    <div>
      {/* nav */}
      <nav className="sticky top-0 z-50 bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-10">
            <Link href="/" className="text-ink">
              <FlipMark height={24} />
            </Link>
            <div className="hidden gap-8 text-[15px] font-semibold text-muted sm:flex">
              <Link href="/playground" className="hover:text-ink">Playground</Link>
              <Link href="/docs" className="hover:text-ink">Docs</Link>
              <a href="#faq" className="hover:text-ink">FAQ</a>
            </div>
          </div>
          <Link href="/playground" className="pill text-sm">
            <strong>Try it live</strong>
          </Link>
        </div>
      </nav>

      <main className="overflow-hidden rounded-b-[64px] bg-bg pb-20">
        {/* hero */}
        <header className="px-6 pb-16 pt-16 text-center">
          <div className="rise mb-6">
            <Badge>
              <strong>Live on OKX.AI</strong> · agent-callable
            </Badge>
          </div>
          <h1 className="serif rise d1 mx-auto max-w-3xl text-6xl leading-[1.02] tracking-tight sm:text-7xl lg:text-[84px] lg:leading-[0.98]">
            One payment.
            <br />
            One position.
          </h1>
          <p className="rise d2 mx-auto mt-7 max-w-sm text-[19px] leading-relaxed tracking-tight text-muted">
            Combine live Polymarket and Kalshi markets into a single ticket. Quote free. Pay one
            HTTP&nbsp;402.
          </p>
          <div className="rise d3 mt-9 flex justify-center gap-3">
            <Link href="/playground" className="pill">
              <strong>Try the playground</strong>
            </Link>
            <Link href="/docs" className="pill-light relative">
              Read the docs
            </Link>
          </div>

          {/* floating cards over pastel portal */}
          <div className="rise d4 relative mx-auto mt-16 flex max-w-2xl items-center justify-center">
            <div
              className="absolute inset-x-8 top-6 bottom-0 rounded-[48px]"
              style={{
                background:
                  "radial-gradient(60% 70% at 50% 40%, #e5eff8 0%, #ebf6f2 45%, rgba(247,247,247,0) 100%)",
              }}
            />
            <div className="relative z-10 flex flex-wrap items-center justify-center gap-6 py-10">
              <QuoteCard />
              <TicketCard />
            </div>
          </div>

          {/* venues */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 opacity-80">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
              live markets from
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_POLYMARKET} alt="Polymarket" className="h-[22px] w-auto" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_KALSHI} alt="Kalshi" className="h-[26px] w-auto" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
              · payments on x layer
            </span>
          </div>
        </header>

        {/* pastel tiles */}
        <section className="px-6 py-16">
          <div className="mx-auto grid max-w-6xl gap-7 md:grid-cols-3">
            <div className="noise rounded-2xl bg-mint px-6 py-12 text-center">
              <div className="soft mx-auto flex h-[202px] w-[202px] flex-col items-center justify-center rounded-2xl bg-card">
                <span className="text-sm font-semibold text-muted">offered vs fair</span>
                <span className="serif mt-2 text-6xl">42.1×</span>
                <span className="mt-2 rounded-md bg-bg px-3 py-1 font-mono text-xs">fair 45.37×</span>
              </div>
              <h3 className="serif mt-10 text-3xl">No hidden edge</h3>
              <p className="mx-auto mt-3 max-w-[260px] text-[17px] leading-snug tracking-tight text-muted">
                Both multipliers on every quote. The 7% is printed, not buried.
              </p>
            </div>

            <div className="noise rounded-2xl bg-blu px-6 py-12 text-center">
              <div className="soft mx-auto flex h-[202px] w-[202px] flex-col items-center justify-center rounded-2xl bg-card font-mono">
                <span className="text-xs text-muted">HTTP</span>
                <span className="serif mt-1 text-7xl">402</span>
                <span className="mt-2 rounded-md bg-bg px-3 py-1 text-xs">= the checkout</span>
              </div>
              <h3 className="serif mt-10 text-3xl">The payment is the stake</h3>
              <p className="mx-auto mt-3 max-w-[260px] text-[17px] leading-snug tracking-tight text-muted">
                One USDT transfer funds the position and the fee. No accounts, no keys.
              </p>
            </div>

            <div className="noise rounded-2xl bg-lilac px-6 py-12 text-center">
              <div className="soft mx-auto flex h-[202px] w-[202px] flex-col items-center justify-center rounded-2xl bg-card">
                <span className="text-sm font-semibold text-muted">settles</span>
                <span className="serif mt-2 text-5xl">itself</span>
                <span className="mt-3 rounded-md bg-bg px-3 py-1 font-mono text-xs">live → won | lost</span>
              </div>
              <h3 className="serif mt-10 text-3xl">Autonomous end to end</h3>
              <p className="mx-auto mt-3 max-w-[260px] text-[17px] leading-snug tracking-tight text-muted">
                A watcher resolves every leg from venue data. Audit trail included.
              </p>
            </div>
          </div>
        </section>

        {/* playground + docs teasers */}
        <section className="px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <Badge>Powered by 0G Compute · TEE-attested</Badge>
              <h2 className="serif mx-auto mt-6 max-w-xl text-5xl leading-[1.02] tracking-tight sm:text-[58px]">
                Say it. <span className="serif">Quote it.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-md text-[19px] tracking-tight text-muted">
                Describe a view in plain English — 0G maps it to live markets, the deterministic
                engine prices it.
              </p>
            </div>
            <div className="grid gap-7 md:grid-cols-2">
              <Link
                href="/playground"
                className="group rounded-3xl border border-line bg-card p-8 transition-colors hover:border-ink"
              >
                <div className="rounded-xl bg-[#1b1b1b] p-4 font-mono text-[12.5px] leading-[1.7]">
                  <span className="text-white/40">$</span>{" "}
                  <span className="text-white">&quot;$5 the Fed holds and bitcoin climbs&quot;</span>
                  <br />
                  <span className="text-[#7ee2a8]">→ 93.3× · $5 → $466.50</span>
                </div>
                <h3 className="serif mt-6 text-3xl">Playground →</h3>
                <p className="mt-2 text-[16px] text-muted">
                  A live request client against the real API — natural language or raw JSON.
                </p>
              </Link>
              <Link
                href="/docs"
                className="group rounded-3xl border border-line bg-card p-8 transition-colors hover:border-ink"
              >
                <div className="rounded-xl bg-bg p-4 font-mono text-[12.5px] leading-[1.7] text-muted">
                  Introduction · Quickstart · Payments (x402)
                  <br />
                  Endpoints · Pricing model · Rate limits
                </div>
                <h3 className="serif mt-6 text-3xl">Documentation →</h3>
                <p className="mt-2 text-[16px] text-muted">
                  Integration guides plus the full OpenAPI reference with schemas.
                </p>
              </Link>
            </div>
          </div>
        </section>

        {/* docs */}
        <section id="docs" className="px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="serif text-5xl tracking-tight sm:text-[58px]">The API</h2>
              <p className="mx-auto mt-4 max-w-md text-[19px] tracking-tight text-muted">
                Six endpoints, one paid. Full guides in the{" "}
                <Link className="font-semibold text-ink underline" href="/docs">
                  documentation
                </Link>
                .
              </p>
            </div>
            <div className="space-y-3">
              {ENDPOINTS.map((e) => (
                <div key={e.p} className="soft flex flex-col gap-3 rounded-2xl bg-card px-6 py-5 md:flex-row md:items-center">
                  <div className="flex w-64 shrink-0 items-center gap-3">
                    <span
                      className={`rounded-md px-2 py-1 font-mono text-[11px] font-bold ${
                        e.m === "POST" ? "bg-lilac" : "bg-mint"
                      }`}
                    >
                      {e.m}
                    </span>
                    <span className="font-mono text-[14px] font-semibold">{e.p}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium">{e.d}</p>
                    <p className="mt-0.5 truncate font-mono text-[12px] text-muted">{e.r}</p>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-xs ${
                      e.cost === "free" ? "text-muted" : "rounded-full bg-peach px-3 py-1 font-bold"
                    }`}
                    style={e.cost !== "free" ? { background: "var(--peach)" } : undefined}
                  >
                    {e.cost}
                  </span>
                </div>
              ))}
            </div>

            <div className="term mt-8 overflow-x-auto p-6">
              <span className="text-white/40"># the whole lifecycle, three calls</span>
              {"\n"}$ curl {API.replace("https://", "")}/markets?q=fed
              {"\n"}$ curl -X POST /parlay/quote -d {`'{"stakeUsd":5,"legs":[…]}'`}{" "}
              <span className="text-white/40">→ quoteId, 42.1×</span>
              {"\n"}$ curl -X POST /parlay/place -H {`"X-PAYMENT: $SIGNED"`} -d{" "}
              {`'{"quoteId":"…"}'`} <span className="text-[#7ee2a8]">→ 201 ticket live</span>
            </div>
          </div>
        </section>

        {/* faq */}
        <section id="faq" className="px-6 py-16">
          <div className="mx-auto max-w-2xl">
            <div className="mb-10 text-center">
              <Badge>FAQs</Badge>
              <h2 className="serif mt-6 text-5xl leading-tight tracking-tight sm:text-[58px]">
                Got questions? <br /> Here&rsquo;s the answers.
              </h2>
            </div>
            <div className="space-y-3">
              {FAQS.map((f) => (
                <details key={f.q} className="rounded-2xl bg-card">
                  <summary className="serif flex items-center justify-between gap-6 px-6 py-6 text-[22px] tracking-tight">
                    {f.q}
                    <svg className="chev shrink-0" width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M10 .83a9.17 9.17 0 110 18.34A9.17 9.17 0 0110 .83zm3.33 6.74l1.18 1.18L10 13.26 5.49 8.75l1.18-1.18L10 10.9l3.33-3.33z"
                        fill="#e5e5e5"
                      />
                    </svg>
                  </summary>
                  <p className="px-6 pb-6 text-[15.5px] leading-relaxed tracking-tight text-muted">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* dark pricing panel */}
        <section className="px-6 py-16">
          <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[32px] md:grid-cols-[1fr_1.2fr]">
            <div
              className="noise px-10 py-14"
              style={{ background: "linear-gradient(135deg, #dae8f5 34%, #a3c6e6)" }}
            >
              <h3 className="serif max-w-[280px] text-[40px] leading-[1.05] tracking-tight">
                Integrated in 5 minutes
              </h3>
              <ul className="mt-6 max-w-[290px] space-y-1.5">
                {["GET /markets — pick your legs", "POST /parlay/quote — free", "Pay the 402 — you're in"].map(
                  (s, i) => (
                    <li key={s} className="flex items-center rounded-xl bg-white/40 p-3 font-semibold">
                      <span className="serif mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/50 text-lg">
                        {i + 1}
                      </span>
                      <span className="text-[14.5px]">{s}</span>
                    </li>
                  )
                )}
              </ul>
            </div>
            <div className="noise flex flex-col items-end bg-dark px-10 py-14 text-right text-white">
              <h3 className="serif text-[40px] leading-tight tracking-tight">One fee,</h3>
              <div className="serif mt-4 text-[88px] leading-none">1%</div>
              <div className="mt-2 font-semibold">per placed ticket · quotes always free</div>
              <a
                href="#playground"
                className="mt-10 rounded-full bg-white px-8 py-3 font-bold text-ink transition-transform hover:-translate-y-0.5"
              >
                Start building
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* footer */}
      <footer
        className="noise -mt-16 pt-28 text-white"
        style={{ background: "linear-gradient(#393737, #1b1b1b)" }}
      >
        <div className="mx-auto max-w-6xl px-6 pb-10">
          <div className="mb-14 grid gap-10 sm:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <div>
              <FlipMark height={26} className="[filter:invert(1)]" />
              <p className="mt-4 max-w-[240px] text-[14.5px] leading-relaxed text-white/50">
                One payment. One position. Every market. Built for the agent economy on OKX.AI.
              </p>
              <a
                href="https://x.com/onflip_xyz"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Flip on X"
                className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <XIcon size={16} />
              </a>
            </div>
            <div>
              <div className="mb-4 text-sm font-semibold text-white/80">Product</div>
              {[
                ["Playground", "/playground"],
                ["Documentation", "/docs"],
                ["OpenAPI spec", `${API}/openapi.json`],
              ].map(([t, h]) => (
                <a key={t} href={h} className="mb-3 block text-[15px] text-white/50 hover:text-white">
                  {t}
                </a>
              ))}
            </div>
            <div>
              <div className="mb-4 text-sm font-semibold text-white/80">Developers</div>
              {[
                ["GitHub", "https://github.com/emmanuel39hanks/onflip"],
                ["API status", `${API}/health`],
                ["Audit trail", `${API}/tickets`],
              ].map(([t, h]) => (
                <a key={t} href={h} className="mb-3 block text-[15px] text-white/50 hover:text-white">
                  {t}
                </a>
              ))}
            </div>
            <div>
              <div className="mb-4 text-sm font-semibold text-white/80">Stack</div>
              <p className="text-[15px] leading-relaxed text-white/50">
                Markets: Polymarket &amp; Kalshi
                <br />
                Payments: USDT on X Layer
                <br />
                Inference: 0G Compute
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-[13px] text-white/40">
            <span>© 2026 Flip · onflip.xyz</span>
            <span className="font-mono text-[11px]">eip155:196 · x402 · listed on OKX.AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

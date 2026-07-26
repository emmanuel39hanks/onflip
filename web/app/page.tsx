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

function RouteCard() {
  return (
    <div className="soft w-[290px] -rotate-6 rounded-3xl bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">POST /execute</p>
      <div className="mt-3 space-y-2 text-[13px] font-medium">
        <div className="flex items-center justify-between rounded-xl bg-bg px-3 py-2">
          <span className="truncate pr-2">Fed cuts in July</span>
          <span className="font-mono text-green">YES ·.42</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-bg px-3 py-2">
          <span className="truncate pr-2">10 shares</span>
          <span className="font-mono text-muted">$4.20</span>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
        <span className="text-xs font-semibold text-muted">routing fee</span>
        <span className="display text-4xl">$0.02</span>
      </div>
    </div>
  );
}

function SignCard() {
  return (
    <div className="soft w-[290px] rotate-3 rounded-3xl bg-dark p-5 text-white noise">
      <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">
        signed in your process
      </p>
      <div className="mt-3 font-mono text-[12.5px] leading-relaxed text-white/80">
        {`{`}
        <br />
        &nbsp;&nbsp;{`"order": { … },`}
        <br />
        &nbsp;&nbsp;{`"signature": `}
        <span className="text-white/40">null</span>,
        <br />
        &nbsp;&nbsp;{`"signedByFlip": `}
        <span className="text-[#7ee2a8]">false</span>
        <br />
        {`}`}
      </div>
      <div className="mt-4 border-t border-white/15 pt-3 font-mono text-[10px] uppercase tracking-widest text-white/50">
        your key · your funds · your position
      </div>
    </div>
  );
}

/* ------------------------------- docs data ------------------------------- */

const ENDPOINTS = [
  {
    m: "GET",
    p: "/markets?q=",
    d: "Unified live search across Polymarket and Kalshi.",
    r: "{ markets: Market[] } — venue, id, question, yesPrice, noPrice",
    cost: "free",
  },
  {
    m: "POST",
    p: "/quote",
    d: "Price a view. Order books walked for your real size, not midpoints.",
    r: "Quote — fairMultiplier, offeredMultiplier, quoteId (90s)",
    cost: "free",
  },
  {
    m: "POST",
    p: "/execute",
    d: "No X-PAYMENT → 402 with terms. Paid → unsigned order + EIP-712 payload to sign.",
    r: "402: PaymentRequired · 200: { routeId, order, typedData, cost, builderFee }",
    cost: "$0.02",
  },
  {
    m: "POST",
    p: "/submit",
    d: "Relay the order you signed. Or post it yourself — /execute shows you how.",
    r: "201: { submitted, market, result, trackAt }",
    cost: "free",
  },
  {
    m: "GET",
    p: "/positions/:wallet",
    d: "Live positions, current value and PnL for any wallet.",
    r: "{ wallet, positions: Position[] }",
    cost: "free",
  },
];

const FAQS = [
  {
    q: "Who holds my money?",
    a: "You do — always. Your stake never reaches Flip. It moves from your own wallet straight to Polymarket when the order you signed is filled. The only payment Flip receives is the $0.02 routing fee, and Flip's builder fee on your trade is 0%.",
  },
  {
    q: "How can you be sure Flip can't move funds?",
    a: "Polymarket splits authority in two: signing an order needs your private key, posting an already-signed order needs only API credentials. Flip runs entirely at the posting level. Our order builder is driven by a signer object with no key in it — it records the payload that needs signing and returns a worthless placeholder. There is no key material in our process to sign or withdraw with.",
  },
  {
    q: "What does /execute actually return?",
    a: "An unsigned order plus the exact EIP-712 typed data for it. You sign that locally with viem's signTypedData or ethers' _signTypedData. Until you do, the order is inert — it authorises nothing. We also return a postItYourself block with the raw HTTP call, so using our relay is optional.",
  },
  {
    q: "Why is Kalshi read-only?",
    a: "Placing orders on someone else's behalf at Kalshi requires CFTC registration as an FCM or introducing broker. No router has that, so nobody can legally route your Kalshi orders. We use Kalshi's live prices so you can see when it's the better venue, and execute on Polymarket, where self-custody trading is supported.",
  },
  {
    q: "What do I need before I can trade?",
    a: "A Polymarket account funded with USDC (deposit once at polymarket.com — this creates the proxy wallet that holds your funds), a key you can sign EIP-712 with, and a little USDT on X Layer for the routing fee. Quoting and market search need nothing at all.",
  },
  {
    q: "What does the AI do — and not do?",
    a: "POST /nl/quote uses 0G Compute (TEE-attested inference) only to map your sentence to live markets. It never prices, never signs, never touches money. Pricing is deterministic and published; execution requires your signature.",
  },
];

const STEPS = [
  {
    n: "01",
    t: "Find and price",
    d: "Search both venues, walk the real book for your size. Free, no account.",
    code: `GET /markets?q=fed`,
  },
  {
    n: "02",
    t: "Pay the toll",
    d: "One HTTP 402. $0.02 in USDT on X Layer buys a ready-to-sign order.",
    code: `POST /execute`,
  },
  {
    n: "03",
    t: "Sign it yourself",
    d: "Your key, your process. Flip cannot produce this signature.",
    code: `account.signTypedData(td)`,
  },
  {
    n: "04",
    t: "Hold your position",
    d: "The order fills into your own wallet. Track value and PnL any time.",
    code: `GET /positions/0x…`,
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
              <strong>Live on OKX.AI</strong> · non-custodial
            </Badge>
          </div>
          <h1 className="display rise d1 mx-auto max-w-3xl text-6xl leading-[1.02] tracking-tight sm:text-7xl lg:text-[84px] lg:leading-[0.98]">
            Your agent has a view.
            <br />
            Flip makes it a position.
          </h1>
          <p className="rise d2 mx-auto mt-7 max-w-lg text-[19px] leading-relaxed tracking-tight text-muted">
            The execution router for prediction agents. We find the market, build the order and
            relay it — you sign it and keep your funds. We never hold your money, and we can&rsquo;t.
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
              <RouteCard />
              <SignCard />
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
              · fees on x layer
            </span>
          </div>
        </header>

        {/* pastel tiles */}
        <section className="px-6 py-16">
          <div className="mx-auto grid max-w-6xl gap-7 md:grid-cols-3">
            <div className="noise rounded-2xl bg-mint px-6 py-12 text-center">
              <div className="soft mx-auto flex h-[202px] w-[202px] flex-col items-center justify-center rounded-2xl bg-card">
                <span className="text-sm font-semibold text-muted">our cut of your trade</span>
                <span className="display mt-2 text-6xl">0%</span>
                <span className="mt-2 rounded-md bg-bg px-3 py-1 font-mono text-xs">
                  $0.02 per route
                </span>
              </div>
              <h3 className="display mt-10 text-3xl">No skim</h3>
              <p className="mx-auto mt-3 max-w-[260px] text-[17px] leading-snug tracking-tight text-muted">
                A flat toll, not a percentage. Our builder fee is published and set to zero.
              </p>
            </div>

            <div className="noise rounded-2xl bg-blu px-6 py-12 text-center">
              <div className="soft mx-auto flex h-[202px] w-[202px] flex-col items-center justify-center rounded-2xl bg-card font-mono">
                <span className="text-xs text-muted">private keys held</span>
                <span className="display mt-1 text-7xl">0</span>
                <span className="mt-2 rounded-md bg-bg px-3 py-1 text-xs">by design</span>
              </div>
              <h3 className="display mt-10 text-3xl">We can&rsquo;t touch it</h3>
              <p className="mx-auto mt-3 max-w-[260px] text-[17px] leading-snug tracking-tight text-muted">
                Not a promise — a property. There is no key in our process to sign with.
              </p>
            </div>

            <div className="noise rounded-2xl bg-lilac px-6 py-12 text-center">
              <div className="soft mx-auto flex h-[202px] w-[202px] flex-col items-center justify-center rounded-2xl bg-card">
                <span className="text-sm font-semibold text-muted">two venues</span>
                <span className="display mt-2 text-5xl">one call</span>
                <span className="mt-3 rounded-md bg-bg px-3 py-1 font-mono text-xs">
                  best price wins
                </span>
              </div>
              <h3 className="display mt-10 text-3xl">Compare before you commit</h3>
              <p className="mx-auto mt-3 max-w-[260px] text-[17px] leading-snug tracking-tight text-muted">
                Polymarket and Kalshi priced side by side, so you see the better venue.
              </p>
            </div>
          </div>
        </section>

        {/* how it works */}
        <section className="px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="display mx-auto max-w-xl text-5xl leading-[1.02] tracking-tight sm:text-[58px]">
                Four calls, one position.
              </h2>
              <p className="mx-auto mt-5 max-w-md text-[19px] tracking-tight text-muted">
                No account to open with us. No funds to deposit with us. Bring your own wallet.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <div key={s.n} className="soft rounded-3xl bg-card p-6">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
                    {s.n}
                  </span>
                  <h3 className="display mt-3 text-2xl">{s.t}</h3>
                  <p className="mt-2 text-[15px] leading-snug text-muted">{s.d}</p>
                  <div className="term mt-4 overflow-x-auto p-3">
                    <code className="whitespace-pre">{s.code}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* playground + docs teasers */}
        <section className="px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <Badge>Powered by 0G Compute · TEE-attested</Badge>
              <h2 className="display mx-auto mt-6 max-w-xl text-5xl leading-[1.02] tracking-tight sm:text-[58px]">
                Say it. Price it.
              </h2>
              <p className="mx-auto mt-5 max-w-md text-[19px] tracking-tight text-muted">
                Describe a view in plain English — 0G maps it to live markets, the deterministic
                engine prices it, and you decide whether to sign.
              </p>
            </div>
            <div className="grid gap-7 md:grid-cols-2">
              <Link
                href="/playground"
                className="group rounded-3xl border border-line bg-card p-8 transition-colors hover:border-ink"
              >
                <div className="rounded-xl bg-[#1b1b1b] p-4 font-mono text-[12.5px] leading-[1.7]">
                  <span className="text-white/40">$</span>{" "}
                  <span className="text-white">&quot;$5 says the Fed holds in July&quot;</span>
                  <br />
                  <span className="text-[#7ee2a8]">→ matched · YES .42 · 10 shares</span>
                </div>
                <h3 className="display mt-6 text-3xl">Playground →</h3>
                <p className="mt-2 text-[16px] text-muted">
                  A live request client against the real API — natural language or raw JSON.
                </p>
              </Link>
              <Link
                href="/docs"
                className="group rounded-3xl border border-line bg-card p-8 transition-colors hover:border-ink"
              >
                <div className="rounded-xl bg-bg p-4 font-mono text-[12.5px] leading-[1.7] text-muted">
                  Introduction · Quickstart · Custody model
                  <br />
                  Endpoints · Signing · Payments (x402)
                </div>
                <h3 className="display mt-6 text-3xl">Documentation →</h3>
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
              <h2 className="display text-5xl tracking-tight sm:text-[58px]">The API</h2>
              <p className="mx-auto mt-5 max-w-md text-[19px] tracking-tight text-muted">
                Five endpoints. Four are free. One costs two cents.
              </p>
            </div>
            <div className="soft overflow-hidden rounded-3xl bg-card">
              {ENDPOINTS.map((e, i) => (
                <div
                  key={e.p}
                  className={`grid gap-3 px-6 py-5 sm:grid-cols-[190px_1fr_auto] sm:items-center ${
                    i > 0 ? "border-t border-line" : ""
                  }`}
                >
                  <div className="font-mono text-[13px]">
                    <span className="text-muted">{e.m}</span>{" "}
                    <span className="font-semibold">{e.p}</span>
                  </div>
                  <div>
                    <p className="text-[15px] leading-snug">{e.d}</p>
                    <p className="mt-1 font-mono text-[12px] text-muted">{e.r}</p>
                  </div>
                  <span className="justify-self-start rounded-md bg-bg px-2.5 py-1 font-mono text-[11px] text-muted sm:justify-self-end">
                    {e.cost}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* faq */}
        <section id="faq" className="px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="display mb-10 text-center text-5xl tracking-tight sm:text-[58px]">
              Questions
            </h2>
            <div className="soft overflow-hidden rounded-3xl bg-card">
              {FAQS.map((f, i) => (
                <details key={f.q} className={i > 0 ? "border-t border-line" : ""}>
                  <summary className="flex items-center justify-between px-6 py-5">
                    <span className="pr-4 text-[17px] font-semibold tracking-tight">{f.q}</span>
                    <span className="chev font-mono text-muted">▾</span>
                  </summary>
                  <p className="px-6 pb-6 text-[16px] leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* footer */}
      <footer className="px-6 py-14">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6">
          <div>
            <FlipMark height={22} />
            <p className="mt-3 max-w-xs text-[15px] leading-snug text-muted">
              The execution router for prediction agents. Your keys, your funds, your position.
            </p>
          </div>
          <div className="flex items-center gap-7 text-[15px] font-semibold text-muted">
            <Link href="/docs" className="hover:text-ink">Docs</Link>
            <Link href="/playground" className="hover:text-ink">Playground</Link>
            <a href={API} className="hover:text-ink">API</a>
            <a
              href="https://x.com/onflip_xyz"
              className="hover:text-ink"
              aria-label="Flip on X"
              target="_blank"
              rel="noreferrer"
            >
              <XIcon size={15} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

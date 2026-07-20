"use client";

import { useState } from "react";

const DEFAULT_BODY = `{
  "stakeUsd": 5,
  "legs": [
    { "venue": "polymarket", "id": "PASTE_CONDITION_ID", "side": "no" },
    { "venue": "kalshi", "id": "KXFED-27APR-T4.25", "side": "yes" }
  ]
}`;

type Tab = "nl" | "raw";

export function Playground({ api }: { api: string }) {
  const [tab, setTab] = useState<Tab>("nl");
  const [text, setText] = useState("$5 says the Fed holds rates in July and bitcoin keeps climbing");
  const [body, setBody] = useState(DEFAULT_BODY);
  const [out, setOut] = useState<string>("");
  const [headline, setHeadline] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setOut("");
    setHeadline("");
    try {
      const res =
        tab === "nl"
          ? await fetch(`${api}/nl/quote`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text }),
            })
          : await fetch(`${api}/parlay/quote`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
            });
      const json = await res.json();
      setOut(JSON.stringify(json, null, 2));
      const q = json.quote ?? json;
      if (q?.offeredMultiplier) {
        setHeadline(
          `${q.offeredMultiplier}x · $${q.stakeUsd} → $${q.potentialPayoutUsd} · quote ${q.quoteId ?? ""}`
        );
      } else if (json.error) {
        setHeadline(json.error);
      }
    } catch (err) {
      setOut(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="soft overflow-hidden rounded-3xl bg-card">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("nl")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "nl" ? "bg-dark text-white" : "text-muted hover:text-ink"
            }`}
          >
            Describe it
          </button>
          <button
            onClick={() => setTab("raw")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "raw" ? "bg-dark text-white" : "text-muted hover:text-ink"
            }`}
          >
            Raw request
          </button>
        </div>
        <span className="hidden font-mono text-[11px] text-muted sm:block">
          live · {api.replace("https://", "")}
        </span>
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        <div className="border-b border-line p-6 lg:border-b-0 lg:border-r">
          {tab === "nl" ? (
            <>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                POST /nl/quote · parsed by 0G Compute (TEE-attested)
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-2xl border border-line bg-bg p-4 text-[15px] outline-none focus:border-ink"
                placeholder="Describe your view in plain English…"
              />
            </>
          ) : (
            <>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                POST /parlay/quote · legs + stake
              </p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={9}
                spellCheck={false}
                className="w-full resize-none rounded-2xl border border-line bg-bg p-4 font-mono text-[12.5px] leading-relaxed outline-none focus:border-ink"
              />
            </>
          )}
          <button onClick={run} disabled={busy} className="pill mt-4 text-sm disabled:opacity-50">
            {busy ? "Quoting…" : "Send request"}
          </button>
        </div>

        <div className="p-6">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">response</p>
          {headline && (
            <div className="mb-3 rounded-2xl bg-mint px-4 py-3 font-mono text-sm font-semibold">
              {headline}
            </div>
          )}
          <pre className="term max-h-72 overflow-auto p-4">
            {out || "// hit Send — this calls the live API, real order books and all"}
          </pre>
        </div>
      </div>
    </div>
  );
}

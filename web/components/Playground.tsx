"use client";

import { useMemo, useState } from "react";

const ENDPOINTS: Record<string, { body: string; hint: string }> = {
  "/nl/quote": {
    body: `{\n  "text": "$5 says the Fed holds rates in July and bitcoin keeps climbing"\n}`,
    hint: "plain English → legs via 0G Compute → deterministic quote",
  },
  "/parlay/quote": {
    body: `{\n  "stakeUsd": 5,\n  "legs": [\n    { "venue": "polymarket", "id": "PASTE_CONDITION_ID", "side": "no" },\n    { "venue": "kalshi", "id": "KXFED-27APR-T4.25", "side": "yes" }\n  ]\n}`,
    hint: "legs + stake → multiplier + quoteId (free)",
  },
  "/parlay/place": {
    body: `{\n  "quoteId": "PASTE_QUOTE_ID"\n}`,
    hint: "no X-PAYMENT → 402 with USDT terms on X Layer",
  },
};

/** Hoppscotch-style JSON syntax colors. */
function highlight(json: string): React.ReactNode[] {
  const lines = json.split("\n");
  return lines.map((line, i) => (
    <div key={i} className="flex">
      <span className="w-10 shrink-0 select-none pr-3 text-right text-[#b9bcc5]">{i + 1}</span>
      <span
        className="whitespace-pre"
        dangerouslySetInnerHTML={{
          __html: line
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/"([^"]+)"(\s*:)/g, '<span style="color:#7c3aed">"$1"</span>$2')
            .replace(/: "([^"]*)"/g, ': <span style="color:#059669">"$1"</span>')
            .replace(/: (-?\d+\.?\d*)/g, ': <span style="color:#d97706">$1</span>')
            .replace(/: (true|false|null)/g, ': <span style="color:#dc2626">$1</span>'),
        }}
      />
    </div>
  ));
}

export function Playground({ api }: { api: string }) {
  const [endpoint, setEndpoint] = useState<keyof typeof ENDPOINTS>("/nl/quote");
  const [body, setBody] = useState(ENDPOINTS["/nl/quote"].body);
  const [respTab, setRespTab] = useState<"json" | "raw">("json");
  const [out, setOut] = useState("");
  const [status, setStatus] = useState<{ code: number; ok: boolean; ms: number; kb: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = (e: keyof typeof ENDPOINTS) => {
    setEndpoint(e);
    setBody(ENDPOINTS[e].body);
  };

  const run = async () => {
    setBusy(true);
    setOut("");
    setStatus(null);
    const t0 = performance.now();
    try {
      const res = await fetch(`${api}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const text = await res.text();
      const ms = Math.round(performance.now() - t0);
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {}
      setOut(pretty);
      setStatus({
        code: res.status,
        ok: res.ok || res.status === 402,
        ms,
        kb: (new Blob([text]).size / 1024).toFixed(2),
      });
    } catch (err) {
      setOut(String(err));
      setStatus({ code: 0, ok: false, ms: Math.round(performance.now() - t0), kb: "0" });
    } finally {
      setBusy(false);
    }
  };

  const highlighted = useMemo(() => (out ? highlight(out) : null), [out]);

  return (
    <div className="soft overflow-hidden rounded-2xl border border-line bg-card text-left">
      {/* request bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className="rounded-md bg-lilac px-3 py-2 font-mono text-xs font-bold text-[#7c3aed]">
          POST
        </span>
        <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-line bg-bg font-mono text-[13px]">
          <span className="hidden shrink-0 py-2.5 pl-3 text-muted md:block">
            {api.replace("https://", "")}
          </span>
          <select
            value={endpoint}
            onChange={(e) => pick(e.target.value as keyof typeof ENDPOINTS)}
            className="w-full cursor-pointer bg-transparent py-2.5 pl-3 pr-2 font-semibold outline-none md:pl-0"
          >
            {Object.keys(ENDPOINTS).map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="rounded-lg bg-dark px-7 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>

      {/* body editor */}
      <div className="border-b border-line px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex gap-5 text-[13px] font-semibold">
            <span className="border-b-2 border-[#7c3aed] pb-1">Body</span>
            <span className="pb-1 text-muted">Headers</span>
          </div>
          <span className="font-mono text-[11px] text-muted">{ENDPOINTS[endpoint].hint}</span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={Math.min(10, body.split("\n").length + 1)}
          spellCheck={false}
          className="w-full resize-none rounded-lg border border-line bg-white p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-[#7c3aed]"
        />
      </div>

      {/* status */}
      <div className="flex flex-wrap gap-6 border-b border-line px-5 py-3 font-mono text-[12px]">
        <span>
          Status:{" "}
          {status ? (
            <span className={status.ok ? "font-bold text-green" : "font-bold text-red"}>
              {status.code || "ERR"} {status.code === 200 ? "• OK" : status.code === 402 ? "• Payment Required" : ""}
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </span>
        <span>
          Time: {status ? <span className="font-bold text-green">{status.ms} ms</span> : <span className="text-muted">—</span>}
        </span>
        <span>
          Size: {status ? <span className="font-bold text-green">{status.kb} KB</span> : <span className="text-muted">—</span>}
        </span>
      </div>

      {/* response */}
      <div className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-5 text-[13px] font-semibold">
            <button
              onClick={() => setRespTab("json")}
              className={respTab === "json" ? "border-b-2 border-[#7c3aed] pb-1" : "pb-1 text-muted"}
            >
              JSON
            </button>
            <button
              onClick={() => setRespTab("raw")}
              className={respTab === "raw" ? "border-b-2 border-[#7c3aed] pb-1" : "pb-1 text-muted"}
            >
              Raw
            </button>
          </div>
          <span className="text-[12px] font-semibold text-muted">Response Body</span>
        </div>
        <div className="max-h-80 overflow-auto rounded-lg border border-line bg-white p-3 font-mono text-[12.5px] leading-[1.7]">
          {out ? (
            respTab === "json" ? (
              highlighted
            ) : (
              <pre className="whitespace-pre-wrap">{out}</pre>
            )
          ) : (
            <span className="text-muted">Hit Send — this calls the live API. Real order books, real quotes.</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Flip — parlay on anything. OKX.AI ASP entrypoint.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startHttp } from "./server.js";
import { startSettlementWatcher } from "./parlay/tickets.js";

// Minimal .env loader — existing env always wins.
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      // strip inline comments and whitespace
      process.env[m[1]] = m[2].replace(/\s+#.*$/, "").trim();
    }
  }
} catch {
  // no .env — fine
}

const port = Number(process.env.PORT ?? 8080);
startHttp(port);
startSettlementWatcher((ticket) => {
  console.log(
    JSON.stringify({ ts: Date.now(), type: "ticket_settled", ticketId: ticket.ticketId, status: ticket.status })
  );
});

console.error(`flip asp listening on :${port}`);
console.error(`dev mode: ${process.env.DEV_MODE === "1" ? "ON (payments simulated)" : "off"}`);
if (!process.env.X402_PAY_TO) {
  console.error("warning: X402_PAY_TO not set — set your X Layer treasury address before listing");
}

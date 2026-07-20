/**
 * Ticket store + settlement watcher.
 *
 * Tickets persist to data/tickets.json (survives restarts; Railway volume
 * in production). The watcher polls each open ticket's legs against the
 * venues' public resolution data: any leg lost → ticket LOST; all legs
 * won → ticket WON with payoutUsd owed to the payer address.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ParlayPrice } from "./pricing.js";
import type { Side, Venue } from "../venues/types.js";
import { polymarket } from "../venues/polymarket.js";
import { kalshi } from "../venues/kalshi.js";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");
const FILE = join(DATA_DIR, "tickets.json");

export interface TicketLeg {
  venue: Venue;
  id: string;
  side: Side;
  question: string;
  lockedPrice: number;
  result: "pending" | "won" | "lost";
}

export interface Ticket {
  ticketId: string;
  createdAt: string;
  status: "live" | "won" | "lost";
  stakeUsd: number;
  multiplier: number;
  potentialPayoutUsd: number;
  legs: TicketLeg[];
  payer?: string;
  paymentTxHash?: string;
  simulatedPayment: boolean;
  settledAt?: string;
}

const adapters = { polymarket, kalshi } as const;

class TicketStore {
  private tickets = new Map<string, Ticket>();
  private idempotency = new Map<string, string>(); // idem key -> ticketId

  constructor() {
    try {
      const raw = JSON.parse(readFileSync(FILE, "utf8")) as Ticket[];
      for (const t of raw) this.tickets.set(t.ticketId, t);
    } catch {
      // fresh store
    }
  }

  private persist() {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify([...this.tickets.values()], null, 2));
  }

  create(
    price: ParlayPrice,
    payment: { payer?: string; txHash?: string; simulated: boolean },
    idemKey?: string
  ): Ticket {
    if (idemKey) {
      const existing = this.idempotency.get(idemKey);
      if (existing) return this.tickets.get(existing)!;
    }
    const ticket: Ticket = {
      ticketId: randomUUID(),
      createdAt: new Date().toISOString(),
      status: "live",
      stakeUsd: price.stakeUsd,
      multiplier: price.offeredMultiplier,
      potentialPayoutUsd: price.potentialPayoutUsd,
      legs: price.legs.map((l) => ({
        venue: l.venue,
        id: l.id,
        side: l.side,
        question: l.question,
        lockedPrice: Math.round(l.price * 10000) / 10000,
        result: "pending",
      })),
      payer: payment.payer,
      paymentTxHash: payment.txHash,
      simulatedPayment: payment.simulated,
    };
    this.tickets.set(ticket.ticketId, ticket);
    if (idemKey) this.idempotency.set(idemKey, ticket.ticketId);
    this.persist();
    return ticket;
  }

  get(id: string): Ticket | undefined {
    return this.tickets.get(id);
  }

  list(): Ticket[] {
    return [...this.tickets.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Poll venue resolutions for live tickets. Returns tickets that changed. */
  async sweep(): Promise<Ticket[]> {
    const changed: Ticket[] = [];
    for (const ticket of this.tickets.values()) {
      if (ticket.status !== "live") continue;
      let dirty = false;
      for (const leg of ticket.legs) {
        if (leg.result !== "pending") continue;
        try {
          const winner = await adapters[leg.venue].resolution(leg.id);
          if (winner !== null) {
            leg.result = winner === leg.side ? "won" : "lost";
            dirty = true;
          }
        } catch {
          // venue hiccup — retry next sweep
        }
      }
      if (ticket.legs.some((l) => l.result === "lost")) {
        ticket.status = "lost";
        ticket.settledAt = new Date().toISOString();
        dirty = true;
      } else if (ticket.legs.every((l) => l.result === "won")) {
        ticket.status = "won";
        ticket.settledAt = new Date().toISOString();
        dirty = true;
      }
      if (dirty) changed.push(ticket);
    }
    if (changed.length > 0) this.persist();
    return changed;
  }
}

export const tickets = new TicketStore();

export function startSettlementWatcher(onChange: (t: Ticket) => void, everyMs = 60_000) {
  const run = async () => {
    const changed = await tickets.sweep().catch(() => []);
    for (const t of changed) onChange(t);
  };
  void run();
  return setInterval(run, everyMs);
}

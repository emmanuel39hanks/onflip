import { describe, expect, it } from "vitest";
import { priceParlay, PricingError, type PricingConfig } from "./pricing.js";
import type { PricedLeg } from "../venues/types.js";

const CFG: PricingConfig = {
  edgeBps: 700, // 7% edge
  maxLegs: 6,
  maxStakeUsd: 50,
  maxMultiplier: 100,
  maxPayoutUsd: 1000,
};

function leg(price: number, extra: Partial<PricedLeg> = {}): PricedLeg {
  return {
    venue: "polymarket",
    id: extra.id ?? `mkt-${price}`,
    side: "yes",
    question: "q",
    price,
    ...extra,
  };
}

describe("priceParlay", () => {
  it("prices a single position as type=single with fair = 1/price", () => {
    const p = priceParlay([leg(0.25)], 5, CFG);
    expect(p.type).toBe("single");
    expect(p.fairMultiplier).toBe(4); // 1 / 0.25
    // offered = 4 * 1 * 0.93 = 3.72
    expect(p.offeredMultiplier).toBe(3.72);
    expect(p.potentialPayoutUsd).toBe(18.6); // 5 * 3.72
  });

  it("multiplies independent legs and marks type=parlay", () => {
    const p = priceParlay([leg(0.5, { id: "a" }), leg(0.5, { id: "b" })], 10, CFG);
    expect(p.type).toBe("parlay");
    expect(p.fairMultiplier).toBe(4); // (1/0.5)*(1/0.5)
    expect(p.offeredMultiplier).toBe(3.72); // 4 * 0.93
    expect(p.correlationHaircut).toBe(1); // different categories
  });

  it("applies a correlation haircut to same-category legs", () => {
    const legs = [
      leg(0.5, { id: "a", category: "crypto" }),
      leg(0.5, { id: "b", category: "crypto" }),
    ];
    const p = priceParlay(legs, 10, CFG);
    expect(p.correlationHaircut).toBe(0.9); // 0.9 ^ 1 shared pair
    expect(p.warnings.some((w) => w.includes("correlation"))).toBe(true);
  });

  it("rejects duplicate markets", () => {
    expect(() => priceParlay([leg(0.5, { id: "x" }), leg(0.5, { id: "x" })], 5, CFG)).toThrow(
      PricingError
    );
  });

  it("rejects empty leg sets and over-cap stakes", () => {
    expect(() => priceParlay([], 5, CFG)).toThrow(PricingError);
    expect(() => priceParlay([leg(0.25)], 999, CFG)).toThrow(/max stake/);
  });

  it("refuses odds that price out at <= 1x after edge", () => {
    // a near-certain outcome: 1/0.98 * 0.93 < 1
    expect(() => priceParlay([leg(0.98)], 5, CFG)).toThrow(/1x/);
  });

  it("caps the multiplier and payout", () => {
    const p = priceParlay([leg(0.001)], 50, CFG);
    expect(p.offeredMultiplier).toBe(100); // capped
    expect(p.potentialPayoutUsd).toBe(1000); // capped
    expect(p.warnings.length).toBeGreaterThan(0);
  });
});

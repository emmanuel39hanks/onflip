import { describe, expect, it } from "vitest";
import { parseStake } from "./nl.js";

/**
 * A bare number in a trader's sentence is nearly always a price level, not a
 * wager. Reading "btc above 130000" as a $50 stake is the kind of quiet mistake
 * that produces a confident quote for something the caller never asked for.
 */
describe("parseStake", () => {
  it("reads an explicit dollar amount", () => {
    expect(parseStake("$5 says the fed holds")).toBe(5);
    expect(parseStake("$12.50 on rain tomorrow")).toBe(12.5);
  });

  it("reads a trailing currency word", () => {
    expect(parseStake("stake 3 dollars on rain")).toBe(3);
    expect(parseStake("7 usdt that btc dips")).toBe(7);
  });

  it("ignores price levels and magnitudes", () => {
    expect(parseStake("bitcoin above 100k by december")).toBe(5);
    expect(parseStake("will btc hit 130000")).toBe(5);
    expect(parseStake("eth over 4500 this month")).toBe(5);
    expect(parseStake("$130k btc by friday")).toBe(5);
  });

  it("falls back when there is no number at all", () => {
    expect(parseStake("fed holds rates")).toBe(5);
  });

  it("clamps to the allowed stake range", () => {
    expect(parseStake("$999 on the fed")).toBe(50);
    expect(parseStake("$0.10 on the fed")).toBe(1);
  });
});

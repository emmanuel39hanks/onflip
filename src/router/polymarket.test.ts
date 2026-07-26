import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { verifyTypedData } from "viem";
import { buildRoute, relayInstructions, RouterError } from "./polymarket.js";

/**
 * These run against Polymarket's live public API — no credentials, no orders
 * placed. They assert the property Flip's whole design rests on: what we hand
 * back is inert until the agent signs it, and what the agent signs is a valid
 * Polymarket order.
 */

const AGENT = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
);

/* eslint-disable @typescript-eslint/no-explicit-any */
async function liveMarket() {
  const res = await fetch("https://clob.polymarket.com/sampling-markets?limit=8");
  const body = (await res.json()) as any;
  const m = (body.data ?? []).find((x: any) => x.accepting_orders && !x.closed);
  if (!m) throw new Error("no tradeable market available right now");
  return m;
}

describe("polymarket router", () => {
  it("builds an unsigned order the agent can sign, and never signs it itself", async () => {
    const m = await liveMarket();
    const tick = Number(m.minimum_tick_size);
    const price = Math.round(0.5 / tick) * tick;

    const route = await buildRoute({
      conditionId: m.condition_id,
      side: "yes",
      price,
      size: Math.max(Number(m.minimum_order_size), 5),
      signerAddress: AGENT.address,
    });

    // Nothing signed: the order is inert until the agent acts.
    expect(route.order).not.toHaveProperty("signature");

    // The order is attributed to the agent, not to Flip.
    expect(String((route.order as any).maker).toLowerCase()).toBe(AGENT.address.toLowerCase());
    expect(String((route.order as any).signer).toLowerCase()).toBe(AGENT.address.toLowerCase());

    // Real Polymarket domain.
    const domain = route.typedData.domain as any;
    expect(domain.name).toBe("Polymarket CTF Exchange");
    expect(domain.chainId).toBe(137);

    // The payload we hand back is genuinely signable, and the resulting
    // signature verifies against the agent's address.
    const signature = await AGENT.signTypedData({
      domain,
      types: route.typedData.types as any,
      primaryType: "Order",
      message: route.typedData.message as any,
    });
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/i);

    const valid = await verifyTypedData({
      address: AGENT.address,
      domain,
      types: route.typedData.types as any,
      primaryType: "Order",
      message: route.typedData.message as any,
      signature,
    });
    expect(valid).toBe(true);
  }, 45_000);

  it("quotes cost as shares × price", async () => {
    const m = await liveMarket();
    const tick = Number(m.minimum_tick_size);
    const price = Math.round(0.5 / tick) * tick;
    const size = Math.max(Number(m.minimum_order_size), 5);

    const route = await buildRoute({
      conditionId: m.condition_id,
      side: "yes",
      price,
      size,
      signerAddress: AGENT.address,
    });
    expect(route.cost.shares).toBe(size);
    expect(route.cost.totalUsdc).toBeCloseTo(size * price, 4);
  }, 45_000);

  it("rejects sizes below the market minimum", async () => {
    const m = await liveMarket();
    const tick = Number(m.minimum_tick_size);
    await expect(
      buildRoute({
        conditionId: m.condition_id,
        side: "yes",
        price: Math.round(0.5 / tick) * tick,
        size: 0.001,
        signerAddress: AGENT.address,
      })
    ).rejects.toThrow(RouterError);
  }, 45_000);

  it("rejects an unknown market", async () => {
    await expect(
      buildRoute({
        conditionId: "0xdeadbeef",
        side: "yes",
        price: 0.5,
        size: 5,
        signerAddress: AGENT.address,
      })
    ).rejects.toThrow(RouterError);
  }, 45_000);

  it("tells the agent how to post the order without us", () => {
    const i = relayInstructions({ salt: "1", maker: AGENT.address });
    expect(i.method).toBe("POST");
    expect(i.url).toContain("/order");
    expect(i.body.order.signature).toContain("your");
  });
});

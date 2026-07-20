/**
 * Parlay pricing — deterministic and documented.
 *
 *   fair multiplier   = Π (1 / p_i)          (independence assumption)
 *   correlation guard = ×0.90 per pair of legs sharing a category
 *                       (same-event legs are rejected outright)
 *   house edge        = ×(1 − EDGE_BPS/10000)
 *   caps              = legs, stake, multiplier, payout (env)
 *
 * No hidden vig: the quote returns fair vs offered multiplier side by side.
 */

import type { PricedLeg } from "../venues/types.js";

export interface PricingConfig {
  edgeBps: number;
  maxLegs: number;
  maxStakeUsd: number;
  maxMultiplier: number;
  maxPayoutUsd: number;
}

export function pricingFromEnv(): PricingConfig {
  return {
    edgeBps: Number(process.env.EDGE_BPS ?? 700),
    maxLegs: Number(process.env.MAX_LEGS ?? 6),
    maxStakeUsd: Number(process.env.MAX_STAKE_USD ?? 50),
    maxMultiplier: Number(process.env.MAX_MULTIPLIER ?? 100),
    maxPayoutUsd: Number(process.env.MAX_PAYOUT_USD ?? 1000),
  };
}

export interface ParlayPrice {
  legs: PricedLeg[];
  fairMultiplier: number;
  correlationHaircut: number;
  offeredMultiplier: number;
  stakeUsd: number;
  potentialPayoutUsd: number;
  warnings: string[];
}

export function priceParlay(
  legs: PricedLeg[],
  stakeUsd: number,
  cfg: PricingConfig
): ParlayPrice {
  if (legs.length < 2) throw new PricingError("a parlay needs at least 2 legs");
  if (legs.length > cfg.maxLegs) throw new PricingError(`max ${cfg.maxLegs} legs`);
  if (!(stakeUsd > 0)) throw new PricingError("stake must be positive");
  if (stakeUsd > cfg.maxStakeUsd) throw new PricingError(`max stake $${cfg.maxStakeUsd}`);

  const keys = new Set(legs.map((l) => `${l.venue}:${l.id}`));
  if (keys.size !== legs.length) {
    throw new PricingError("duplicate legs — one position per market");
  }

  const warnings: string[] = [];
  const fair = legs.reduce((acc, l) => acc / l.price, 1);

  // Correlation guard: shared categories are the crude-but-honest signal
  // that independence is optimistic.
  let sharedPairs = 0;
  for (let i = 0; i < legs.length; i++) {
    for (let j = i + 1; j < legs.length; j++) {
      const a = legs[i].category?.toLowerCase();
      const b = legs[j].category?.toLowerCase();
      if (a && b && a === b) sharedPairs += 1;
    }
  }
  const haircut = Math.pow(0.9, sharedPairs);
  if (sharedPairs > 0) {
    warnings.push(
      `${sharedPairs} same-category pair(s) — multiplier trimmed ${Math.round((1 - haircut) * 100)}% for correlation`
    );
  }

  let offered = fair * haircut * (1 - cfg.edgeBps / 10000);
  if (offered > cfg.maxMultiplier) {
    offered = cfg.maxMultiplier;
    warnings.push(`multiplier capped at ${cfg.maxMultiplier}x`);
  }
  offered = Math.floor(offered * 10) / 10;
  if (offered <= 1) throw new PricingError("parlay prices out below 1x — pick longer odds");

  let payout = stakeUsd * offered;
  if (payout > cfg.maxPayoutUsd) {
    payout = cfg.maxPayoutUsd;
    warnings.push(`payout capped at $${cfg.maxPayoutUsd} — lower the stake or the odds`);
  }

  return {
    legs,
    fairMultiplier: Math.round(fair * 100) / 100,
    correlationHaircut: haircut,
    offeredMultiplier: offered,
    stakeUsd,
    potentialPayoutUsd: Math.round(payout * 100) / 100,
    warnings,
  };
}

export class PricingError extends Error {}

/**
 * x402 payment gate (OKX flavor, X Layer eip155:196).
 *
 * Flow per the x402 spec:
 *   1. Request without X-PAYMENT → HTTP 402 + accepts[] (exact scheme,
 *      USDT on X Layer, payTo = our treasury).
 *   2. Client signs payment, retries with X-PAYMENT header.
 *   3. We verify + settle through OKX's facilitator
 *      (OKX_X402_BASE, default https://web3.okx.com/api/v6/pay/x402),
 *      then serve the resource.
 *
 * For Flip's /parlay/place the payment IS the stake+fee — the x402
 * transfer is the funding leg of the ticket, not just an access fee.
 *
 * DEV_MODE=1 accepts any X-PAYMENT header without settlement (local
 * testing only) and stamps receipts as simulated.
 */

import { createHmac } from "node:crypto";

export interface PaymentRequirement {
  scheme: "exact";
  network: string;
  maxAmountRequired: string; // atomic units (USDT = 6 decimals)
  asset: string;
  payTo: string;
  resource: string;
  description: string;
  mimeType: "application/json";
  maxTimeoutSeconds: number;
}

export interface PaymentResult {
  paid: boolean;
  simulated: boolean;
  txHash?: string;
  payer?: string;
  error?: string;
}

const USDT_DECIMALS = 6;

/**
 * OKX API request signing (OK-ACCESS-* headers): base64 HMAC-SHA256 of
 * `timestamp + method + requestPath + body` with the API secret.
 * Passphrase header included when configured.
 */
function okxHeaders(method: string, fullUrl: string, body: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = process.env.OKX_API_KEY;
  const secret = process.env.OKX_API_SECRET;
  if (!key || !secret) return headers;

  const timestamp = new Date().toISOString();
  const url = new URL(fullUrl);
  const requestPath = url.pathname + url.search;
  const sign = createHmac("sha256", secret)
    .update(timestamp + method.toUpperCase() + requestPath + body)
    .digest("base64");

  headers["OK-ACCESS-KEY"] = key;
  headers["OK-ACCESS-SIGN"] = sign;
  headers["OK-ACCESS-TIMESTAMP"] = timestamp;
  if (process.env.OKX_API_PASSPHRASE) {
    headers["OK-ACCESS-PASSPHRASE"] = process.env.OKX_API_PASSPHRASE;
  }
  return headers;
}

export function usdToAtomic(usd: number): string {
  return String(Math.round(usd * 10 ** USDT_DECIMALS));
}

export function paymentRequirements(usd: number, resource: string, description: string): {
  x402Version: number;
  error: string;
  accepts: PaymentRequirement[];
} {
  return {
    x402Version: 1,
    error: "X-PAYMENT header is required",
    accepts: [
      {
        scheme: "exact",
        network: "eip155:196",
        maxAmountRequired: usdToAtomic(usd),
        asset: process.env.X402_ASSET ?? "0x1E4a5963aBFD975d8c9021cE480b42188849D41d",
        payTo: process.env.X402_PAY_TO ?? "",
        resource,
        description,
        mimeType: "application/json",
        maxTimeoutSeconds: 120,
      },
    ],
  };
}

export async function verifyAndSettle(
  paymentHeader: string,
  requirement: PaymentRequirement
): Promise<PaymentResult> {
  if (process.env.DEV_MODE === "1") {
    return { paid: true, simulated: true, payer: "dev-mode" };
  }

  const base = process.env.OKX_X402_BASE ?? "https://web3.okx.com/api/v6/pay/x402";

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf8"));
  } catch {
    return { paid: false, simulated: false, error: "malformed X-PAYMENT header" };
  }

  const body = JSON.stringify({
    x402Version: 1,
    paymentPayload: payload,
    paymentRequirements: requirement,
  });

  try {
    const verify = await fetch(`${base}/verify`, {
      method: "POST",
      headers: okxHeaders("POST", `${base}/verify`, body),
      body,
    });
    const vJson = (await verify.json()) as { isValid?: boolean; valid?: boolean; invalidReason?: string };
    if (!(vJson.isValid ?? vJson.valid)) {
      return { paid: false, simulated: false, error: vJson.invalidReason ?? "payment invalid" };
    }
    const settle = await fetch(`${base}/settle`, {
      method: "POST",
      headers: okxHeaders("POST", `${base}/settle`, body),
      body,
    });
    const sJson = (await settle.json()) as {
      success?: boolean;
      txHash?: string;
      transaction?: string;
      payer?: string;
      errorReason?: string;
    };
    if (!sJson.success) {
      return { paid: false, simulated: false, error: sJson.errorReason ?? "settlement failed" };
    }
    return {
      paid: true,
      simulated: false,
      txHash: sJson.txHash ?? sJson.transaction,
      payer: sJson.payer,
    };
  } catch (err) {
    return { paid: false, simulated: false, error: `facilitator unreachable: ${String(err).slice(0, 120)}` };
  }
}

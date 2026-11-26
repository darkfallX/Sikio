import { AEVUM_CONFIG } from "./aevum";
import type { ExactEvmPayload } from "./eip3009";

/**
 * HTTP 402 Payment Required (x402) protocol payload for Sikio's own AI Transcription Service.
 * Clearly labelled as operated by Sikio. Accepts on-chain tUSD8 receipts on Aevum Testnet (44005)
 * or transparent sandbox receipts when running without live testnet credentials.
 */
export interface X402PaymentChallenge {
  x402Version: 1;
  scheme: "exact";
  network: "eip155:44005";
  asset: `0x${string}`;
  assetSymbol: "tUSD8";
  decimals: 6;
  maxAmountRequired: string; // base units (6 decimals)
  amountDisplay: string; // e.g. "0.04 tUSD8"
  payTo: `0x${string}`;
  requestId: string;
  resource: string;
  operator: string;
  description: string;
  expiresAt: number;
}

export interface X402PaymentHeader {
  x402Version: 1;
  network: "eip155:44005";
  requestId: string;
  /** Standard x402 "exact" scheme: a signed EIP-3009 tUSD8 transfer the server settles. */
  scheme?: "exact";
  payload?: ExactEvmPayload;
  /** Older proof: a ReviewEscrow.payInference tx the payer already sent (browser wallet). */
  txHash?: `0x${string}`;
  payer: `0x${string}`;
  amountBaseUnits: string;
  mode: "aevum-live" | "sandbox";
}

// Sikio-operated transcription provider address (explicitly disclosed as ours)
export const SIKIO_TRANSCRIPTION_PROVIDER: `0x${string}` =
  "0x71C051C10000000000000000000000000000A402";

export function buildX402Challenge(params: {
  requestId: string;
  amountTusd8: number;
  resource: string;
  /** Sikio's own server address when live keys are set, so the fee is not burned. */
  payTo?: `0x${string}`;
}): X402PaymentChallenge {
  const baseUnits = Math.round(params.amountTusd8 * 1_000_000).toString();
  return {
    x402Version: 1,
    scheme: "exact",
    network: "eip155:44005",
    asset: AEVUM_CONFIG.tusd8Address,
    assetSymbol: "tUSD8",
    decimals: 6,
    maxAmountRequired: baseUnits,
    amountDisplay: `${params.amountTusd8.toFixed(2)} tUSD8`,
    payTo: params.payTo ?? SIKIO_TRANSCRIPTION_PROVIDER,
    requestId: params.requestId,
    resource: params.resource,
    operator: "Sikio Transcription Service (self-hosted endpoint)",
    description:
      "Word-level ASR with confidence probabilities for African English & code-switched speech",
    expiresAt: Math.floor(Date.now() / 1000) + 300,
  };
}

export function encodeX402Header(payload: X402PaymentHeader): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

export function decodeX402Header(raw: string | null): X402PaymentHeader | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as X402PaymentHeader;
    const hasTx = typeof parsed.txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(parsed.txHash);
    const a = parsed.payload?.authorization;
    const hasAuth =
      parsed.scheme === "exact" &&
      typeof parsed.payload?.signature === "string" &&
      parsed.payload.signature.startsWith("0x") &&
      !!a &&
      [a.from, a.to, a.nonce].every((v) => typeof v === "string" && v.startsWith("0x")) &&
      [a.value, a.validAfter, a.validBefore].every((v) => typeof v === "string" && /^\d+$/.test(v));
    if (
      parsed.x402Version !== 1 ||
      parsed.network !== "eip155:44005" ||
      !parsed.requestId ||
      (!hasTx && !hasAuth)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { AEVUM_CONFIG } from "../aevum";
import { ExactEvmPayload, X402PaymentRejected, nonceForRequest, verifyExactPayment } from "../eip3009";
import { decodeX402Header, encodeX402Header } from "../x402";

// Throwaway test keys, never funded.
const agent = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const other = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const provider = getAddress("0x75d0000000000000000000000000000000004d03");

async function sign(overrides: Partial<ExactEvmPayload["authorization"]> = {}, signer = agent) {
  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: agent.address,
    to: provider,
    value: "40000",
    validAfter: String(now - 60),
    validBefore: String(now + 300),
    nonce: nonceForRequest("x402-test1"),
    ...overrides,
  };
  const signature = await signer.signTypedData({
    domain: { name: "tUSD8", version: "2", chainId: AEVUM_CONFIG.chainId, verifyingContract: AEVUM_CONFIG.tusd8Address },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      ...authorization,
      to: getAddress(authorization.to),
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
    },
  });
  return { signature, authorization } as ExactEvmPayload;
}

const expected = { requestId: "x402-test1", payTo: provider, minAmountBaseUnits: 40000n };

describe("x402 exact (EIP-3009) facilitator checks", () => {
  it("refuses a payment to another address", async () => {
    const p = await sign({ to: other.address });
    await expect(verifyExactPayment(p, expected)).rejects.toThrow(/not addressed/);
  });

  it("refuses a payment below the server's price", async () => {
    const p = await sign({ value: "39999" });
    await expect(verifyExactPayment(p, expected)).rejects.toThrow(/below the price/);
  });

  it("refuses a payment signed for another request", async () => {
    const p = await sign({ nonce: nonceForRequest("x402-other") });
    await expect(verifyExactPayment(p, expected)).rejects.toThrow(/different request/);
  });

  it("refuses an expired authorization", async () => {
    const now = Math.floor(Date.now() / 1000);
    const p = await sign({ validBefore: String(now - 1) });
    await expect(verifyExactPayment(p, expected)).rejects.toThrow(/expired/);
  });

  it("refuses a signature from someone other than the payer", async () => {
    const p = await sign({}, other);
    await expect(verifyExactPayment(p, expected)).rejects.toBeInstanceOf(X402PaymentRejected);
    await expect(verifyExactPayment(p, expected)).rejects.toThrow(/does not match the payer/);
  });

  it("carries the signed payload through the X-PAYMENT header", async () => {
    const p = await sign();
    const header = encodeX402Header({
      x402Version: 1,
      network: "eip155:44005",
      requestId: "x402-test1",
      scheme: "exact",
      payload: p,
      payer: agent.address,
      amountBaseUnits: "40000",
      mode: "aevum-live",
    });
    expect(decodeX402Header(header)?.payload?.signature).toBe(p.signature);
    // a header with neither a tx hash nor a signed payload is refused
    const bare = Buffer.from(JSON.stringify({ x402Version: 1, network: "eip155:44005", requestId: "x" })).toString("base64");
    expect(decodeX402Header(bare)).toBeNull();
  });
});

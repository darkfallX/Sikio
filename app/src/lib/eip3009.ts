import {
  Address,
  Hex,
  concat,
  createWalletClient,
  formatUnits,
  getAddress,
  keccak256,
  parseAbi,
  parseSignature,
  parseUnits,
  recoverTypedDataAddress,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { AEVUM_CONFIG, aevumTestnet } from "./aevum";
import { publicClient, rpcTransport } from "./settlement";

/**
 * Standard x402 "exact" payments with tUSD8's EIP-3009 signed transfers.
 *
 * - The agent SIGNS a transferWithAuthorization for exactly the asked price, valid for
 *   a few minutes, with a nonce bound to the x402 requestId. It holds no gas and only
 *   a small float, so it can never spend more than the float.
 * - Sikio's facilitator VERIFIES the signature, payee, amount, time window and nonce,
 *   then SETTLES it on chain (the operator pays the gas). tUSD8 itself enforces that
 *   each nonce is used once, so one request can be paid once.
 *
 * QDay lists an x402 facilitator as live but publishes no endpoint, so Sikio runs the
 * same verify and settle steps itself; they can be pointed at QDay's when it exists.
 */

const TUSD8_DECIMALS = 6;
const AGENT_FLOAT = "0.40"; // what the operator tops the agent up to when it runs low
const VALID_FOR_SECONDS = 300;

const TUSD8_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
]);

const DOMAIN = {
  name: "tUSD8",
  version: "2",
  chainId: AEVUM_CONFIG.chainId,
  verifyingContract: AEVUM_CONFIG.tusd8Address,
} as const;

const TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/** The x402 "exact" EVM payload: an EIP-3009 authorization and its signature. */
export interface ExactEvmPayload {
  signature: Hex;
  authorization: {
    from: Address;
    to: Address;
    value: string; // base units
    validAfter: string;
    validBefore: string;
    nonce: Hex;
  };
}

function normalizeKey(raw: string | undefined): Hex | null {
  const k = raw?.trim();
  if (!k) return null;
  const withPrefix = k.startsWith("0x") ? k : `0x${k}`;
  return /^0x[0-9a-fA-F]{64}$/.test(withPrefix) ? (withPrefix as Hex) : null;
}

const OPERATOR_KEY = normalizeKey(process.env.SIKIO_OPERATOR_PRIVATE_KEY);
// The agent's own key: SIKIO_AGENT_PRIVATE_KEY, or derived from the operator key so a
// deployment needs no extra secret. It only ever holds a small tUSD8 float.
const AGENT_KEY: Hex | null =
  normalizeKey(process.env.SIKIO_AGENT_PRIVATE_KEY) ||
  (OPERATOR_KEY ? keccak256(concat([OPERATOR_KEY, toHex("sikio-x402-agent-v1")])) : null);

export function x402AgentAddress(): Address | null {
  return AGENT_KEY ? privateKeyToAccount(AGENT_KEY).address : null;
}

/** The nonce for a request: one authorization per requestId, enforced by tUSD8. */
export function nonceForRequest(requestId: string): Hex {
  return keccak256(toHex(`sikio-x402:${requestId}`));
}

function operatorWallet() {
  if (!OPERATOR_KEY) throw new Error("Live payments are not configured.");
  const account = privateKeyToAccount(OPERATOR_KEY);
  return {
    account,
    wallet: createWalletClient({ account, chain: aevumTestnet, transport: rpcTransport() }),
  };
}

/** Tops the agent up to its float from the operator when it cannot cover `need`. */
async function ensureAgentFloat(agent: Address, need: bigint): Promise<void> {
  const balance = (await publicClient.readContract({
    address: AEVUM_CONFIG.tusd8Address,
    abi: TUSD8_ABI,
    functionName: "balanceOf",
    args: [agent],
  })) as bigint;
  if (balance >= need) return;
  const float = parseUnits(AGENT_FLOAT, TUSD8_DECIMALS);
  const { wallet } = operatorWallet();
  const hash = await wallet.writeContract({
    address: AEVUM_CONFIG.tusd8Address,
    abi: TUSD8_ABI,
    functionName: "transfer",
    args: [agent, float > need ? float - balance : need - balance],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Could not top up the agent's float.");
}

/** Agent side: sign an x402 payment for exactly `amount` to `payTo`. No gas, no tx. */
export async function signX402Payment(params: {
  requestId: string;
  payTo: Address;
  amountBaseUnits: bigint;
}): Promise<ExactEvmPayload> {
  if (!AGENT_KEY) throw new Error("Live payments are not configured.");
  const agent = privateKeyToAccount(AGENT_KEY);
  await ensureAgentFloat(agent.address, params.amountBaseUnits);
  const now = Math.floor(Date.now() / 1000);
  const message = {
    from: agent.address,
    to: getAddress(params.payTo),
    value: params.amountBaseUnits,
    validAfter: BigInt(now - 60),
    validBefore: BigInt(now + VALID_FOR_SECONDS),
    nonce: nonceForRequest(params.requestId),
  };
  const signature = await agent.signTypedData({
    domain: DOMAIN,
    types: TYPES,
    primaryType: "TransferWithAuthorization",
    message,
  });
  return {
    signature,
    authorization: {
      from: message.from,
      to: message.to,
      value: message.value.toString(),
      validAfter: message.validAfter.toString(),
      validBefore: message.validBefore.toString(),
      nonce: message.nonce,
    },
  };
}

export class X402PaymentRejected extends Error {}

/** Thrown when the authorization was already settled; carries the earlier tx if found. */
export class X402AlreadySettled extends Error {
  constructor(public txHash: Hex | null) {
    super("This payment was already settled.");
  }
}

/**
 * Facilitator /verify: everything is checked before any gas is spent. The price and
 * payee come from the server, never from the payment itself.
 */
export async function verifyExactPayment(
  payload: ExactEvmPayload,
  expected: { requestId: string; payTo: Address; minAmountBaseUnits: bigint }
): Promise<void> {
  const a = payload.authorization;
  let value: bigint, validAfter: bigint, validBefore: bigint;
  try {
    value = BigInt(a.value);
    validAfter = BigInt(a.validAfter);
    validBefore = BigInt(a.validBefore);
  } catch {
    throw new X402PaymentRejected("The payment authorization is malformed.");
  }
  if (getAddress(a.to) !== getAddress(expected.payTo)) {
    throw new X402PaymentRejected("The payment is not addressed to this service.");
  }
  if (value < expected.minAmountBaseUnits) {
    throw new X402PaymentRejected("The payment is below the price.");
  }
  if (a.nonce.toLowerCase() !== nonceForRequest(expected.requestId).toLowerCase()) {
    throw new X402PaymentRejected("The payment is for a different request.");
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (validAfter > now || validBefore <= now + 5n) {
    throw new X402PaymentRejected("The payment authorization has expired.");
  }
  const signer = await recoverTypedDataAddress({
    domain: DOMAIN,
    types: TYPES,
    primaryType: "TransferWithAuthorization",
    message: { from: getAddress(a.from), to: getAddress(a.to), value, validAfter, validBefore, nonce: a.nonce },
    signature: payload.signature,
  });
  if (signer !== getAddress(a.from)) {
    throw new X402PaymentRejected("The payment signature does not match the payer.");
  }
  const used = (await publicClient.readContract({
    address: AEVUM_CONFIG.tusd8Address,
    abi: TUSD8_ABI,
    functionName: "authorizationState",
    args: [getAddress(a.from), a.nonce],
  })) as boolean;
  if (used) throw new X402AlreadySettled(await findAuthorizationTx(getAddress(a.from), a.nonce));
  const balance = (await publicClient.readContract({
    address: AEVUM_CONFIG.tusd8Address,
    abi: TUSD8_ABI,
    functionName: "balanceOf",
    args: [getAddress(a.from)],
  })) as bigint;
  if (balance < value) {
    throw new X402PaymentRejected(
      `The payer holds ${formatUnits(balance, TUSD8_DECIMALS)} tUSD8, less than the price.`
    );
  }
}

/** Facilitator /settle: submits the signed transfer on chain and waits for it. */
export async function settleExactPayment(payload: ExactEvmPayload): Promise<Hex> {
  const a = payload.authorization;
  const { v, r, s, yParity } = parseSignature(payload.signature);
  const { wallet } = operatorWallet();
  const hash = await wallet.writeContract({
    address: AEVUM_CONFIG.tusd8Address,
    abi: TUSD8_ABI,
    functionName: "transferWithAuthorization",
    args: [
      getAddress(a.from),
      getAddress(a.to),
      BigInt(a.value),
      BigInt(a.validAfter),
      BigInt(a.validBefore),
      a.nonce,
      Number(v ?? BigInt(yParity + 27)),
      r,
      s,
    ],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new X402PaymentRejected("tUSD8 refused the signed transfer.");
  }
  return hash;
}

/** Finds the transaction that used an authorization (RPC caps logs at 1,000 blocks). */
async function findAuthorizationTx(authorizer: Address, nonce: Hex): Promise<Hex | null> {
  try {
    const latest = await publicClient.getBlockNumber();
    for (let to = latest, i = 0; i < 5 && to > 0n; i++, to -= 1000n) {
      const from = to >= 999n ? to - 999n : 0n;
      const logs = await publicClient.getLogs({
        address: AEVUM_CONFIG.tusd8Address,
        event: TUSD8_ABI[5],
        args: { authorizer, nonce },
        fromBlock: from,
        toBlock: to,
      });
      if (logs.length) return logs[logs.length - 1].transactionHash as Hex;
    }
  } catch {
    /* not found */
  }
  return null;
}

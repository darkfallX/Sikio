import { defineChain, parseAbi } from "viem";

/**
 * Verified QDay Aevum Testnet configuration (from qday.io/build & qday-io/qday-wiki).
 * Chain ID: 44005 (0xABE5)
 */
export const aevumTestnet = defineChain({
  id: 44005,
  name: "QDay Aevum",
  nativeCurrency: {
    name: "tQDAY",
    symbol: "tQDAY",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc-test.qday.info"],
      webSocket: ["wss://rpc-test.qday.info"],
    },
  },
  blockExplorers: {
    default: {
      name: "Aevum Explorer",
      url: "https://explorer-test.qday.info",
    },
  },
  testnet: true,
});

export const AEVUM_CONFIG = {
  chainId: 44005,
  chainIdHex: "0xABE5" as const,
  chainName: "QDay Aevum",
  rpcUrl: process.env.NEXT_PUBLIC_AEVUM_RPC_URL || "https://rpc-test.qday.info",
  explorerUrl:
    process.env.NEXT_PUBLIC_AEVUM_EXPLORER_URL || "https://explorer-test.qday.info",
  faucetUrl: "https://faucet.qday.info/en",
  // Official Aevum Testnet tUSD8 ERC-20 (6 decimals)
  tusd8Address: (process.env.NEXT_PUBLIC_TUSD8_ADDRESS ||
    "0x456569838f1d43009A91ebA4263147Afd7233483") as `0x${string}`,
  tusd8Decimals: 6,
  // Verified live on Aevum Testnet (Chain 44005)
  entryPointV07Address:
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as `0x${string}`,
  // Deployed ReviewEscrow contract address on QDay Aevum Testnet (Chain 44005)
  reviewEscrowAddress: (process.env.NEXT_PUBLIC_REVIEW_ESCROW_ADDRESS ||
    "0x36Cf1caB839bf01306E647C56B2e44e7d4a35E6b") as `0x${string}`,
} as const;

export const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

export const REVIEW_ESCROW_ABI = parseAbi([
  "function token() view returns (address)",
  "function nextBatchId() view returns (uint256)",
  "function availableBudget(uint256 batchId) view returns (uint256)",
  "function createBatch(address agent, address approver, uint256 maxBudget, uint256 maxTaskFee, uint64 expiry, bool enforceEditorAllowlist, bytes32 labelHash, uint256 initialDeposit) returns (uint256)",
  "function fundBatch(uint256 batchId, uint256 amount)",
  "function setTrustedEditor(uint256 batchId, address editor, bool allowed)",
  "function revokeAgent(uint256 batchId)",
  "function payInference(uint256 batchId, bytes32 requestId, address provider, uint256 amount)",
  "function offerTask(uint256 batchId, bytes32 taskId, address editor, uint256 fee, uint64 taskExpiry, bytes32 excerptHash)",
  "function submitCorrection(bytes32 taskId, bytes32 correctionHash)",
  "function acceptTask(bytes32 taskId)",
  "function rejectTask(bytes32 taskId, bytes32 reasonHash)",
  "function expireTask(bytes32 taskId)",
  "function withdrawAvailable(uint256 batchId, address to) returns (uint256)",
]);

export function explorerTxUrl(txHash: string): string {
  return `${AEVUM_CONFIG.explorerUrl}/tx/${txHash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${AEVUM_CONFIG.explorerUrl}/address/${address}`;
}

export function shortAddr(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHash(hash: string): string {
  if (!hash || hash.length < 16) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function formatTusd8(amount: number): string {
  return `${amount.toFixed(2)} tUSD8`;
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

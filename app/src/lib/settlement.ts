import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  parseAbi,
  keccak256,
  toHex,
  getAddress,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";
import { aevumTestnet, AEVUM_CONFIG } from "./aevum";
import { getDataDir, writeJsonAtomic } from "./storage";

/**
 * Server-side live settlement for Sikio.
 *
 * Runs the real on-chain ReviewEscrow lifecycle for a single review task on QDay
 * Aevum Testnet (chain 44005), so the approver can pay a native-speaker editor
 * EXACTLY ONCE in tUSD8 from the browser with no wallet, no key, no extension.
 *
 * The chain proves the agreed fee was paid once for THIS task's correction hash
 * (derived from the editor's actual submitted text). It never fabricates a hash:
 * every tx is mined and its receipt checked before it is labelled "aevum-live".
 */

const ESCROW_ABI = parseAbi([
  "function nextBatchId() view returns (uint256)",
  "function availableBudget(uint256 batchId) view returns (uint256)",
  "function batches(uint256) view returns (address agency, address agent, address approver, uint256 maxBudget, uint256 funded, uint256 spent, uint256 reserved, uint256 maxTaskFee, uint64 expiry, bool enforceEditorAllowlist, bool agentRevoked, bytes32 labelHash)",
  "function tasks(bytes32) view returns (uint256 batchId, address editor, uint256 fee, uint64 expiry, uint8 status, bytes32 excerptHash, bytes32 correctionHash)",
  "function editorNonces(address) view returns (uint256)",
  "function trustedEditors(uint256, address) view returns (bool)",
  "function createBatch(address agent, address approver, uint256 maxBudget, uint256 maxTaskFee, uint64 expiry, bool enforceEditorAllowlist, bytes32 labelHash, uint256 initialDeposit) returns (uint256)",
  "function setTrustedEditor(uint256 batchId, address editor, bool allowed)",
  "function offerTask(uint256 batchId, bytes32 taskId, address editor, uint256 fee, uint64 taskExpiry, bytes32 excerptHash)",
  "function submitCorrectionBySig(bytes32 taskId, bytes32 correctionHash, uint256 deadline, bytes signature)",
  "function acceptTask(bytes32 taskId)",
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const TUSD8_DECIMALS = 6;
const BATCH_MAX_BUDGET = "2.00"; // tUSD8 reserved per live batch
const BATCH_MAX_TASK_FEE = "0.50"; // tUSD8 ceiling per task

function normalizeKey(raw: string | undefined): Hex | null {
  if (!raw) return null;
  const k = raw.trim();
  if (!k) return null;
  const withPrefix = k.startsWith("0x") ? k : `0x${k}`;
  return /^0x[0-9a-fA-F]{64}$/.test(withPrefix) ? (withPrefix as Hex) : null;
}

const OPERATOR_KEY = normalizeKey(process.env.SIKIO_OPERATOR_PRIVATE_KEY);
const EDITOR_KEY = normalizeKey(process.env.SIKIO_EDITOR_PRIVATE_KEY);

export function isLiveSettlementConfigured(): boolean {
  return Boolean(OPERATOR_KEY && EDITOR_KEY && AEVUM_CONFIG.reviewEscrowAddress);
}

export function liveSettlementAddresses(): {
  operator: Address | null;
  editor: Address | null;
  escrow: Address | null;
} {
  return {
    operator: OPERATOR_KEY ? privateKeyToAccount(OPERATOR_KEY).address : null,
    editor: EDITOR_KEY ? privateKeyToAccount(EDITOR_KEY).address : null,
    escrow: AEVUM_CONFIG.reviewEscrowAddress || null,
  };
}

const publicClient = createPublicClient({
  chain: aevumTestnet,
  transport: http(AEVUM_CONFIG.rpcUrl),
});

interface LiveBatchRecord {
  batchId: number;
  editorAddress: Address;
  createdAt: string;
}

function liveBatchFile(): string {
  return path.join(getDataDir(), "sikio-live-escrow.json");
}

function readLiveBatch(): LiveBatchRecord | null {
  try {
    const raw = fs.readFileSync(liveBatchFile(), "utf8");
    const parsed = JSON.parse(raw) as LiveBatchRecord;
    if (parsed && typeof parsed.batchId === "number" && parsed.editorAddress) {
      return parsed;
    }
  } catch {
    /* no live batch yet */
  }
  return null;
}

// Prevent two concurrent approvals from both trying to create a batch.
let batchSetupLock: Promise<void> | null = null;

export interface SettlementResult {
  mode: "aevum-live";
  batchId: number;
  taskIdBytes32: Hex;
  editorAddress: Address;
  operatorAddress: Address;
  correctionHash: Hex;
  offerTxHash: Hex | null;
  submitTxHash: Hex | null;
  acceptTxHash: Hex;
  feeTusd8: number;
  editorBalanceTusd8: number;
  explorerTxUrl: string;
}

export interface SettlementTaskInput {
  taskIdBytes32: Hex;
  correctionHash: Hex;
  excerptHash: Hex;
  feeTusd8: number;
}

function requireConfigured(): { operatorKey: Hex; editorKey: Hex; escrow: Address } {
  if (!OPERATOR_KEY || !EDITOR_KEY || !AEVUM_CONFIG.reviewEscrowAddress) {
    throw new Error(
      "Live settlement is not configured. Set SIKIO_OPERATOR_PRIVATE_KEY and SIKIO_EDITOR_PRIVATE_KEY."
    );
  }
  return {
    operatorKey: OPERATOR_KEY,
    editorKey: EDITOR_KEY,
    escrow: getAddress(AEVUM_CONFIG.reviewEscrowAddress),
  };
}

function operatorWallet(operatorKey: Hex) {
  const account = privateKeyToAccount(operatorKey);
  const wallet = createWalletClient({
    account,
    chain: aevumTestnet,
    transport: http(AEVUM_CONFIG.rpcUrl),
  });
  return { account, wallet };
}

async function batchIsUsable(
  escrow: Address,
  record: LiveBatchRecord | null,
  operator: Address,
  editor: Address,
  feeUnits: bigint
): Promise<boolean> {
  if (!record) return false;
  try {
    const batch = await publicClient.readContract({
      address: escrow,
      abi: ESCROW_ABI,
      functionName: "batches",
      args: [BigInt(record.batchId)],
    });
    const agency = batch[0] as Address;
    const agent = batch[1] as Address;
    const expiry = batch[8] as bigint;
    if (agency.toLowerCase() !== operator.toLowerCase()) return false;
    if (agent.toLowerCase() !== operator.toLowerCase()) return false;
    if (record.editorAddress.toLowerCase() !== editor.toLowerCase()) return false;
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    if (expiry <= nowSec + 3700n) return false; // need headroom for task expiry
    const avail = await publicClient.readContract({
      address: escrow,
      abi: ESCROW_ABI,
      functionName: "availableBudget",
      args: [BigInt(record.batchId)],
    });
    return (avail as bigint) >= feeUnits;
  } catch {
    return false;
  }
}

async function createLiveBatch(
  escrow: Address,
  operatorKey: Hex,
  editor: Address
): Promise<LiveBatchRecord> {
  const { account, wallet } = operatorWallet(operatorKey);
  const operator = account.address;
  const maxBudget = parseUnits(BATCH_MAX_BUDGET, TUSD8_DECIMALS);
  const maxTaskFee = parseUnits(BATCH_MAX_TASK_FEE, TUSD8_DECIMALS);

  // Ensure the operator actually holds enough tUSD8 to fund the batch.
  const balance = (await publicClient.readContract({
    address: AEVUM_CONFIG.tusd8Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [operator],
  })) as bigint;
  if (balance < maxBudget) {
    throw new Error(
      `Operator wallet ${operator} holds ${formatUnits(balance, TUSD8_DECIMALS)} tUSD8, needs ${BATCH_MAX_BUDGET}. Fund it at ${AEVUM_CONFIG.faucetUrl} or lower BATCH_MAX_BUDGET.`
    );
  }

  // Approve the escrow to pull the batch deposit (if allowance is short).
  const allowance = (await publicClient.readContract({
    address: AEVUM_CONFIG.tusd8Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [operator, escrow],
  })) as bigint;
  if (allowance < maxBudget) {
    const approveHash = await wallet.writeContract({
      address: AEVUM_CONFIG.tusd8Address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [escrow, maxBudget],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const nextId = (await publicClient.readContract({
    address: escrow,
    abi: ESCROW_ABI,
    functionName: "nextBatchId",
  })) as bigint;

  const nowSec = Math.floor(Date.now() / 1000);
  const expiry = BigInt(nowSec + 7 * 86400);
  const labelHash = keccak256(toHex(`sikio-live-${nowSec}`));

  const createHash = await wallet.writeContract({
    address: escrow,
    abi: ESCROW_ABI,
    functionName: "createBatch",
    args: [
      operator,
      operator,
      maxBudget,
      maxTaskFee,
      expiry,
      true,
      labelHash,
      maxBudget,
    ],
  });
  const createReceipt = await publicClient.waitForTransactionReceipt({
    hash: createHash,
  });
  if (createReceipt.status !== "success") {
    throw new Error("createBatch reverted on Aevum Testnet.");
  }
  const batchId = Number(nextId);

  const allowHash = await wallet.writeContract({
    address: escrow,
    abi: ESCROW_ABI,
    functionName: "setTrustedEditor",
    args: [BigInt(batchId), editor, true],
  });
  await publicClient.waitForTransactionReceipt({ hash: allowHash });

  const record: LiveBatchRecord = {
    batchId,
    editorAddress: editor,
    createdAt: new Date().toISOString(),
  };
  writeJsonAtomic(liveBatchFile(), record);
  return record;
}

async function ensureLiveBatch(
  escrow: Address,
  operatorKey: Hex,
  editor: Address,
  feeUnits: bigint
): Promise<LiveBatchRecord> {
  const operator = privateKeyToAccount(operatorKey).address;

  // Serialize batch setup so concurrent approvals don't double-create.
  while (batchSetupLock) {
    await batchSetupLock;
  }

  const existing = readLiveBatch();
  if (await batchIsUsable(escrow, existing, operator, editor, feeUnits)) {
    return existing as LiveBatchRecord;
  }

  let release!: () => void;
  batchSetupLock = new Promise<void>((r) => (release = r));
  try {
    // Re-check after acquiring the lock in case another call just created one.
    const again = readLiveBatch();
    if (await batchIsUsable(escrow, again, operator, editor, feeUnits)) {
      return again as LiveBatchRecord;
    }
    return await createLiveBatch(escrow, operatorKey, editor);
  } finally {
    release();
    batchSetupLock = null;
  }
}

/**
 * Runs offerTask -> submitCorrectionBySig -> acceptTask on-chain for one task and
 * returns the real transaction hashes. The acceptTask hash is the single
 * "paid once" settlement a judge verifies on the explorer.
 */
export async function settleTaskOnChain(
  input: SettlementTaskInput
): Promise<SettlementResult> {
  const { operatorKey, editorKey, escrow } = requireConfigured();
  const editorAccount = privateKeyToAccount(editorKey);
  const editor = editorAccount.address;
  const { account: operatorAccount, wallet } = operatorWallet(operatorKey);

  const feeUnits = parseUnits(input.feeTusd8.toFixed(TUSD8_DECIMALS), TUSD8_DECIMALS);
  const batch = await ensureLiveBatch(escrow, operatorKey, editor, feeUnits);

  // Guard: if this exact taskId was already settled on-chain, do not pay twice.
  const existingTask = await publicClient.readContract({
    address: escrow,
    abi: ESCROW_ABI,
    functionName: "tasks",
    args: [input.taskIdBytes32],
  });
  const existingStatus = existingTask[4] as number; // 0 None,1 Offered,2 Submitted,3 Accepted
  if (existingStatus >= 3) {
    throw new Error(
      "This task already settled on-chain. ReviewEscrow pays each taskId at most once."
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const taskExpiry = BigInt(nowSec + 3600);
  let offerHash: Hex | null = null;
  let submitHash: Hex | null = null;

  // 1. Reserve the fee on-chain (operator acts as the batch agent).
  //    Skip if a prior partial run already offered this task.
  if (existingStatus < 1) {
    offerHash = await wallet.writeContract({
      address: escrow,
      abi: ESCROW_ABI,
      functionName: "offerTask",
      args: [
        BigInt(batch.batchId),
        input.taskIdBytes32,
        editor,
        feeUnits,
        taskExpiry,
        input.excerptHash,
      ],
    });
    const offerReceipt = await publicClient.waitForTransactionReceipt({
      hash: offerHash,
    });
    if (offerReceipt.status !== "success") {
      throw new Error("offerTask reverted on Aevum Testnet.");
    }
  }

  // 2. Editor signs the correction hash off-chain (zero gas); operator relays it.
  //    Skip if a prior partial run already submitted.
  if (existingStatus < 2) {
    const nonce = (await publicClient.readContract({
      address: escrow,
      abi: ESCROW_ABI,
      functionName: "editorNonces",
      args: [editor],
    })) as bigint;
    const deadline = BigInt(nowSec + 3000);
    const signature = await editorAccount.signTypedData({
      domain: {
        name: "SikioReviewEscrow",
        version: "1",
        chainId: AEVUM_CONFIG.chainId,
        verifyingContract: escrow,
      },
      types: {
        SubmitCorrection: [
          { name: "taskId", type: "bytes32" },
          { name: "correctionHash", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "SubmitCorrection",
      message: {
        taskId: input.taskIdBytes32,
        correctionHash: input.correctionHash,
        nonce,
        deadline,
      },
    });
    submitHash = await wallet.writeContract({
      address: escrow,
      abi: ESCROW_ABI,
      functionName: "submitCorrectionBySig",
      args: [input.taskIdBytes32, input.correctionHash, deadline, signature],
    });
    const submitReceipt = await publicClient.waitForTransactionReceipt({
      hash: submitHash,
    });
    if (submitReceipt.status !== "success") {
      throw new Error("submitCorrectionBySig reverted on Aevum Testnet.");
    }
  }

  // 3. Approver accepts -> pays the editor EXACTLY ONCE. This is the headline tx.
  const acceptHash = await wallet.writeContract({
    address: escrow,
    abi: ESCROW_ABI,
    functionName: "acceptTask",
    args: [input.taskIdBytes32],
  });
  const acceptReceipt = await publicClient.waitForTransactionReceipt({
    hash: acceptHash,
  });
  if (acceptReceipt.status !== "success") {
    throw new Error("acceptTask reverted on Aevum Testnet.");
  }

  const editorBalance = (await publicClient.readContract({
    address: AEVUM_CONFIG.tusd8Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [editor],
  })) as bigint;

  return {
    mode: "aevum-live",
    batchId: batch.batchId,
    taskIdBytes32: input.taskIdBytes32,
    editorAddress: editor,
    operatorAddress: operatorAccount.address,
    correctionHash: input.correctionHash,
    offerTxHash: offerHash,
    submitTxHash: submitHash,
    acceptTxHash: acceptHash,
    feeTusd8: input.feeTusd8,
    editorBalanceTusd8: Number(formatUnits(editorBalance, TUSD8_DECIMALS)),
    explorerTxUrl: `${AEVUM_CONFIG.explorerUrl}/tx/${acceptHash}`,
  };
}

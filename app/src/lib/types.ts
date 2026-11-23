export type ExecutionMode = "aevum-live" | "sandbox";

export type TaskStatus =
  | "offered"
  | "submitted"
  | "accepted"
  | "rejected"
  | "expired";

export type ReceiptKind =
  | "batch_funded"
  | "x402_inference"
  | "task_reserved"
  | "editor_payout"
  | "task_refund";

export interface CaptionWord {
  index: number;
  start: number; // seconds
  end: number; // seconds
  aiText: string;
  currentText: string;
  referenceText?: string; // optional ground truth for A/B benchmark evaluation
  confidence: number; // 0..1
  flagged: boolean;
  taskId?: string;
  fixedByHuman?: boolean;
}

export interface ReviewTask {
  id: string; // human readable e.g. task-1
  taskIdBytes32: `0x${string}`;
  jobId: string;
  batchId: number;
  clipId: string;
  clipTitle: string;
  languageTag: string;
  wordIndices: number[];
  start: number; // excerpt start seconds (with context padding)
  end: number; // excerpt end seconds (with context padding)
  focusStart: number; // uncertain span start
  focusEnd: number; // uncertain span end
  contextBefore: string;
  aiGuess: string;
  contextAfter: string;
  minConfidence: number;
  feeTusd8: number; // e.g. 0.10
  editorAddress: `0x${string}`;
  editorName: string;
  editorCity: string;
  status: TaskStatus;
  submittedText?: string;
  confirmedAiRight?: boolean;
  editorNote?: string;
  submittedAt?: string;
  approvedBy?: `0x${string}`;
  approvedAt?: string;
  rejectionReason?: string;
  expiryTimestamp: number; // unix seconds
  excerptHash: `0x${string}`;
  correctionHash?: `0x${string}`;
  offerTxHash?: `0x${string}`;
  settleTxHash?: `0x${string}`;
  settleMode?: ExecutionMode;
  gasMode: "zero-gas-relayed" | "paymaster-erc4337" | "sandbox";
}

export interface BatchBudget {
  batchId: number;
  agencyAddress: `0x${string}`;
  agentAddress: `0x${string}`;
  approverAddress: `0x${string}`;
  maxBudgetTusd8: number;
  fundedTusd8: number;
  spentTusd8: number;
  reservedTusd8: number;
  maxTaskFeeTusd8: number;
  expiryTimestamp: number;
  enforceEditorAllowlist: boolean;
  trustedEditors: { address: `0x${string}`; name: string; city: string; languages: string[] }[];
  agentRevoked: boolean;
  autoAcceptTrusted: boolean;
  mode: ExecutionMode;
  contractAddress?: `0x${string}`;
}

export interface CaptionJob {
  id: string;
  batchId: number;
  clipId: string;
  title: string;
  sourceLabel: string;
  languageTag: string;
  audioUrl: string;
  durationSeconds: number;
  confidenceThreshold: number; // default 0.78
  feePerTaskTusd8: number; // default 0.10
  inferenceCostTusd8: number; // e.g. 0.04
  transcriptionEngine: string; // explicitly labelled as Sikio endpoint
  x402RequestId: string;
  x402TxHash?: `0x${string}`;
  words: CaptionWord[];
  createdAt: string;
  isCustomUpload?: boolean;
}

export interface PaymentReceipt {
  id: string;
  kind: ReceiptKind;
  batchId: number;
  jobId?: string;
  taskId?: string;
  amountTusd8: number;
  from: `0x${string}`;
  to: `0x${string}`;
  actorLabel: string;
  txHash: `0x${string}`;
  mode: ExecutionMode;
  settlementState?: "active" | "settled" | "refunded";
  gasToken: "tUSD8 (sponsored)" | "tQDAY" | "sandbox";
  note: string;
  timestamp: string;
  x402Proof?: {
    protocol: "x402";
    endpoint: string;
    requestId: string;
    httpStatusFirstCall: 402;
    httpStatusRetry: 200;
  };
}

export interface BenchmarkRun {
  id: string;
  clipTitle: string;
  dialect: string;
  clipDurationSec: number;
  fullReviewSec: number;
  targetedReviewSec: number;
  fullReviewErrorsLeft: number;
  targetedReviewErrorsLeft: number;
  overconfidentAiMisses: number; // errors AI scored above threshold
  fullReviewCostUsd: number;
  targetedCostUsd: number;
  recordedAt: string;
  source: "measured-pilot" | "user-logged";
}

export interface SikioState {
  batch: BatchBudget;
  jobs: CaptionJob[];
  tasks: ReviewTask[];
  receipts: PaymentReceipt[];
  verifiedOnChainProofs: PaymentReceipt[];
  benchmarks: BenchmarkRun[];
}

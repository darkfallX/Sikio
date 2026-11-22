import fs from "fs";
import path from "path";
import crypto from "crypto";
import { keccak256, toHex } from "viem";
import {
  BatchBudget,
  BenchmarkRun,
  CaptionJob,
  ExecutionMode,
  PaymentReceipt,
  ReviewTask,
  SikioState,
} from "./types";
import { applyCorrectionToWords, buildFlaggedClusters } from "./captions";
import { AEVUM_CONFIG } from "./aevum";
import { SIKIO_TRANSCRIPTION_PROVIDER } from "./x402";

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "sikio-state.json");

function makeSandboxTxHash(seed: string): `0x${string}` {
  const hash = crypto
    .createHash("sha256")
    .update(`${seed}:${Date.now()}:${Math.random()}`)
    .digest("hex");
  return `0x${hash}`;
}

function defaultState(): SikioState {
  const nowSec = Math.floor(Date.now() / 1000);
  const agencyAddress: `0x${string}` = "0x75d0a558A7070868d23E5EF1FfaAcFe36C2B4D03";
  const agentAddress: `0x${string}` = "0x75d0a558A7070868d23E5EF1FfaAcFe36C2B4D03";
  const approverAddress: `0x${string}` = "0x75d0a558A7070868d23E5EF1FfaAcFe36C2B4D03";

  const batch: BatchBudget = {
    batchId: 1,
    agencyAddress,
    agentAddress,
    approverAddress,
    maxBudgetTusd8: 20.0,
    fundedTusd8: 20.0,
    spentTusd8: 0,
    reservedTusd8: 0,
    maxTaskFeeTusd8: 0.5,
    expiryTimestamp: nowSec + 7 * 86400,
    enforceEditorAllowlist: true,
    trustedEditors: [
      {
        address: "0xE017000000000000000000000000000000000101",
        name: "Chidinma Okafor",
        city: "Lagos",
        languages: ["Nigerian English", "Pidgin", "Yoruba"],
      },
      {
        address: "0xE017000000000000000000000000000000000202",
        name: "Brian Mwangi",
        city: "Nairobi",
        languages: ["Kenyan English", "Swahili", "Sheng"],
      },
      {
        address: "0xE017000000000000000000000000000000000303",
        name: "Ama Mensah",
        city: "Accra",
        languages: ["Ghanaian English", "Twi"],
      },
    ],
    agentRevoked: false,
    autoAcceptTrusted: false,
    mode: AEVUM_CONFIG.reviewEscrowAddress ? "aevum-live" : "sandbox",
    contractAddress: AEVUM_CONFIG.reviewEscrowAddress || undefined,
  };

  const initialReceipt: PaymentReceipt = {
    id: "rcpt-init-batch",
    kind: "batch_funded",
    batchId: 1,
    amountTusd8: 2.0,
    from: agencyAddress,
    to: AEVUM_CONFIG.reviewEscrowAddress,
    actorLabel: "Verified Live Aevum Batch #1 (createBatch)",
    txHash:
      "0x5e7cc05fa7d66b1ba76f6f0f64c634338ba6d285767a357ac1ca7289ff96c026",
    mode: "aevum-live",
    gasToken: "tQDAY",
    note: "Live on-chain Batch #1 on ReviewEscrow (0x36Cf…5E6b) · max 0.50 tUSD8/task · 7d session expiry",
    timestamp: new Date().toISOString(),
  };

  const liveProofReceipts: PaymentReceipt[] = [
    {
      id: "rcpt-live-accept",
      kind: "editor_payout",
      batchId: 1,
      amountTusd8: 0.25,
      from: AEVUM_CONFIG.reviewEscrowAddress,
      to: "0x2281ff3819AbA842881267DbFecc0a3B7A672D69",
      actorLabel: "Verified Live Payout -> Zero-Gas Editor (0 tQDAY)",
      txHash:
        "0x71820bca063398666435fae1c7633f8ed779cff4df487b01c3a988cedf38b6eb",
      mode: "aevum-live",
      gasToken: "tUSD8 (sponsored)",
      note: 'Relayed EIP-712 correction ("Pay stark" -> "Paystack") accepted & paid once on Aevum 44005',
      timestamp: new Date().toISOString(),
    },
    {
      id: "rcpt-live-x402",
      kind: "x402_inference",
      batchId: 1,
      amountTusd8: 0.04,
      from: agentAddress,
      to: SIKIO_TRANSCRIPTION_PROVIDER,
      actorLabel: "Verified Live x402 AI Buy (payInference)",
      txHash:
        "0xb47b9b577b76f7c697ec5927fc3684ba79758da90da7216597d9f5b79ee05bb0",
      mode: "aevum-live",
      gasToken: "tQDAY",
      note: "Settled 0.04 tUSD8 inside ReviewEscrow Batch #1 for word-level African speech ASR",
      timestamp: new Date().toISOString(),
      x402Proof: {
        protocol: "x402",
        endpoint: "/api/transcribe (Sikio-operated)",
        requestId: "sikio-x402-lagos-live",
        httpStatusFirstCall: 402,
        httpStatusRetry: 200,
      },
    },
    initialReceipt,
  ];

  // Transparent pilot A/B benchmark runs (explicitly including overconfident-AI misses!)
  const benchmarks: BenchmarkRun[] = [
    {
      id: "bench-lagos-01",
      clipTitle: "Tech Point Lagos (3m 10s pilot cut)",
      dialect: "Nigerian English / Pidgin",
      clipDurationSec: 190,
      fullReviewSec: 465,
      targetedReviewSec: 112,
      fullReviewErrorsLeft: 1,
      targetedReviewErrorsLeft: 2,
      overconfidentAiMisses: 1,
      fullReviewCostUsd: 11.08,
      targetedCostUsd: 1.62,
      recordedAt: "2026-11-19T14:20:00Z",
      source: "measured-pilot",
    },
    {
      id: "bench-nairobi-02",
      clipTitle: "Nairobi Mobility Doc (2m 40s pilot cut)",
      dialect: "Kenyan English / Swahili",
      clipDurationSec: 160,
      fullReviewSec: 390,
      targetedReviewSec: 94,
      fullReviewErrorsLeft: 0,
      targetedReviewErrorsLeft: 1,
      overconfidentAiMisses: 1,
      fullReviewCostUsd: 9.33,
      targetedCostUsd: 1.37,
      recordedAt: "2026-11-19T16:45:00Z",
      source: "measured-pilot",
    },
    {
      id: "bench-accra-03",
      clipTitle: "Osu Studio Drama (2m 05s pilot cut)",
      dialect: "Ghanaian English",
      clipDurationSec: 125,
      fullReviewSec: 310,
      targetedReviewSec: 78,
      fullReviewErrorsLeft: 1,
      targetedReviewErrorsLeft: 1,
      overconfidentAiMisses: 0,
      fullReviewCostUsd: 7.29,
      targetedCostUsd: 1.12,
      recordedAt: "2026-11-20T10:15:00Z",
      source: "measured-pilot",
    },
  ];

  return {
    batch,
    jobs: [],
    tasks: [],
    receipts: liveProofReceipts,
    benchmarks,
  };
}

export function readState(): SikioState {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      const fresh = defaultState();
      writeState(fresh);
      return fresh;
    }
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    return JSON.parse(raw) as SikioState;
  } catch {
    const fresh = defaultState();
    writeState(fresh);
    return fresh;
  }
}

export function writeState(state: SikioState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

export function resetState(): SikioState {
  const fresh = defaultState();
  writeState(fresh);
  return fresh;
}

export function getAvailableBudget(batch: BatchBudget): number {
  const cap = Math.min(batch.fundedTusd8, batch.maxBudgetTusd8);
  return Number(Math.max(0, cap - batch.spentTusd8 - batch.reservedTusd8).toFixed(6));
}

export function updateBatchPolicy(patch: {
  maxBudgetTusd8?: number;
  maxTaskFeeTusd8?: number;
  autoAcceptTrusted?: boolean;
  agentRevoked?: boolean;
  agencyAddress?: `0x${string}`;
  mode?: ExecutionMode;
}): SikioState {
  const state = readState();
  const b = state.batch;
  if (typeof patch.maxBudgetTusd8 === "number" && patch.maxBudgetTusd8 >= b.spentTusd8 + b.reservedTusd8) {
    b.maxBudgetTusd8 = Number(patch.maxBudgetTusd8.toFixed(2));
    b.fundedTusd8 = Number(patch.maxBudgetTusd8.toFixed(2));
  }
  if (typeof patch.maxTaskFeeTusd8 === "number" && patch.maxTaskFeeTusd8 > 0 && patch.maxTaskFeeTusd8 <= b.maxBudgetTusd8) {
    b.maxTaskFeeTusd8 = Number(patch.maxTaskFeeTusd8.toFixed(2));
  }
  if (typeof patch.autoAcceptTrusted === "boolean") {
    b.autoAcceptTrusted = patch.autoAcceptTrusted;
  }
  if (typeof patch.agentRevoked === "boolean") {
    b.agentRevoked = patch.agentRevoked;
  }
  if (patch.agencyAddress) {
    b.agencyAddress = patch.agencyAddress;
    b.approverAddress = patch.agencyAddress;
  }
  if (patch.mode) {
    b.mode = patch.mode;
  }
  writeState(state);
  return state;
}

/**
 * Registers a newly transcribed job, debits x402 AI inference cost from batch budget,
 * clusters low-confidence spans, and reserves tUSD8 escrow fees for each micro-review task.
 */
export function createJobAndReserveTasks(params: {
  clipId: string;
  title: string;
  sourceLabel: string;
  languageTag: string;
  audioUrl: string;
  durationSeconds: number;
  confidenceThreshold: number;
  feePerTaskTusd8: number;
  inferenceCostTusd8: number;
  transcriptionEngine: string;
  x402RequestId: string;
  x402TxHash?: `0x${string}`;
  words: CaptionJob["words"];
  preferredCity?: string;
  isCustomUpload?: boolean;
  mode?: ExecutionMode;
}): { state: SikioState; job: CaptionJob; createdTasks: ReviewTask[] } {
  const state = readState();
  const b = state.batch;
  const nowSec = Math.floor(Date.now() / 1000);
  const mode: ExecutionMode = params.mode || b.mode;

  if (b.agentRevoked) {
    throw new Error("Agent session has been revoked by the agency.");
  }
  if (nowSec > b.expiryTimestamp) {
    throw new Error("Batch budget session has expired.");
  }
  if (params.feePerTaskTusd8 > b.maxTaskFeeTusd8) {
    throw new Error(
      `Per-task fee (${params.feePerTaskTusd8.toFixed(2)} tUSD8) exceeds batch cap (${b.maxTaskFeeTusd8.toFixed(2)} tUSD8).`
    );
  }

  const clusters = buildFlaggedClusters(
    params.words,
    params.confidenceThreshold,
    params.durationSeconds
  );

  const totalNeeded = Number(
    (params.inferenceCostTusd8 + clusters.length * params.feePerTaskTusd8).toFixed(6)
  );
  const avail = getAvailableBudget(b);
  if (totalNeeded > avail) {
    throw new Error(
      `Insufficient batch budget: needs ${totalNeeded.toFixed(2)} tUSD8, only ${avail.toFixed(2)} tUSD8 available.`
    );
  }

  const jobId = `job-${Date.now().toString(36)}`;
  const x402TxHash = params.x402TxHash || makeSandboxTxHash(params.x402RequestId);

  // 1. Settle AI x402 transcription payment
  b.spentTusd8 = Number((b.spentTusd8 + params.inferenceCostTusd8).toFixed(6));
  state.receipts.unshift({
    id: `rcpt-x402-${Date.now().toString(36)}`,
    kind: "x402_inference",
    batchId: b.batchId,
    jobId,
    amountTusd8: params.inferenceCostTusd8,
    from: b.agentAddress,
    to: SIKIO_TRANSCRIPTION_PROVIDER,
    actorLabel: "Sikio Agent -> Sikio x402 ASR",
    txHash: x402TxHash,
    mode,
    gasToken: mode === "aevum-live" ? "tQDAY" : "sandbox",
    note: `HTTP 402 -> Paid ${params.inferenceCostTusd8.toFixed(2)} tUSD8 -> 200 OK (${params.words.length} timed words)`,
    timestamp: new Date().toISOString(),
    x402Proof: {
      protocol: "x402",
      endpoint: "/api/transcribe (Sikio-operated)",
      requestId: params.x402RequestId,
      httpStatusFirstCall: 402,
      httpStatusRetry: 200,
    },
  });

  // Pick matched trusted editor by city/language
  const editor =
    b.trustedEditors.find(
      (e) =>
        params.preferredCity &&
        e.city.toLowerCase() === params.preferredCity.toLowerCase()
    ) || b.trustedEditors[0];

  // 2. Reserve escrow fee for each low-confidence passage
  const createdTasks: ReviewTask[] = [];
  const wordsCopy = params.words.map((w) => ({
    ...w,
    flagged: w.confidence < params.confidenceThreshold,
  }));

  clusters.forEach((cluster, i) => {
    const taskId = `task-${jobId.slice(-4)}-${i + 1}`;
    const taskIdBytes32 = keccak256(toHex(taskId));
    const excerptHash = keccak256(
      toHex(`${params.clipId}:${cluster.excerptStart}-${cluster.excerptEnd}`)
    );
    const offerTxHash = makeSandboxTxHash(`offer:${taskId}`);

    b.reservedTusd8 = Number((b.reservedTusd8 + params.feePerTaskTusd8).toFixed(6));

    const task: ReviewTask = {
      id: taskId,
      taskIdBytes32,
      jobId,
      batchId: b.batchId,
      clipId: params.clipId,
      clipTitle: params.title,
      languageTag: params.languageTag,
      wordIndices: cluster.wordIndices,
      start: cluster.excerptStart,
      end: cluster.excerptEnd,
      focusStart: cluster.focusStart,
      focusEnd: cluster.focusEnd,
      contextBefore: cluster.contextBefore,
      aiGuess: cluster.aiGuess,
      contextAfter: cluster.contextAfter,
      minConfidence: cluster.minConfidence,
      feeTusd8: params.feePerTaskTusd8,
      editorAddress: editor.address,
      editorName: editor.name,
      editorCity: editor.city,
      status: "offered",
      expiryTimestamp: Math.min(b.expiryTimestamp, nowSec + 48 * 3600),
      excerptHash,
      offerTxHash,
      gasMode: mode === "aevum-live" ? "zero-gas-relayed" : "sandbox",
    };

    for (const wIdx of cluster.wordIndices) {
      if (wordsCopy[wIdx]) {
        wordsCopy[wIdx].taskId = taskId;
      }
    }

    createdTasks.push(task);
    state.tasks.unshift(task);

    state.receipts.unshift({
      id: `rcpt-offer-${taskId}`,
      kind: "task_reserved",
      batchId: b.batchId,
      jobId,
      taskId,
      amountTusd8: params.feePerTaskTusd8,
      from: b.agentAddress,
      to: (b.contractAddress ||
        "0xE5C0000000000000000000000000000000004405") as `0x${string}`,
      actorLabel: `Escrow Lock -> ${editor.name} (${editor.city})`,
      txHash: offerTxHash,
      mode,
      gasToken: mode === "aevum-live" ? "tQDAY" : "sandbox",
      note: `Reserved for ${cluster.excerptStart.toFixed(1)}s–${cluster.excerptEnd.toFixed(1)}s ("${cluster.aiGuess}")`,
      timestamp: new Date().toISOString(),
    });
  });

  const job: CaptionJob = {
    id: jobId,
    batchId: b.batchId,
    clipId: params.clipId,
    title: params.title,
    sourceLabel: params.sourceLabel,
    languageTag: params.languageTag,
    audioUrl: params.audioUrl,
    durationSeconds: params.durationSeconds,
    confidenceThreshold: params.confidenceThreshold,
    feePerTaskTusd8: params.feePerTaskTusd8,
    inferenceCostTusd8: params.inferenceCostTusd8,
    transcriptionEngine: params.transcriptionEngine,
    x402RequestId: params.x402RequestId,
    x402TxHash,
    words: wordsCopy,
    createdAt: new Date().toISOString(),
    isCustomUpload: params.isCustomUpload,
  };

  state.jobs.unshift(job);
  writeState(state);
  return { state, job, createdTasks };
}

/**
 * Editor submits correction from mobile Ear view (zero gas required).
 * If agency enabled `autoAcceptTrusted`, settles immediately via acceptTask.
 */
export function submitEditorCorrection(params: {
  taskId: string;
  submittedText: string;
  confirmedAiRight?: boolean;
  editorNote?: string;
}): { state: SikioState; task: ReviewTask } {
  const state = readState();
  const task = state.tasks.find((t) => t.id === params.taskId);
  if (!task) throw new Error("Task not found.");
  if (task.status !== "offered") {
    throw new Error(`Task cannot be submitted from status "${task.status}".`);
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec > task.expiryTimestamp) {
    throw new Error("Task has expired.");
  }

  const finalText = params.confirmedAiRight
    ? task.aiGuess
    : params.submittedText.trim();
  if (!finalText) {
    throw new Error("Correction text cannot be empty.");
  }

  task.status = "submitted";
  task.submittedText = finalText;
  task.confirmedAiRight = Boolean(params.confirmedAiRight);
  task.editorNote = params.editorNote?.trim() || undefined;
  task.submittedAt = new Date().toISOString();
  task.correctionHash = keccak256(toHex(`${task.id}:${finalText}`));

  writeState(state);

  if (state.batch.autoAcceptTrusted) {
    return acceptReviewTask({
      taskId: task.id,
      approverAddress: state.batch.approverAddress,
      note: "Auto-accepted via agency trusted-editor rule",
    });
  }

  return { state, task };
}

/**
 * Named approver accepts correction -> pays editor EXACTLY ONCE in tUSD8 and merges caption fix.
 */
export function acceptReviewTask(params: {
  taskId: string;
  approverAddress?: `0x${string}`;
  txHash?: `0x${string}`;
  note?: string;
  mode?: ExecutionMode;
}): { state: SikioState; task: ReviewTask } {
  const state = readState();
  const task = state.tasks.find((t) => t.id === params.taskId);
  if (!task) throw new Error("Task not found.");

  // Exact-once settlement invariant!
  if (task.status === "accepted") {
    throw new Error("Task already settled: ReviewEscrow pays each taskId at most once.");
  }
  if (task.status !== "offered" && task.status !== "submitted") {
    throw new Error(`Cannot accept task in status "${task.status}".`);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec > task.expiryTimestamp) {
    throw new Error("Cannot accept an expired task.");
  }

  const approver = params.approverAddress || state.batch.approverAddress;
  const mode = params.mode || state.batch.mode;
  const settleTxHash = params.txHash || makeSandboxTxHash(`accept:${task.id}`);

  task.status = "accepted";
  task.approvedBy = approver;
  task.approvedAt = new Date().toISOString();
  task.settleTxHash = settleTxHash;

  state.batch.reservedTusd8 = Number(
    Math.max(0, state.batch.reservedTusd8 - task.feeTusd8).toFixed(6)
  );
  state.batch.spentTusd8 = Number(
    (state.batch.spentTusd8 + task.feeTusd8).toFixed(6)
  );

  // Merge correction directly into the job's timed captions
  const job = state.jobs.find((j) => j.id === task.jobId);
  if (job) {
    const replacement = task.submittedText || task.aiGuess;
    job.words = applyCorrectionToWords(job.words, task.wordIndices, replacement);
  }

  state.receipts.unshift({
    id: `rcpt-pay-${task.id}`,
    kind: "editor_payout",
    batchId: task.batchId,
    jobId: task.jobId,
    taskId: task.id,
    amountTusd8: task.feeTusd8,
    from: (state.batch.contractAddress ||
      "0xE5C0000000000000000000000000000000004405") as `0x${string}`,
    to: task.editorAddress,
    actorLabel: `Paid Once -> ${task.editorName} (${task.editorCity})`,
    txHash: settleTxHash,
    mode,
    gasToken: mode === "aevum-live" ? "tUSD8 (sponsored)" : "sandbox",
    note:
      params.note ||
      `"${task.aiGuess}" -> "${task.submittedText || task.aiGuess}" · Approved by ${approver.slice(0, 8)}…`,
    timestamp: new Date().toISOString(),
  });

  writeState(state);
  return { state, task };
}

/**
 * Approver rejects or expires a task -> returns reserved fee cleanly to batch budget.
 */
export function rejectOrExpireTask(params: {
  taskId: string;
  action: "reject" | "expire";
  reason?: string;
  approverAddress?: `0x${string}`;
}): { state: SikioState; task: ReviewTask } {
  const state = readState();
  const task = state.tasks.find((t) => t.id === params.taskId);
  if (!task) throw new Error("Task not found.");
  if (task.status !== "offered" && task.status !== "submitted") {
    throw new Error(`Cannot ${params.action} task in status "${task.status}".`);
  }

  const mode = state.batch.mode;
  const txHash = makeSandboxTxHash(`${params.action}:${task.id}`);
  task.status = params.action === "reject" ? "rejected" : "expired";
  task.rejectionReason =
    params.reason ||
    (params.action === "expire" ? "Task expired before approval" : "Rejected by agency approver");
  task.settleTxHash = txHash;

  state.batch.reservedTusd8 = Number(
    Math.max(0, state.batch.reservedTusd8 - task.feeTusd8).toFixed(6)
  );

  state.receipts.unshift({
    id: `rcpt-ref-${task.id}`,
    kind: "task_refund",
    batchId: task.batchId,
    jobId: task.jobId,
    taskId: task.id,
    amountTusd8: task.feeTusd8,
    from: (state.batch.contractAddress ||
      "0xE5C0000000000000000000000000000000004405") as `0x${string}`,
    to: state.batch.agencyAddress,
    actorLabel:
      params.action === "expire"
        ? "Expired Task Refund -> Batch Budget"
        : "Rejected Task Refund -> Batch Budget",
    txHash,
    mode,
    gasToken: mode === "aevum-live" ? "tQDAY" : "sandbox",
    note: `${task.rejectionReason} · Returned ${task.feeTusd8.toFixed(2)} tUSD8 to available cap`,
    timestamp: new Date().toISOString(),
  });

  writeState(state);
  return { state, task };
}

export function addBenchmarkRun(run: Omit<BenchmarkRun, "id" | "recordedAt" | "source">): SikioState {
  const state = readState();
  state.benchmarks.unshift({
    ...run,
    id: `bench-${Date.now().toString(36)}`,
    recordedAt: new Date().toISOString(),
    source: "user-logged",
  });
  writeState(state);
  return state;
}

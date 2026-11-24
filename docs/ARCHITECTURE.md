# Sikio Architecture

> **AI captions for African voices. When the AI isn't sure, it hires a native speaker for those few seconds and pays them on QDay Aevum.**

## 1. System Overview

Sikio connects four layers into one bounded stablecoin workflow on **QDay Aevum Testnet (Chain ID `44005`)** using **`tUSD8` (`0x456569838f1d43009A91ebA4263147Afd7233483`, 6 decimals)**:

```
Agency Producer (Studio)
  │ 1. Approves Batch Budget (cap, maxTaskFee, expiry, trusted editors, named approver)
  ▼
Sikio Agent
  │ 2. Calls /api/transcribe (Sikio-operated) ──► HTTP 402 Payment Required (x402)
  │ 3. Pays 0.04 tUSD8 inside budget (ReviewEscrow.payInference) ──► retries with X-PAYMENT ──► 200 OK
  │ 4. Clusters words below confidence threshold into 3–6s excerpts
  │ 5. Locks per-task tUSD8 fees via ReviewEscrow.offerTask(batchId, taskId, editor, fee, expiry, excerptHash)
  ▼
Native-Speaker Editor (Ear — Mobile Web, Zero Gas)
  │ 6. Receives ONLY sliced WAV bytes (/api/excerpt/[clipId]?start=..&end=.., hard-clamped <= 12s)
  │ 7. Listens, edits misheard word or confirms AI guess, submits (EIP-712 gasless relay)
  ▼
Agency Approver (Approve)
  │ 8. Verifies diff + audio excerpt, clicks Approve and pay
  │ 9. ReviewEscrow.acceptTask(taskId) pays editor EXACTLY ONCE in tUSD8
  ▼
Caption Merge & Audit (Studio + Receipts)
 10. Merges accepted words at exact timestamps -> exports valid .srt / .vtt
 11. Displays Cost per Publishable Minute + every Explorer receipt
```

## 2. Smart Contract Architecture (`contracts/contracts/ReviewEscrow.sol`)

Because `@qday-io/sdk` is scheduled for Q1 2027 (verified in `qday-io/qday-wiki`), `ReviewEscrow.sol` enforces the entire Trellis/session-key spending policy directly on-chain on Aevum Testnet (`44005`):

- **`createBatch` / `fundBatch`**: Deposits `tUSD8` and binds `agent`, `approver`, `maxBudget`, `maxTaskFee`, `expiry`, and `enforceEditorAllowlist`.
- **`payInference(batchId, requestId, provider, amount)`**: Lets the agent pay an HTTP 402 (`x402`) transcription provider inside its budget. Each `requestId` settles at most once.
- **`offerTask(batchId, taskId, editor, fee, taskExpiry, excerptHash)`**: Reserves `fee` from `availableBudget(batchId)`. Validates agent session active, editor allowlisted, `fee <= maxTaskFee`, and unique `taskId`.
- **`submitCorrection` & `submitCorrectionBySig`**: Records the editor's `correctionHash`. `submitCorrectionBySig` uses EIP-712 typed data so an agency relayer pays gas — the editor never needs native `tQDAY`.
- **`acceptTask(taskId)`**: Callable only by `batch.approver` or `batch.agency`. Moves `fee` from `reserved` to `spent`, sets `TaskStatus.Accepted`, and transfers `tUSD8` to `editor` **exactly once**.
- **`rejectTask` & `expireTask`**: Releases `fee` from `reserved` back to available batch budget so unaccepted or expired tasks never lock funds permanently.
- **`revokeAgent`**: Immediate kill-switch for the agency owner without harming already-offered editor tasks.

### Account Abstraction / Paymaster Alignment
We verified on-chain via `https://rpc-test.qday.info` that ERC-4337 `EntryPoint v0.7` (`0x0000000071727De22E5E9d8BAf0edAc6f37da032`) is live on Aevum Testnet (`44005`). Once QDay publishes the public Aevum Alto bundler and stablecoin paymaster URLs, Sikio's editor EIP-712 zero-gas flow plugs directly into ERC-4337 smart accounts sponsored in `tUSD8`.

## 3. Web Application Architecture (`app/`)

- **Framework:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, `viem`.
- **Surfaces:**
  - `/` (**Landing**): The story page, with a live fix-it demo, cost comparison and on-chain proof links.
  - `/studio` (**Studio**): Clip picker (3 real spoken African-voice WAV clips + custom upload), confidence slider, waveform + live synced caption player, word-confidence transcript, budget rail, `.srt`/`.vtt` export, cost-per-minute summary.
  - `/ear` (**Ear**): Mobile-first editor UI with zero crypto jargon, excerpt-only WAV playback, one-tap fix submission, USD/tUSD8 earnings.
  - `/approve` (**Approve**): Side-by-side AI vs. human diff, excerpt replay, Approve and pay / Reject / Return fee actions.
  - `/receipts` (**Receipts**): Full payment ledger with Aevum Explorer links, live double-pay rejection probe, and Decisive A/B Benchmark table.
- **API Endpoints:**
  - `POST /api/transcribe`: Genuine HTTP `402 Payment Required` (`x402`) endpoint (self-hosted and labelled as ours). Verifies live Aevum tx receipts via `rpc-test.qday.info` when `mode === "aevum-live"`.
  - `GET /api/excerpt/[clipId]?start=&end=`: Raw PCM RIFF/WAV byte slicer enforcing a strict `<= 12s` confidentiality ceiling.
  - `GET /api/jobs/[id]/export?format=srt|vtt`: Generates compliant `.srt` and `.vtt` subtitle files from merged human corrections.

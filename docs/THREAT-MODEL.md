# Sikio Threat Model & Trust Boundaries

## 1. What the Chain Proves (and What It Does Not)

- **Proved on-chain (`ReviewEscrow.sol`):**
  1. The agency approved a bounded `tUSD8` budget (`maxBudget`, `maxTaskFee`, `expiry`).
  2. The agent paid the x402 transcription provider and reserved task fees strictly within those bounds.
  3. The named approver authorized settlement for `taskId`.
  4. The editor received the exact `tUSD8` fee **at most once**.
  5. Rejected or expired tasks returned their reserved `tUSD8` back to the agency's available budget.
- **NOT proved on-chain:**
  - **Linguistic accuracy.** A blockchain cannot verify whether a Lagos speaker said *"Paystack"* or *"Pay stark"*. That trust anchor belongs to the agency's named approver, whose address is displayed in UI and recorded in `TaskAccepted(batchId, taskId, editor, fee, approver, correctionHash)`.

## 2. Threat Matrix & Mitigations

| Threat | Impact | Mitigation in Sikio | Verified By |
|---|---|---|---|
| **Runaway or compromised AI agent** drains agency treasury | Financial loss | `maxBudget`, `maxTaskFee`, `expiry`, `enforceEditorAllowlist`, and instant `revokeAgent()` kill-switch on `ReviewEscrow.sol`. | Hardhat tests: budget cap, per-task cap, expiry, allowlist, kill-switch |
| **Double payment / replay attack** on `acceptTask` or `payInference` | Duplicate `tUSD8` payout | `tasks[taskId].status` transitions terminally to `Accepted`; `inferencePaid[requestId]` boolean guard. Repeated calls revert. | Hardhat tests + live "Probe Double-Pay Rejection" button in `/receipts` |
| **Self-approval by editor or agent** | Fraudulent payout | `acceptTask` and `rejectTask` strictly require `msg.sender == batch.approver || msg.sender == batch.agency`. | Hardhat test: unauthorized approver rejection |
| **Abandoned tasks locking agency funds forever** | Trapped escrow | Permissionless `expireTask(taskId)` after `task.expiry` returns `t.fee` from `reserved` back to `availableBudget`. | Hardhat test: expiry refund + late accept revert |
| **Confidential client video leaked to freelance editor** | NDA / client breach | `/api/excerpt/[clipId]` slices raw PCM WAV bytes server-side and hard-clamps duration to `<= 12s`. Full audio is never sent to `/ear`. | HTTP header `X-Sikio-Excerpt-Only: true` & byte-length verification |
| **Reentrancy on ERC-20 transfer** | Drain escrow | OpenZeppelin `ReentrancyGuard` + `SafeERC20` + Checks-Effects-Interactions pattern across all value-moving functions. | `ReviewEscrow.sol` code review & unit suite |
| **Overconfident AI error (silent ASR miss)** | Wrong caption published | Explicitly measured and reported in `/receipts` A/B benchmark; agencies can lower the confidence floor slider (e.g. `78% -> 88%`) to catch more proper nouns. | Documented in `docs/BENCHMARK.md` and UI |
| **Editor unable to pay native `tQDAY` gas** | Onboarding failure | EIP-712 `submitCorrectionBySig` allows gasless relayed submissions; receiving ERC-20 `tUSD8` requires zero gas. | Hardhat EIP-712 signature test |

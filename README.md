# Sikio

> **AI captions for African voices. When the AI isn't sure, it hires a native speaker for those few seconds and pays them on QDay Aevum.**
> (*Sikio* is Swahili for "ear".)

Built for **Aevum Builder Challenge #1** (QDay / PQA Labs · DoraHacks) — **Native AI Assistants** track, on **QDay Aevum Testnet (Chain ID `44005`)** using **`tUSD8` (`0x456569838f1d43009A91ebA4263147Afd7233483`, 6 decimals)**.

---

## Why Sikio Exists

1. **AI speech recognition struggles most on African speech.** Benchmark studies (*AfriSpeech-MultiBench 2025*) show error rates doubling or tripling on conversational West and East African accents (>25% WER), especially with code-switching (English + Pidgin / Yoruba / Swahili / Twi) and local brands, places, and names (*Paystack*, *Yaba*, *matatu*, *M-Pesa*, *jollof*, *wahala*).
2. **Localisation agencies face a bad binary:** publish broken captions, or pay human editors to re-check the entire recording even when 80% of the transcript is already right.
3. **Micro-payouts across African borders are broken on traditional rails.** Paying a trusted editor in Lagos, Nairobi, or Accra `$0.25` for 4 seconds of expert hearing is uneconomical via SWIFT, cards, or payout aggregators — but instant, deterministic, and exact-once in `tUSD8` on QDay Aevum.

---

## End-to-End Flow

1. **Approve Budget (`Studio`):** Agency approves a bounded `tUSD8` batch budget (cap, per-task ceiling, expiry, allowlisted editors, named approver, emergency revoke kill-switch).
2. **Buy AI Transcription over HTTP 402 (`x402`):** Sikio Agent calls `/api/transcribe` (self-hosted and labelled as ours) → receives `HTTP 402 Payment Required` (`eip155:44005`, `tUSD8`, `0.04 tUSD8`) → pays inside its approved budget → retries with `X-PAYMENT` proof → receives `200 OK` timed word-level probabilities.
3. **Reserve Micro-Review Fees (`ReviewEscrow.offerTask`):** Uncertain spans below the confidence floor are clustered into 3–6s excerpts, and exact `tUSD8` fees are locked in escrow.
4. **Native-Speaker Fix (`Ear` — Mobile Web, Zero Gas):** The assigned editor hears **only the server-sliced WAV excerpt** (`/api/excerpt/[clipId]`, hard-clamped `<= 12s` for client confidentiality), edits the misheard word or confirms the AI guess, and submits with zero crypto jargon and zero `tQDAY` gas required (via EIP-712 `submitCorrectionBySig`).
5. **Approve & Pay Once (`Approve`):** The agency's named approver listens to the excerpt, checks the before/after diff, and clicks **Accept & Pay Once** (`ReviewEscrow.acceptTask`). The editor receives `tUSD8` **exactly once**; rejected or expired tasks return fees to the batch budget.
6. **Replay, Export & Audit (`Studio` + `Receipts`):** Corrections merge into the exact caption timestamps immediately. Replay synchronized audio + subtitles, download `.srt` / `.vtt`, and audit cost per publishable minute, explorer receipts, and A/B benchmark metrics.

---

## Repository Layout

```
.
├── contracts/                   # Hardhat + Solidity 0.8.24 smart contracts for Aevum (44005)
│   ├── contracts/ReviewEscrow.sol
│   ├── contracts/mocks/MockTUSD8.sol
│   ├── scripts/deploy.ts
│   └── test/ReviewEscrow.test.ts
├── app/                         # Next.js 15 + TypeScript + Tailwind v4 + viem web app
│   ├── public/clips/            # 3 real spoken WAV clips (Lagos, Nairobi, Accra) + exact timings
│   └── src/
│       ├── app/                 # Studio (/), Ear (/ear), Approve (/approve), Receipts (/receipts), Legal
│       ├── app/api/             # x402 /api/transcribe, /api/excerpt WAV slicer, /api/jobs, /api/tasks
│       ├── components/          # WaveformPlayer, CaptionTimeline, BudgetRail, WalletContext, TopNav
│       └── lib/                 # aevum.ts, x402.ts, captions.ts, clips.ts, store.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── THREAT-MODEL.md
│   └── BENCHMARK.md
├── Dockerfile
└── LICENSE (MIT)
```

---

## Quick Start

### 1. Run Smart Contract Security Tests (Hardhat)
```bash
cd contracts
npm install
npm test
```
All 12 tests verify exact-once settlement, budget cap, per-task ceiling, x402 duplicate-request prevention, trusted-editor allowlist, unauthorized-approver rejection, task expiry & rejection refunds, emergency `revokeAgent` kill-switch, and EIP-712 zero-gas relayed editor submission.

### 2. Deploy `ReviewEscrow` to QDay Aevum Testnet (Chain 44005)
1. Claim testnet `tQDAY` and `tUSD8` from [faucet.qday.info/en](https://faucet.qday.info/en).
2. Configure `contracts/.env` (see `contracts/.env.example`):
   ```env
   AEVUM_RPC_URL=https://rpc-test.qday.info
   TUSD8_ADDRESS=0x456569838f1d43009A91ebA4263147Afd7233483
   DEPLOYER_PRIVATE_KEY=0x...
   ```
3. Deploy:
   ```bash
   cd contracts
   npm run deploy:aevum
   ```
4. Copy the deployed contract address into `app/.env.local` as `NEXT_PUBLIC_REVIEW_ESCROW_ADDRESS`.

### 3. Run the Sikio Web App
```bash
cd app
pnpm install
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000).

Run unit tests & production build check:
```bash
cd app
pnpm typecheck
pnpm test
pnpm build
```

### 4. Run with Docker
```bash
docker build -t sikio .
docker run -p 3000:3000 sikio
```

---

## Verified QDay Aevum Testnet Parameters

| Parameter | Verified Value |
|---|---|
| Network Name | `QDay Aevum` |
| Chain ID | `44005` (`0xABE5`) |
| RPC URL | `https://rpc-test.qday.info` |
| Block Explorer | `https://explorer-test.qday.info` |
| Native Gas Token | `tQDAY` (18 decimals) |
| Test Stablecoin (`tUSD8`) | `0x456569838f1d43009A91ebA4263147Afd7233483` (6 decimals) |
| ERC-4337 EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` (verified deployed on chain 44005) |

---

## Live 3–5 Minute Judge Demo Script

1. **Studio (`/`):** Pick the *Lagos · en-NG / pcm* clip (or upload your own audio). Click **Run Agent**.
   - Show the live `HTTP 402 → 0.04 tUSD8 → 200 OK` x402 handshake.
   - Play the audio and point to highlighted uncertain words (*"Pay stark"*, *"Yabba"*, *"wall holler"*, *"down for"*) and the budget bar showing reserved `tUSD8`.
2. **Ear (`/ear`):** Open the mobile-first editor view for *Chidinma · Lagos*.
   - Play the 3-second isolated WAV excerpt (note in DevTools: `/api/excerpt` returns ONLY that 3s slice, never the full recording).
   - Fix `"Pay stark"` → `"Paystack"` and click **Submit Fix** (zero gas, zero crypto terms).
3. **Approve (`/approve`):** Verify the diff + excerpt, click **Accept & Pay 0.25**.
   - `tUSD8` pays once; budget moves from Reserved to Settled.
4. **Replay & Export (`/`):** Return to Studio, replay the clip — `"Paystack"` now appears at the exact millisecond spoken in green. Click **Export .srt** to download publishable subtitles.
5. **Receipts & Safety (`/receipts`):** Show itemized payment ledger, click **Probe Double-Pay Rejection** to demonstrate exact-once safety live, and review the transparent A/B benchmark table (including overconfident AI misses).

---

## Limitations Stated Plainly

- **Testnet only (`tUSD8`):** Mainnet agency deployment requires a regulated stablecoin with local off-ramps (e.g., NGN/KES/GHS cash-out).
- **Live on-chain deployment requires funded deployer key:** No private key is bundled in this repository. Without `NEXT_PUBLIC_REVIEW_ESCROW_ADDRESS` + a connected Aevum `44005` wallet, the UI runs in clearly badged **Sandbox Mode** executing identical `ReviewEscrow` rules so judges can evaluate every workflow frictionlessly.
- **QDay SDK / Bundler status:** `@qday-io/sdk` and public Aevum Alto bundler URLs are scheduled for Q1 2027 (`qday-io/qday-wiki`). `ReviewEscrow.sol` enforces batch caps, expiry, allowlists, and EIP-712 gasless submissions directly on Aevum Testnet today.
- **Overconfident AI errors:** Targeted review misses errors where ASR scores above the agency's confidence floor; this rate is measured and published in `/receipts` and [`docs/BENCHMARK.md`](docs/BENCHMARK.md).
- **Self-hosted transcription endpoint:** `/api/transcribe` is operated by Sikio and explicitly labelled as ours.
- **Chain proves payment, not correctness:** The named approver attests to linguistic quality.

---

## Documentation

- [Architecture & Workflows](docs/ARCHITECTURE.md)
- [Threat Model & Security Invariants](docs/THREAT-MODEL.md)
- [Decisive A/B Test Benchmark](docs/BENCHMARK.md)
- [MIT License](LICENSE)

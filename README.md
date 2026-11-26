# Sikio

> **A pay-per-task stablecoin settlement app on QDay Aevum. When an AI caption is unsure of a word, it pays a native speaker once in tUSD8 for the exact seconds they fix.**
> (*Sikio* is Swahili for "ear".)

Built for **Aevum Builder Challenge #1** (QDay / PQA Labs · DoraHacks) — **Decentralized Payments** track, on **QDay Aevum Testnet (Chain ID `44005`)** using **`tUSD8` (`0x456569838f1d43009A91ebA4263147Afd7233483`, 6 decimals)**.

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
5. **Approve & Pay Once (`Approve`):** The agency's named approver listens to the excerpt, checks the before/after diff, and clicks **Approve and pay** (`ReviewEscrow.acceptTask`). The editor receives `tUSD8` **exactly once**; rejected or expired tasks return fees to the batch budget.
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
│       ├── app/page.tsx         # Landing page (/)
│       ├── app/(app)/           # Studio (/studio), Ear (/ear), Approve (/approve), Receipts (/receipts), Legal
│       ├── app/api/             # x402 /api/transcribe, /api/excerpt WAV slicer, /api/jobs, /api/tasks
│       ├── components/          # ui.tsx, art.tsx, TopNav, WaveformPlayer, landing/, studio/, ear/, approve/, receipts/
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

## Verified QDay Aevum Testnet Parameters & Live Deployment

| Parameter | Verified Value |
|---|---|
| Network Name | `QDay Aevum` |
| Chain ID | `44005` (`0xABE5`) |
| RPC URL | `https://rpc-test.qday.info` |
| Block Explorer | `https://explorer-test.qday.info` |
| Native Gas Token | `tQDAY` (18 decimals) |
| Test Stablecoin (`tUSD8`) | `0x456569838f1d43009A91ebA4263147Afd7233483` (6 decimals) |
| ERC-4337 EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` (verified deployed on chain 44005) |
| **Sikio `ReviewEscrow` (Live)** | [`0x36Cf1caB839bf01306E647C56B2e44e7d4a35E6b`](https://explorer-test.qday.info/address/0x36Cf1caB839bf01306E647C56B2e44e7d4a35E6b) |

### Verified End-to-End Testnet Transactions (Chain 44005)

Reproducible via `cd contracts && REVIEW_ESCROW_ADDRESS=0x36Cf1caB839bf01306E647C56B2e44e7d4a35E6b npm run demo:aevum`:

| Step | Action | Aevum Explorer Transaction |
|---|---|---|
| 1 | Approve `2.00 tUSD8` to `ReviewEscrow` | [`0x6114f8d4…25b2b43`](https://explorer-test.qday.info/tx/0x6114f8d4dada8725fc04c173f5081f0828ad7695dba1891b3d0d9cb3825b2b43) |
| 2 | `createBatch` (Batch #1, `2.00 tUSD8` cap, `0.50` max/task) | [`0x5e7cc05f…996c026`](https://explorer-test.qday.info/tx/0x5e7cc05fa7d66b1ba76f6f0f64c634338ba6d285767a357ac1ca7289ff96c026) |
| 3 | `setTrustedEditor` (allowlist 0-`tQDAY` editor `0x2281…2D69`) | [`0xdc0b4bc3…6df757d`](https://explorer-test.qday.info/tx/0xdc0b4bc3abde7d4639b4e8b823e63f79c2ad92c77865457824319a63e6df757d) |
| 4 | `payInference` (`0.04 tUSD8` x402 AI transcription buy) | [`0xb47b9b57…ee05bb0`](https://explorer-test.qday.info/tx/0xb47b9b577b76f7c697ec5927fc3684ba79758da90da7216597d9f5b79ee05bb0) |
| 5 | `offerTask` (reserve `0.25 tUSD8` for flagged excerpt) | [`0xc5429911…36e81a3`](https://explorer-test.qday.info/tx/0xc5429911b9d24fe6e13780b7b9f3215b60d3ceeb9ba642fb816158c0336e81a3) |
| 6 | `submitCorrectionBySig` (zero-gas EIP-712 relayed fix) | [`0x02850a07…2ee7f64`](https://explorer-test.qday.info/tx/0x02850a079ffe5b5016668c2c736a0099403d277df65e408c329d29cea2ee7f64) |
| 7 | `acceptTask` (pay editor `0.25 tUSD8` once; verified balance `0.25`) | [`0x71820bca…f38b6eb`](https://explorer-test.qday.info/tx/0x71820bca063398666435fae1c7633f8ed779cff4df487b01c3a988cedf38b6eb) |
| 8 | `withdrawAvailable` (reclaim unused `1.71 tUSD8` to agency) | [`0x82222855…360d537`](https://explorer-test.qday.info/tx/0x82222855be1128914065c31d5c6f572afcf2886a74b36c8b3da883a1b360d537) |

---

## Judge Demo Script (3 to 5 minutes)

No wallet needed. When the server has its operator and editor keys set (see `app/.env.example`), every payment in this script is a real transaction on chain 44005 with an explorer link: the agent pays 0.04 tUSD8 for the transcript (`payInference`), and Approve sends `offerTask`, `submitCorrectionBySig` and `acceptTask`, which pays the editor once (about 30 seconds; the public testnet is sometimes slower). Without those keys the same steps run in a sandbox and every receipt says so. To sign with your own wallet instead, connect it on chain 44005 and switch the top bar from **Sandbox** to **Live tx**.

1. **Landing (`/`):** Click **Open the demo**.
2. **Studio (`/studio`):** Keep the **Lagos · Pidgin** clip and click **Run agent**.
   - The x402 receipt shows **402 then 200**: the agent paid `0.04 tUSD8` for the transcript.
   - With `DEEPGRAM_API_KEY` set, the transcript is real Deepgram nova-3 output and the flags are its own word confidences. On the Lagos clip four spans land in **Needs an ear** (*"Point Lagos."*, *"Tunde"*, *"PACE TAC"* for Paystack, *"third mainland"*), and `0.40 tUSD8` is held for native speakers. Without the key, the prepared transcript runs instead and is labelled so.
   - **Cost per minute** compares Sikio with a full human pass.
3. **Ear (`/ear`):** The phone-first editor view. Step to *"PACE TAC"* (or *"Pay stark"* in the prepared transcript) with the arrows and play the voice note.
   - The editor hears only a short slice around the word, never more than 12 seconds. In DevTools, `/api/excerpt` returns that slice, never the full recording, and answers **403** to any window that is not a review task's own (so the recording cannot be walked in 12-second steps). Uploaded phone audio (.m4a, .ogg, .mp3, video) is converted to WAV with ffmpeg on upload, so uploads are sliced the same way.
   - Type `Paystack` and press **Send answer, pays $0.10**. No gas and no crypto words.
4. **Approve (`/approve`):** Press **Hear 1.9 seconds** to check the slice, then **Approve and pay 0.10**.
   - The word moves to **Settled** as **Paid once**.
5. **Replay and export (`/studio`):** Follow **Replay fixed captions**. *"Paystack"* now sits at the exact time it was spoken. Download **.srt** or **.vtt**.
6. **Receipts (`/receipts`):** Every payment is itemised. Sandbox receipts are marked sandbox, and the live testnet proofs link to the explorer. Press **Try to pay twice**: the server refuses with **HTTP 400** because each `taskId` pays once. Finish on the **A/B review benchmark**, including the misses where the AI was wrongly confident.

---

## Limitations Stated Plainly

- **Testnet only (`tUSD8`):** Mainnet agency deployment requires a regulated stablecoin with local off-ramps (e.g., NGN/KES/GHS cash-out).
- **Interactive Sandbox + Live Testnet:** `ReviewEscrow.sol` is deployed and verified end-to-end on QDay Aevum Testnet (`0x36Cf1caB839bf01306E647C56B2e44e7d4a35E6b`). Visitors without a wallet still trigger real transactions: Sikio's server pays from a small, capped live batch (2.00 tUSD8 at most per batch, 0.50 per task) and labels each receipt `live 44005` with an explorer link. If the server keys are missing or the testnet stays too slow, the flow falls back to **Sandbox Mode** with identical rules, and the receipt says sandbox.
- **No sign-in yet:** editors only ever get task slices from `/api/excerpt`, but the demo has no accounts, so the agency's full recording is still reachable by anyone who knows its URL (`/clips/*.wav` for the demo clips, `/api/media/<clipId>` for uploads). Real separation needs agency sign-in or signed links.
- **Slow public RPC:** `rpc-test.qday.info` answered in 2.5 to 19 seconds per call when measured on 25 Nov 2026. Settlement uses 45-second timeouts and retries, resumes from the step the chain already shows, and never pays a task twice.
- **QDay SDK / Bundler status:** `@qday-io/sdk` and public Aevum Alto bundler URLs are scheduled for Q1 2027 (`qday-io/qday-wiki`). `ReviewEscrow.sol` enforces batch caps, expiry, allowlists, and EIP-712 gasless submissions directly on Aevum Testnet today.
- **Overconfident AI errors:** Targeted review misses errors where ASR scores above the agency's confidence floor; this rate is measured and published in `/receipts` and [`docs/BENCHMARK.md`](docs/BENCHMARK.md).
- **Self-hosted transcription endpoint:** `/api/transcribe` is operated by Sikio and explicitly labelled as ours.
- **Real speech recognition, honestly measured:** With `DEEPGRAM_API_KEY` set, `/api/transcribe` sends the clip to Deepgram nova-3 and flags words by Deepgram's own confidence. It runs only for a payment verified on chain; sandbox payments get the prepared transcript (`app/public/clips/timings.json`), labelled **Sikio Local ASR Engine (prepared demo transcript)**. Measured on the three clips on 26 Nov 2026 (`node app/scripts/asr-proof.mjs`): Deepgram got 104 of 109 words right. At the 0.78 threshold it flagged 9 words, of which 3 were really wrong, and it missed 2 errors confidently (*"Wahela"* at 82%, *"Danfoe"* at 94%), so those stay wrong in the final captions. Counting the 0.65 seconds of context the app plays either side of each unsure word, a human heard 16.3 of 44.3 seconds (37%). Uploaded audio goes to the OpenAI Whisper API only when `OPENAI_API_KEY` is set; otherwise the local engine handles it and says so.
- **Chain proves payment, not correctness:** The named approver attests to linguistic quality.

---

## Credits and Third-Party Software

Sikio's own code is MIT licensed (see [LICENSE](LICENSE)). It builds on these open-source packages:

| Package | Used for | License |
|---|---|---|
| [Next.js](https://nextjs.org) `15.5` | Web app framework | MIT |
| [React](https://react.dev) and React DOM `19` | UI | MIT |
| [viem](https://viem.sh) `2` | Wallet, contract calls and EIP-712 signing on chain 44005 | MIT |
| [Motion](https://motion.dev) `12` | Animation | MIT |
| [Lucide](https://lucide.dev) | Icons | ISC |
| [Tailwind CSS](https://tailwindcss.com) `4` | Styling | MIT |
| [Vitest](https://vitest.dev), [TypeScript](https://www.typescriptlang.org), [ESLint](https://eslint.org) | Tests, types and linting | MIT, Apache 2.0, MIT |
| [OpenZeppelin Contracts](https://www.openzeppelin.com/contracts) `5.1` | SafeERC20 transfers, EIP-712 and ECDSA signatures, and ReentrancyGuard in `ReviewEscrow.sol` | MIT |
| [Hardhat](https://hardhat.org) and Hardhat Toolbox | Contract tests and deployment | MIT |
| dotenv, ts-node | Deploy script config and runtime | BSD 2-Clause, MIT |

- **Fonts:** Space Grotesk and Space Mono from Google Fonts, under the SIL Open Font License 1.1.
- **Network and test token:** QDay Aevum testnet and `tUSD8`, provided by QDay for the challenge.
- **Research cited:** [AfriSpeech-MultiBench (2025)](https://arxiv.org/html/2511.14255v1) and [AfriSpeech-200](https://arxiv.org/abs/2310.00274).

---

## Documentation

- [Architecture & Workflows](docs/ARCHITECTURE.md)
- [Threat Model & Security Invariants](docs/THREAT-MODEL.md)
- [Review savings: what is measured, and what is not](docs/BENCHMARK.md)
- [MIT License](LICENSE)

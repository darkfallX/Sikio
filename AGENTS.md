# Sikio Project Guide (`AGENTS.md`)

## 1. What Sikio is

**Sikio** (*Swahili: "ear"*) creates time-coded captions for African voices (Nigerian Pidgin/English, Kenyan Swahili/English, Ghanaian English). When automatic speech recognition (ASR) confidence drops on local names, slang, or venues, the Sikio agent pays for inference via HTTP `402` (`x402`), slices **only the uncertain seconds (`<= 12s`)** for a native speaker on mobile, and settles payment **once per `taskId`** in `tUSD8` on **QDay Aevum Testnet (`44005`)** via `ReviewEscrow.sol`.

---

## 2. Repository structure and commands

- **Smart contracts (`contracts/`)**: Solidity `0.8.24` (Cancun EVM, OpenZeppelin `5.1`), Hardhat test suite and deployment/demo scripts.
  - Run tests: `cd contracts && npm test`
- **Web application (`app/`)**: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, `viem`, `vitest`.
  - Install: `cd app && pnpm install`
  - Typecheck: `cd app && pnpm typecheck`
  - Lint: `cd app && pnpm lint`
  - Unit tests: `cd app && pnpm test`
  - Production build: `cd app && pnpm build`
  - E2E verification (requires running server on `127.0.0.1:3000`): `cd app && node scripts/e2e-verify.mjs`

---

## 3. Verified QDay Aevum Testnet (`44005` / `0xABE5`) configuration

- **RPC**: `https://rpc-test.qday.info`
- **Explorer**: `https://explorer-test.qday.info`
- **Faucet**: `https://faucet.qday.info/en`
- **`tUSD8` ERC-20 (6 decimals)**: `0x456569838f1d43009A91ebA4263147Afd7233483`
- **EntryPoint v0.7**: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
- **Deployed `ReviewEscrow`**: `0x36Cf1caB839bf01306E647C56B2e44e7d4a35E6b`

Real Nov 22, 2026 confirmed on-chain proof hashes belong exclusively in `verifiedOnChainProofs`. Never alter or fabricate on-chain hashes.

---

## 4. Non-negotiable honesty and accounting invariants

1. **Real vs. sandbox separation**: Never label a local `makeSandboxTxHash` digest as `"aevum-live"` or link sandbox hashes to `explorer-test.qday.info/tx/...`. Only genuine confirmed Chain `44005` transaction hashes get `"aevum-live"` and explorer links.
2. **Exact ledger reconciliation**: Active session receipts in `state.receipts` must reconcile 100% with the active `batch` totals (`Funded`, `Settled`, `Escrowed`, `Left`). Historical proof hashes live separately in `verifiedOnChainProofs`.
3. **Truthful ASR engine labeling**: Never label an endpoint `"Whisper"` unless the server actually invokes the OpenAI Whisper API (`OPENAI_API_KEY` + real audio file). Local heuristics/transcripts must be labeled honestly as `Sikio Local ASR Engine`.
4. **Strict settlement rules**: Do not allow accepting an unsubmitted `"offered"` task via `/api/tasks`. Enforce `taskId` exact-once payout and approver identity verification server-side.
5. **Excerpt confidentiality**: `/api/excerpt/[clipId]` must clamp audio slices to `<= 12` seconds, validate numeric query parameters strictly (`Number.isFinite`, HTTP `400` on invalid/inverted bounds), and never serve the full un-sliced agency WAV to the `/ear` endpoint.
6. **Valid economic math**: Sum merged non-overlapping intervals (`computeMergedDuration`) when computing `reviewTimeSavedPct`. Never display `-0%` or green savings styling when `costPerMinuteProjected > 3.50`.
7. **Secrets hygiene**: Never commit or print `.env`, `.env.local`, or private keys (e.g., `contracts/.env`).

---

## 5. Visual design and motion rules (Editorial Print Desk)

- **Design reference**: Editorial Print Desk (`Fraunces` editorial serif display + `Outfit` body `400`–`800` + `JetBrains Mono` `tabular-nums`). Never use `Inter` or `VT323`.
- **Theme tokens**:
  - Light: warm archival book-linen paper (`#efe9dc` canvas, `#fbf8f1` proof sheet, `#171410` espresso ink, `#c9461d` proofreader terracotta `--signal`, `#196b45` botanical green `--green`).
  - Dark: warm espresso press (`#12100e` canvas, `#1a1714` proof sheet, `#f1ece2` warm ivory ink, `#e8663c` terracotta, `#38b377` green).
- **Audio visualization (`OrganicWaveRibbon`)**: Always render a fluid, organic, dual-contour Bezier acoustic ribbon smoothed from real Web Audio PCM RMS data. **Never** use rigid vertical bar/candlestick histograms for audio waves.
- **Anti-slop discipline**:
  - Zero gradients (linear, radial, text, buttons), zero neon glows, zero floating blobs, zero glassmorphism cards (blur allowed on sticky header only).
  - Zero emoji icons (use `lucide-react` strokes), zero bento grids, zero checkmark bullet lists, zero filler headings/descriptions, zero banned words (`unlock`, `seamless`, `revolutionize`, `supercharge`, `next-generation`, `harness`).
  - **Sentence case** everywhere. Zero em dashes or en dashes in any UI copy.
  - At most one soft drop shadow (`hero-elevation`) on the hero proof object.
  - All interactive controls `>= 44px` on mobile (`375px`) with zero horizontal scrolling or clipped tables.
- **Motion discipline**: Single easing `cubic-bezier(0.25, 1, 0.5, 1)` across `.sikio-rise`, `.sikio-verdict`, `.sikio-check-pop`, and `.sikio-bar-fill`. Complete `prefers-reduced-motion` support.

---

## 6. Known environment notes

- **Windows `pnpm` symlinks**: `app/next.config.ts` gates `output: "standalone"` behind `DOCKER_BUILD=1` so Windows builds succeed without administrator symlink privileges.
- **Serverless write paths**: `app/src/lib/storage.ts` writes JSON/uploads atomically to `process.cwd()/data` and automatically falls back to `os.tmpdir()/sikio-data` when running on read-only filesystems.
- **Git pushes**: Pushing large audio assets on Windows requires `git -c http.postBuffer=524288000 push origin main`.
- **Commit messages**: Keep commit messages plain lowercase, modular, and free of em dashes or filler adjectives.

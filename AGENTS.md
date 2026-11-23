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

## 5. Visual design and motion rules (Lifecycle board + Voice-note thread)

- **Concept**:
  - Studio (`/`) is a lifecycle board. Every unsure word is a card that moves through four columns: **Needs an ear → Heard → Paid once → Returned**. A judge should understand Sikio from this one screen.
  - Ear (`/ear`) is a voice-note thread. The agent sends a short voice note and asks what was said, the editor replies, and the payment arrives as a message. No crypto words on this screen; show amounts as `$0.10`.
- **Type**: `Hanken Grotesk` 400 to 800 for everything (display at 800 with tight tracking), `Fragment Mono` for timings, hashes and amounts in columns (`tabular-nums`). No serif display faces. Never use `Inter`, `VT323`, `Fraunces` or `Outfit`.
- **Theme tokens** (`app/src/app/globals.css`, keep names stable):
  - Light: sage desk `#e7ebe8` (`--bg`), white cards `#ffffff` (`--paper`), ink `#15201b` (`--ink`).
  - Dark: `#0e1311` desk, `#161d1a` cards, `#e6ede9` ink.
  - Colour only encodes state, and the same colour means the same state everywhere: `--signal` ochre = needs an ear, `--heard` blue = heard and waiting for approval, `--green` = paid once, `--mute` grey = returned or expired, `--amber` = cost warning, `--red` = error or destructive.
  - Primary buttons are ink. The pay button is green. There is no brand accent colour beyond these.
- **Shared primitives**: use `app/src/components/ui.tsx` (`Button`, `buttonClass`, `ButtonLink`, `StatusPill`, `ModeTag`) instead of new long class strings.
- **Caption stage**: the live caption inside `WaveformPlayer` is a dark burned-in subtitle strip in both themes; unsure words get a dashed ochre underline, fixed words a solid green one.
- **Audio visualization (`OrganicWaveRibbon`)**: always the fluid dual-contour Bezier ribbon from real Web Audio PCM data, including inside Ear voice notes. Never vertical bar histograms.
- **Anti-slop discipline**:
  - Zero gradients, neon glows, floating blobs or glassmorphism (blur only on the sticky header).
  - Zero emoji icons (use `lucide-react`), zero bento grids, zero checkmark bullet lists, zero filler headings, zero banned words (`unlock`, `seamless`, `revolutionize`, `supercharge`, `next-generation`, `harness`).
  - **Sentence case** everywhere. Zero em dashes or en dashes in UI copy.
  - Plain words over system words: "Needs an ear", "Held", "Paid once", "Return fee", "Ask a human when the AI is below 78%". Not "escrowed spans", "floor" or "expire".
  - At most one soft shadow (`hero-elevation`), used on the Ear thread.
  - All interactive controls `>= 44px` on mobile (`375px`), no horizontal scrolling, no clipped tables.
  - Every screen has loading, empty and error states.
- **Motion discipline**: single easing `cubic-bezier(0.25, 1, 0.5, 1)` for `.sikio-rise`, `.sikio-card-in` (a card arriving in a new column), `.sikio-bubble` (a new message in Ear), `.sikio-verdict`, `.sikio-check-pop` and `.sikio-bar-fill`. Full `prefers-reduced-motion` support.

---

## 6. Known environment notes

- **Windows `pnpm` symlinks**: `app/next.config.ts` gates `output: "standalone"` behind `DOCKER_BUILD=1` so Windows builds succeed without administrator symlink privileges.
- **Serverless write paths**: `app/src/lib/storage.ts` writes JSON/uploads atomically to `process.cwd()/data` and automatically falls back to `os.tmpdir()/sikio-data` when running on read-only filesystems.
- **Git pushes**: Pushing large audio assets on Windows requires `git -c http.postBuffer=524288000 push origin main`.
- **Commit messages**: Keep commit messages plain lowercase, modular, and free of em dashes or filler adjectives.
